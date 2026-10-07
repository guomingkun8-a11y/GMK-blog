// @ts-check
import { defineConfig } from 'astro/config';

// base 按部署目标切换：
// - GitHub Pages：/GMK-blog（默认）
// - 自有服务器：/（构建时设置 DEPLOY_TARGET=server）
const isServerDeploy = process.env.DEPLOY_TARGET === 'server';

// 服务器部署的正式访问地址（可用 DEPLOY_SITE 覆盖）
const serverSite = process.env.DEPLOY_SITE || 'http://121.40.193.80';

// https://astro.build/config
export default defineConfig({
  site: isServerDeploy ? serverSite : 'https://guomingkun8-a11y.github.io',
  base: isServerDeploy ? '/' : '/GMK-blog',
  vite: {
    css: {
      // 明确用 postcss/esbuild 管线，避免 lightningcss 把 @media (max-width:…)
      // 转成 range 语法 (width<=…)，旧版 iOS Safari（<16.4）不认识会整段丢弃
      transformer: 'postcss',
    },
    build: {
      cssMinify: 'esbuild',
      // 指定 CSS 兼容目标：safari16 不支持 range 语法，esbuild 会把
      // (width<=…) 自动降级回 (max-width:…)，兜住 Astro scoped 样式
      cssTarget: ['chrome100', 'edge100', 'firefox100', 'safari16'],
    },
    server: {
      // 本地开发时由前端同源转发到 FastAPI，避免浏览器跨端口/CORS/预览沙箱问题
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  },
});
