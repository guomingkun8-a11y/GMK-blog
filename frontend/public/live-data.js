// 实时数据渲染：页面加载后 fetch /api/github 和 /api/news，动态填充对应容器。
// 约定：页面里放置带 data-live 属性的占位容器，本脚本识别类型后填充 HTML。
// 类型：
//   data-live="github-featured"  首页「一些作品」网格（star 前 4）
//   data-live="github-repos"     作品页「我的项目」网格（分页由 works-pager.js 处理）
//   data-live="github-starred"   作品页「我 star 的项目」列表
//   data-live="news"             新闻页列表
// 骨架/占位默认显示 loading，拉取失败显示错误文案，由脚本替换 innerHTML。

(function () {
  "use strict";

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function timeAgo(iso) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "刚刚";
    if (m < 60) return m + " 分钟前";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " 小时前";
    return Math.floor(h / 24) + " 天前";
  }

  function formatStars(n) {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
    return String(n);
  }

  // 配图映射（与构建期 lib/github.ts 的 WORK_IMAGES 保持一致）
  var WORK_IMAGES = {
    "TB_spider-gmk": "works/tb-spider.jpg",
    RAW_PHOTO: "works/raw-photo.jpg",
    "ai-manga-video-reverse-workbench": "works/ai-manga.jpg",
    BoomStory: "works/boomstory.jpg",
  };

  var BASE = (window.__GMK_BASE__ || "/").replace(/\/?$/, "/");

  function workImage(name) {
    return WORK_IMAGES[name] || "";
  }

  function thumbText(name) {
    return name.split(/[-_]/).slice(0, 2).join(" ").toUpperCase();
  }

  function assetHref(path) {
    return BASE + String(path || "").replace(/^\//, "");
  }

  function renderError(msg) {
    return '<p class="page__empty">' + escapeHtml(msg) + "</p>";
  }

  // 首页「一些作品」：star 前 4
  function renderFeatured(data) {
    var repos = (data.repos || []).slice().sort(function (a, b) {
      return b.stargazers_count - a.stargazers_count;
    });
    var featured = repos.slice(0, 4);
    if (featured.length === 0) return renderError("GitHub 数据暂时拉不到，稍后再试。");
    return featured
      .map(function (r) {
        var img = workImage(r.name);
        var thumbCls = "home__work-thumb" + (img ? " home__work-thumb--photo" : "");
        var imgHtml = img
          ? '<img src="' + escapeHtml(assetHref(img)) + '" alt="' + escapeHtml(r.name) + ' 配图" loading="lazy" />'
          : "";
        return (
          '<a class="home__work-card" href="' + escapeHtml(r.html_url) + '" target="_blank" rel="noopener">' +
          '<div class="' + thumbCls + '">' +
          imgHtml +
          "<span>" + escapeHtml(thumbText(r.name)) + "</span>" +
          "</div>" +
          '<div class="home__work-meta">' +
          '<h3 class="home__work-name">' + escapeHtml(r.name) + "</h3>" +
          '<span class="home__work-tag">' +
          (r.language ? escapeHtml(r.language) + " · " : "") + "★ " + r.stargazers_count +
          "</span>" +
          "</div>" +
          "</a>"
        );
      })
      .join("");
  }

  // 作品页「我的项目」
  function renderRepos(data) {
    var repos = data.repos || [];
    var countEl = document.querySelector('[data-live-count="repos"]');
    if (countEl) countEl.textContent = repos.length + " 个仓库";
    if (repos.length === 0) return renderError("GitHub 数据暂时拉不到，稍后再试。");
    return repos
      .map(function (r) {
        var img = workImage(r.name);
        var thumbCls = "page__work-thumb" + (img ? " page__work-thumb--photo" : "");
        var imgHtml = img
          ? '<img src="' + escapeHtml(assetHref(img)) + '" alt="' + escapeHtml(r.name) + ' 配图" loading="lazy" />'
          : "";
        return (
          '<a class="page__work-card" href="' + escapeHtml(r.html_url) + '" target="_blank" rel="noopener">' +
          '<div class="' + thumbCls + '">' +
          imgHtml +
          "<span>" + escapeHtml(r.name.replace(/[-_]/g, " ").slice(0, 14).toUpperCase()) + "</span>" +
          "</div>" +
          '<div class="page__work-meta">' +
          '<h3 class="page__work-name">' + escapeHtml(r.name) + "</h3>" +
          '<div class="page__work-tags">' +
          (r.language ? '<span class="page__work-tag">' + escapeHtml(r.language) + "</span>" : "") +
          '<span class="page__work-tag page__work-star">★ ' + r.stargazers_count + "</span>" +
          "</div>" +
          '<p class="page__work-desc">' + escapeHtml(r.description || "暂无描述") + "</p>" +
          "</div>" +
          "</a>"
        );
      })
      .join("");
  }

  // 作品页「我 star 的项目」
  function renderStarred(data) {
    var GITHUB_USER = (data.user || "guomingkun8-a11y");
    var starred = (data.starred || [])
      .filter(function (r) {
        return (r.full_name || "").split("/")[0] !== GITHUB_USER;
      })
      .sort(function (a, b) {
        return b.stargazers_count - a.stargazers_count;
      });
    var countEl = document.querySelector('[data-live-count="starred"]');
    if (countEl) countEl.textContent = "全部 " + starred.length + " 个";
    if (starred.length === 0) return '<li class="page__empty">star 项目拉取失败，稍后再试。</li>';
    return starred
      .map(function (r) {
        return (
          '<li class="page__starred-item">' +
          '<a href="' + escapeHtml(r.html_url) + '" target="_blank" rel="noopener">' +
          '<span class="page__starred-name">' + escapeHtml(r.full_name) + "</span>" +
          '<span class="page__starred-desc">' + escapeHtml(r.description || "暂无描述") + "</span>" +
          "</a>" +
          '<span class="page__starred-meta">' +
          (r.language ? '<span class="page__starred-lang">' + escapeHtml(r.language) + "</span>" : "") +
          '<span class="page__starred-star">★ ' + formatStars(r.stargazers_count) + "</span>" +
          "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  // 新闻页列表
  function renderNews(data) {
    var items = data.items || [];
    var head = document.querySelector("[data-live-head]");
    if (head && items.length > 0) {
      var d = new Date(data.fetched_at);
      var t = Number.isNaN(d.getTime())
        ? ""
        : d.toLocaleString("zh-CN", { hour12: false });
      head.innerHTML =
        '<span class="news__src">数据源 · Hacker News Top Stories</span>' +
        '<span class="news__updated">更新于 ' + escapeHtml(t) + "</span>";
    }
    if (items.length === 0) return renderError("暂时没能拉取到新闻数据，稍后刷新试试。");
    return items
      .map(function (item, i) {
        return (
          '<li class="news__item" data-reveal>' +
          '<a class="news__link" href="' + escapeHtml(item.link) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="news__rank">' + String(i + 1).padStart(2, "0") + "</span>" +
          '<span class="news__main">' +
          '<span class="news__title">' + escapeHtml(item.title) + "</span>" +
          '<span class="news__meta">' +
          item.points + " 赞 · " + item.comments + " 评论 · @" + escapeHtml(item.author) +
          " · " + timeAgo(item.created_at) +
          "</span>" +
          "</span>" +
          '<span class="news__arrow">↗</span>' +
          "</a>" +
          "</li>"
        );
      })
      .join("");
  }

  function fill(container, html) {
    if (!container) return;
    container.innerHTML = html;
    // 重新触发 reveal 动画（若有 data-reveal 元素）
    if (window.__GMK_REVEAL__ && typeof window.__GMK_REVEAL__ === "function") {
      container.querySelectorAll("[data-reveal]").forEach(function (n) {
        window.__GMK_REVEAL__(n);
      });
    }
  }

  // 页面加载后并发拉两个接口，各自填充
  function boot() {
    // GitHub
    var ghContainers = {
      "github-featured": document.querySelector('[data-live="github-featured"]'),
      "github-repos": document.querySelector('[data-live="github-repos"]'),
      "github-starred": document.querySelector('[data-live="github-starred"]'),
    };
    var needGithub = ghContainers["github-featured"] || ghContainers["github-repos"] || ghContainers["github-starred"];

    var newsContainer = document.querySelector('[data-live="news"]');

    if (needGithub) {
      fetch("/api/github", { headers: { Accept: "application/json" } })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (data) {
          if (!data) {
            if (ghContainers["github-featured"])
              fill(ghContainers["github-featured"], renderError("GitHub 数据暂时拉不到，稍后再试。"));
            if (ghContainers["github-repos"])
              fill(ghContainers["github-repos"], renderError("GitHub 数据暂时拉不到，稍后再试。"));
            if (ghContainers["github-starred"])
              fill(ghContainers["github-starred"], '<li class="page__empty">star 项目拉取失败，稍后再试。</li>');
            return;
          }
          if (ghContainers["github-featured"])
            fill(ghContainers["github-featured"], renderFeatured(data));
          if (ghContainers["github-repos"])
            fill(ghContainers["github-repos"], renderRepos(data));
          if (ghContainers["github-starred"])
            fill(ghContainers["github-starred"], renderStarred(data));
          // 数据填充后，重新初始化分页（作品页）
          if (window.__GMK_PAGER__ && typeof window.__GMK_PAGER__ === "function") {
            var grids = document.querySelectorAll("[data-pager]");
            for (var i = 0; i < grids.length; i++) {
              delete grids[i].dataset.pagerReady;
            }
            window.__GMK_PAGER__();
          }
        })
        .catch(function () {
          if (ghContainers["github-featured"])
            fill(ghContainers["github-featured"], renderError("GitHub 数据暂时拉不到，稍后再试。"));
          if (ghContainers["github-repos"])
            fill(ghContainers["github-repos"], renderError("GitHub 数据暂时拉不到，稍后再试。"));
          if (ghContainers["github-starred"])
            fill(ghContainers["github-starred"], '<li class="page__empty">star 项目拉取失败，稍后再试。</li>');
        });
    }

    if (newsContainer) {
      fetch("/api/news", { headers: { Accept: "application/json" } })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (data) {
          if (!data) {
            fill(newsContainer, renderError("暂时没能拉取到新闻数据，稍后刷新试试。"));
            return;
          }
          fill(newsContainer, renderNews(data));
        })
        .catch(function () {
          fill(newsContainer, renderError("暂时没能拉取到新闻数据，稍后刷新试试。"));
        });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
