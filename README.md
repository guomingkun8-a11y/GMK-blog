# GMK-blog

郭明坤的个人博客，前端使用 Astro，后端使用 FastAPI。

## 目录

```text
frontend/    Astro 前端页面、组件、静态资源和构建配置
backend/     FastAPI 接口和 SerpApi 代理
deploy/      阿里云服务器部署脚本和 nginx 配置
.github/     GitHub Pages 自动部署工作流
```

## 前端开发

在项目根目录执行：

```powershell
npm install --prefix frontend
npm run dev
npm run build
```

也可以进入 `frontend/` 后执行同样的 Astro 命令。

## 后端开发

后端说明见 [backend/README.md](backend/README.md)。

博客地址：<https://guomingkun8-a11y.github.io/GMK-blog/>

## 背景音乐

把音频文件放到 `frontend/public/music/`（支持 mp3、m4a、aac、wav、ogg、opus、flac、webm）。构建时会按文件名排序生成歌单，播放完最后一首后从第一首继续。新增或删除音乐后重新构建并部署；无需在网页上选择文件。浏览器可能限制有声自动播放，此时点击页眉姓名旁的唱片即可播放。
