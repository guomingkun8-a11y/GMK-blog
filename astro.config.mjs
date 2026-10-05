// @ts-check
import { defineConfig } from 'astro/config';

// base 按部署目标切换：
// - GitHub Pages：/GMK-blog（默认，CI 里 npm run build 不设变量）
// - 自有服务器：/（npm run build:server 时 DEPLOY_TARGET=server）
const isServerDeploy = process.env.DEPLOY_TARGET === 'server';

// https://astro.build/config
export default defineConfig({
  site: isServerDeploy ? 'http://121.40.193.80' : 'https://guomingkun8-a11y.github.io',
  base: isServerDeploy ? '/' : '/GMK-blog',
});
