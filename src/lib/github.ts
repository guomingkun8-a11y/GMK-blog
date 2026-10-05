// GitHub 数据共享模块：构建期/服务端执行，不耗访客配额
// 限流保护：数据缓存到 node_modules/.cache/github-data.json，1 小时内不重复请求；
// 请求失败时自动降级用过期缓存，页面不会空白。
import fs from "node:fs";
import path from "node:path";

export type Repo = {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
};

export type GithubData = { repos: Repo[]; starred: Repo[] };

const GITHUB_USER = "guomingkun8-a11y";
const CACHE_FILE = path.join(process.cwd(), "node_modules", ".cache", "github-data.json");
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

type GithubCache = { fetchedAt: number; repos: Repo[]; starred: Repo[] };

function readCache(): GithubCache | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as GithubCache;
  } catch {
    return null;
  }
}

function writeCache(data: GithubCache): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch {
    /* 缓存写失败不影响页面 */
  }
}

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "gmk-blog",
};
// CI/本地配置了 GITHUB_TOKEN 时走认证请求（限额 5000 次/时）
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getGithubData(): Promise<GithubData> {
  let repos: Repo[] = [];
  let starred: Repo[] = [];

  const cache = readCache();
  const isFresh = !!cache && Date.now() - cache.fetchedAt < CACHE_TTL;

  if (cache && isFresh) {
    // 缓存新鲜：直接用，不打 API
    repos = cache.repos;
    starred = cache.starred;
  } else {
    // 并行抓：仓库 + star 分页循环（每页 100，最多 5 页，覆盖全部 star）
    const [reposRes, starredP1] = await Promise.all([
      fetchJson<Repo[]>(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`),
      fetchJson<Repo[]>(`https://api.github.com/users/${GITHUB_USER}/starred?per_page=100&page=1`),
    ]);
    if (reposRes && starredP1) {
      repos = reposRes;
      starred = [...starredP1];
      // star 超过一页时继续抓后续页
      for (let page = 2; page <= 5 && starred.length === (page - 1) * 100; page++) {
        const next = await fetchJson<Repo[]>(
          `https://api.github.com/users/${GITHUB_USER}/starred?per_page=100&page=${page}`
        );
        if (!next || next.length === 0) break;
        starred.push(...next);
      }
      writeCache({ fetchedAt: Date.now(), repos, starred });
    } else if (cache) {
      // 请求失败（如限额）：用过期缓存兜底，页面不空白
      repos = cache.repos;
      starred = cache.starred;
    }
    // 连缓存都没有 → 保持空数组，页面显示占位提示
  }

  return { repos, starred };
}

export function formatStars(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}
