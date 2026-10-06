"""Small server-side proxy for SerpApi's Google Forums engine."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv()

SERPAPI_URL = "https://serpapi.com/search.json"
MAX_QUERY_LENGTH = 120
DEFAULT_LIMIT = 10
MAX_LIMIT = 20
MAX_CACHE_ENTRIES = 256


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
    allow_methods=["GET"],
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
