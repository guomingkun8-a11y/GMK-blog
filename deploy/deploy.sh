#!/usr/bin/env bash
# GMK-blog 一键部署到阿里云 ECS（121.40.193.80）
# 前置条件：
#   1. 本机已有密钥 ~/.ssh/gmk_ecs，且公钥已加到服务器 /root/.ssh/authorized_keys
#   2. 阿里云安全组已放行 22 (SSH) 和 80 (HTTP)
# 用法（在 Git Bash 里运行）：
#   bash deploy/deploy.sh          # 常规部署（不含 3.1GB PDF，日常更新用这个）
#   bash deploy/deploy.sh --docs   # 首次部署，连同 PDF 一起上传（耗时长，建议夜间）
set -e

HOST="root@121.40.193.80"
KEY="$HOME/.ssh/gmk_ecs"
REMOTE_DIR="/var/www/gmk-blog"
WITH_DOCS="${1:-}"

echo "==> 1/4 构建（服务器版：根路径 /）"
DEPLOY_TARGET=server npm run build

echo "==> 2/4 服务器准备（安装 nginx、建目录）"
ssh -i "$KEY" "$HOST" "mkdir -p $REMOTE_DIR && (which nginx >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq nginx))"

echo "==> 3/4 上传站点文件"
EXCLUDE="--exclude=./docs"
if [ "$WITH_DOCS" = "--docs" ]; then EXCLUDE=""; fi
tar -C dist -cf - $EXCLUDE . | ssh -i "$KEY" "$HOST" "tar -C $REMOTE_DIR -xf -"

echo "==> 4/4 分发 nginx 配置并重载"
scp -i "$KEY" -q deploy/nginx-gmk-blog.conf "$HOST:/etc/nginx/sites-available/gmk-blog"
ssh -i "$KEY" "$HOST" "ln -sf /etc/nginx/sites-available/gmk-blog /etc/nginx/sites-enabled/gmk-blog && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx"

echo ""
echo "==> 部署完成: http://121.40.193.80"
