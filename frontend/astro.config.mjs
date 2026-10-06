// @ts-check
import { defineConfig } from 'astro/config';

// base 按部署目标切换：
// - GitHub Pages：/GMK-blog（默认）
// - 自有服务器：/（构建时设置 DEPLOY_TARGET=server）
const isServerDeploy = process.env.DEPLOY_TARGET === 'server';

// https://astro.build/config
export default defineConfig({
  site: isServerDeploy ? 'http://121.40.193.80' : 'https://guomingkun8-a11y.github.io',
  base: isServerDeploy ? '/' : '/GMK-blog',
  vite: {
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
