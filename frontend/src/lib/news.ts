// Hacker News 数据共享模块：构建期 / dev 服务端抓取，不耗访客配额
// 数据源：Algolia HN Search API（免费、无 key、单次请求返回 30 条）
// 性能策略：缓存优先（stale-while-revalidate）。只要有缓存就立即返回，
// 过期后后台刷新，不阻塞页面；首次无缓存时最多等待 4 秒。
import fs from "node:fs";
import path from "node:path";

export type NewsItem = {
  id: number;
  title: string;
  url: string | null;
  points: number;
  comments: number;
  author: string;
  created_at: string;
  link: string;
};

export type NewsData = { items: NewsItem[]; fetchedAt: number };

type Cache = { fetchedAt: number; items: NewsItem[] };

const CACHE_FILE = path.join(process.cwd(), "node_modules", ".cache", "hn-data.json");
const CACHE_TTL = 60 * 60 * 1000; // 1 小时：新闻无需每 10 分钟刷新
const MAX_ITEMS = 30;
const REQUEST_TIMEOUT = 4000;

// 防止 dev 模式并发请求重复刷新
let refreshPromise: Promise<Cache | null> | null = null;

function readCache(): Cache | null {
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as Cache;
    return Array.isArray(cache.items) && cache.items.length > 0 ? cache : null;
  } catch {
    return null;
  }
}

function writeCache(data: Cache): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch {
    // 缓存写失败不影响页面
  }
}

// Algolia 单次请求直接拿 30 条首页新闻，替代 Firebase 的 31 次网络请求。
async function fetchFromAlgolia(): Promise<Cache | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const endpoint = `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${MAX_ITEMS}`;
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      hits?: Array<{
        objectID?: string;
        title?: string;
        url?: string | null;
        points?: number;
        num_comments?: number;
        author?: string;
        created_at?: string;
      }>;
    };

    const items = (payload.hits ?? [])
      .filter((hit) => hit.objectID && hit.title)
      .slice(0, MAX_ITEMS)
      .map((hit) => {
        const id = Number(hit.objectID);
        const url = hit.url || null;
        return {
          id,
          title: hit.title!,
          url,
          points: hit.points ?? 0,
          comments: hit.num_comments ?? 0,
          author: hit.author ?? "unknown",
          created_at: hit.created_at ?? new Date().toISOString(),
          link: url || `https://news.ycombinator.com/item?id=${id}`,
        } satisfies NewsItem;
      });

    if (items.length === 0) return null;
    const data = { fetchedAt: Date.now(), items };
    writeCache(data);
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function refreshInBackground(): void {
  if (refreshPromise) return;
  refreshPromise = fetchFromAlgolia().finally(() => {
    refreshPromise = null;
  });
  // 显式忽略后台 Promise；刷新成功会写入文件缓存，失败则继续保留旧缓存。
  void refreshPromise;
}

export async function getNews(): Promise<NewsData> {
  const cache = readCache();

  // 核心优化：只要有缓存就立即返回，绝不让用户点击页面时等待跨境 API。
  if (cache) {
    const isStale = Date.now() - cache.fetchedAt >= CACHE_TTL;
    if (isStale) refreshInBackground();
    return { items: cache.items, fetchedAt: cache.fetchedAt };
  }

  // 首次无缓存：最多等待 4 秒。成功后写缓存；失败显示页面空态。
  const fresh = await fetchFromAlgolia();
  if (fresh) return fresh;

  return { items: [], fetchedAt: Date.now() };
}

// 相对时间（中文）
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}
