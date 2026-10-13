"""Small server-side proxy for SerpApi's Google Forums engine."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv()

SERPAPI_URL = "https://serpapi.com/search.json"
MAX_QUERY_LENGTH = 120
DEFAULT_LIMIT = 10
MAX_LIMIT = 20
MAX_CACHE_ENTRIES = 256

# GitHub / 新闻实时数据源（前端页面加载时 fetch，走本服务端代理）
GITHUB_USER = os.getenv("GITHUB_USER", "guomingkun8-a11y")
GITHUB_API = "https://api.github.com"
HN_ALGOLIA = "https://hn.algolia.com/api/v1/search"
# 实时数据缓存 TTL（秒），默认 3 小时；可用 CACHE_TTL_SECONDS 覆盖
DATA_TTL_DEFAULT = 3 * 60 * 60
MAX_HN_ITEMS = 30

# AI 对话配置仅保存在服务端，禁止再通过 PUBLIC_ 环境变量注入浏览器。
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
AI_MODEL = os.getenv("AI_MODEL", "qwen/qwen3.8-27b:free")
AI_FALLBACK_MODEL = os.getenv("AI_FALLBACK_MODEL", "openrouter/free")
AI_SYSTEM_PROMPT = os.getenv(
    "AI_SYSTEM_PROMPT",
    "你是郭明坤个人博客的 AI 小助手，用简洁、友好的中文回答。",
)
MAX_CHAT_MESSAGES = 12
MAX_CHAT_CONTENT_LENGTH = 1000
CHAT_RATE_LIMIT = 20
CHAT_RATE_WINDOW = 60 * 60
_chat_requests: dict[str, list[float]] = {}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_CHAT_CONTENT_LENGTH)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_CHAT_MESSAGES)


@dataclass
class CacheEntry:
    expires_at: float
    value: dict[str, Any]


cache: dict[str, CacheEntry] = {}


def _origins() -> list[str]:
    raw = os.getenv("FRONTEND_ORIGINS", "http://localhost:4321")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _ttl() -> int:
    try:
        return max(0, int(os.getenv("CACHE_TTL_SECONDS", "300")))
    except ValueError:
        return 300


app = FastAPI(title="GMK Blog API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _normalise_results(payload: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for item in payload.get("organic_results", [])[:limit]:
        results.append(
            {
                "position": item.get("position"),
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "source": item.get("source", ""),
                "date": item.get("date", ""),
                "snippet": item.get("snippet", ""),
                "favicon": item.get("favicon", ""),
            }
        )
    return results


@app.get("/api/forums")
async def forums(
    q: str = Query(..., min_length=1, max_length=MAX_QUERY_LENGTH),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    start: int = Query(0, ge=0, le=100),
) -> dict[str, Any]:
    query = " ".join(q.split())
    if not query:
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")

    api_key = os.getenv("SERPAPI_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="服务端尚未配置 SERPAPI_KEY")

    cache_key = f"{query.lower()}|{limit}|{start}"
    cached = cache.get(cache_key)
    now = time.monotonic()
    if cached and cached.expires_at > now:
        return cached.value
    if cached:
        cache.pop(cache_key, None)

    params = {
        "engine": "google_forums",
        "q": query,
        "api_key": api_key,
        "hl": os.getenv("SERPAPI_LANGUAGE", "zh-cn"),
        "gl": os.getenv("SERPAPI_COUNTRY", "cn"),
        "start": start,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(SERPAPI_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="论坛搜索服务暂时不可用") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="论坛搜索服务连接失败") from exc

    if payload.get("error"):
        raise HTTPException(status_code=502, detail="论坛搜索服务返回错误")

    result = {
        "query": query,
        "results": _normalise_results(payload, limit),
        "pagination": payload.get("serpapi_pagination", {}),
    }
    if len(cache) >= MAX_CACHE_ENTRIES:
        cache.pop(next(iter(cache)))
    cache[cache_key] = CacheEntry(expires_at=now + _ttl(), value=result)
    return result


# ===== 实时数据接口：GitHub 仓库 / star、Hacker News 头条 =====
# 缓存策略：内存缓存，默认 3 小时过期；期间重复请求直接命中缓存，不打上游。
# 单一数据 key，避免刷爆内存；上游失败时返回过期缓存兜底（首次失败则返回空/503）。

# 独立的实时数据缓存（与上面搜索缓存分开，TTL 不同）
_live_cache: dict[str, CacheEntry] = {}


def _live_ttl() -> int:
    """实时数据 TTL。优先用 DATA_TTL_SECONDS，否则回退 CACHE_TTL_SECONDS，最后 3 小时。"""
    raw = os.getenv("DATA_TTL_SECONDS")
    if raw:
        try:
            return max(0, int(raw))
        except ValueError:
            pass
    return _ttl() if os.getenv("CACHE_TTL_SECONDS") else DATA_TTL_DEFAULT


async def _github_fetch(user: str, token: str | None) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "gmk-blog-api",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=15) as client:
        repos_resp = await client.get(
            f"{GITHUB_API}/users/{user}/repos",
            params={"per_page": 100, "sort": "updated"},
            headers=headers,
        )
        repos_resp.raise_for_status()
        repos = repos_resp.json()

        starred: list[Any] = []
        for page in range(1, 6):
            starred_resp = await client.get(
                f"{GITHUB_API}/users/{user}/starred",
                params={"per_page": 100, "page": page},
                headers=headers,
            )
            starred_resp.raise_for_status()
            batch = starred_resp.json()
            if not batch:
                break
            starred.extend(batch)
            if len(batch) < 100:
                break

    def slim(r: dict[str, Any]) -> dict[str, Any]:
        return {
            "full_name": r.get("full_name"),
            "name": r.get("name"),
            "description": r.get("description"),
            "html_url": r.get("html_url"),
            "language": r.get("language"),
            "stargazers_count": r.get("stargazers_count", 0),
            "fork": r.get("fork", False),
        }

    return {
        "user": user,
        "repos": [slim(r) for r in repos if isinstance(r, dict)],
        "starred": [slim(r) for r in starred if isinstance(r, dict)],
    }


@app.get("/api/github")
async def github_data() -> dict[str, Any]:
    token = os.getenv("GITHUB_TOKEN", "").strip()
    now = time.monotonic()
    cached = _live_cache.get("github")
    if cached and cached.expires_at > now:
        return cached.value

    try:
        data = await _github_fetch(GITHUB_USER, token or None)
    except httpx.HTTPStatusError as exc:
        # 429/403 通常是匿名限额；503 表示 GitHub 侧异常
        status = 503 if exc.response.status_code >= 500 else 429
        if cached:  # 过期缓存兜底
            return cached.value
        raise HTTPException(
            status_code=status,
            detail="GitHub 接口暂时不可用（可能是匿名请求限额），请稍后再试",
        ) from exc
    except httpx.HTTPError as exc:
        if cached:
            return cached.value
        raise HTTPException(status_code=502, detail="GitHub 连接失败") from exc

    _live_cache["github"] = CacheEntry(expires_at=now + _live_ttl(), value=data)
    return data


@app.post("/api/chat")
async def chat(payload_request: ChatRequest, request: Request) -> dict[str, str]:
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent = [
        requested_at
        for requested_at in _chat_requests.get(client_ip, [])
        if now - requested_at < CHAT_RATE_WINDOW
    ]
    if len(recent) >= CHAT_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="请求过于频繁，请稍后再试")
    recent.append(now)
    _chat_requests[client_ip] = recent

    api_key = os.getenv("AI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="服务端尚未配置 AI_API_KEY")

    conversation = [
        {"role": item.role, "content": " ".join(item.content.split())}
        for item in payload_request.messages
        if item.content.strip()
    ]
    if not conversation or conversation[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="最后一条消息必须来自用户")

    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": AI_SYSTEM_PROMPT},
            *conversation,
        ],
        "max_tokens": 800,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    site_name = os.getenv("AI_SITE_NAME", "").strip()
    if site_name and site_name.isascii():
        headers["X-Title"] = site_name

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{AI_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )
            if not response.is_success and AI_MODEL != AI_FALLBACK_MODEL:
                payload["model"] = AI_FALLBACK_MODEL
                response = await client.post(
                    f"{AI_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="AI 模型暂时不可用") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="AI 服务连接失败") from exc

    try:
        reply = str(data["choices"][0]["message"]["content"]).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="AI 模型没有返回有效内容") from exc
    return {"reply": reply or "模型暂时没有返回内容。"}


@app.get("/api/news")
async def news_data() -> dict[str, Any]:
    now = time.monotonic()
    cached = _live_cache.get("news")
    if cached and cached.expires_at > now:
        return cached.value

    params = {"tags": "front_page", "hitsPerPage": MAX_HN_ITEMS}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                HN_ALGOLIA, params=params, headers={"Accept": "application/json"}
            )
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError as exc:
        if cached:
            return cached.value
        raise HTTPException(status_code=502, detail="Hacker News 连接失败") from exc

    items = []
    for hit in (payload.get("hits") or [])[:MAX_HN_ITEMS]:
        object_id = hit.get("objectID")
        title = hit.get("title")
        if not object_id or not title:
            continue
        url = hit.get("url") or None
        # Algolia 偶发在 URL 末尾带反斜杠，清理掉
        if url:
            url = url.rstrip("\\")
        items.append(
            {
                "id": int(object_id),
                "title": title,
                "url": url,
                "points": hit.get("points", 0),
                "comments": hit.get("num_comments", 0),
                "author": hit.get("author", "unknown"),
                "created_at": hit.get("created_at", ""),
                "link": url or f"https://news.ycombinator.com/item?id={object_id}",
            }
        )

    data = {"items": items, "fetched_at": int(time.time() * 1000)}
    _live_cache["news"] = CacheEntry(expires_at=now + _live_ttl(), value=data)
    return data
