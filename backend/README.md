# GMK Blog API

这个目录是博客的后端代理。浏览器只请求 FastAPI，SerpApi 密钥只在服务端读取，不会进入 Astro 静态页面。

## 本地运行

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# 编辑 .env，填写 SERPAPI_KEY
uvicorn app.main:app --reload --port 8000
```

检查服务：

```text
http://localhost:8000/health
http://localhost:8000/api/forums?q=FastAPI&limit=5
```

## 前端配置

在 `frontend/.env` 中设置：

```env
PUBLIC_FORUMS_API_URL=http://localhost:8000
```

`PUBLIC_` 变量可以被浏览器看到，所以这里只能放后端地址，不能放 SerpApi Key。

## 部署

GitHub Pages 只能托管 Astro 静态页面，不能运行 FastAPI。生产环境需要单独部署这个 `backend` 目录（例如 Render、Railway、Fly.io 或自己的服务器），并将 `FRONTEND_ORIGINS` 设置为博客的 origin（例如 `https://guomingkun8-a11y.github.io`，不要带 `/GMK-blog` 路径），再把前端的 `PUBLIC_FORUMS_API_URL` 设置为后端公网地址。
