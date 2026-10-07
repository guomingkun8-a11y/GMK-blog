#!/usr/bin/env bash
# ============================================================
# GMK-blog 一键更新脚本
# 用法：
#   bash deploy/update.sh           # 只更新前端（最常用）
#   bash deploy/update.sh --api     # 连后端一起更新
# ============================================================
set -e

HOST="121.40.193.80"
KEY="$HOME/.ssh/gmk_ecs"
SSH="ssh -i $KEY -o BatchMode=yes -o LogLevel=ERROR -o StrictHostKeyChecking=no root@$HOST"

# 项目根目录（脚本所在位置的上一级）
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo " GMK-blog 部署更新"
echo " 目标: $HOST"
echo "=============================================="

UPDATE_API=0
if [ "$1" = "--api" ]; then
  UPDATE_API=1
fi

# ---------- 1. 构建前端 ----------
echo ""
echo "[1/4] 构建 Astro 前端 ..."
cd "$ROOT/frontend"
DEPLOY_TARGET=server DEPLOY_SITE="http://$HOST" npm run build

# ---------- 2. 上传前端 ----------
echo ""
echo "[2/4] 上传前端到 /var/www/gmk-blog ..."
tar -C "$ROOT/frontend/dist" -cf - . | $SSH \
  'find /var/www/gmk-blog -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /var/www/gmk-blog -xf - && chown -R www-data:www-data /var/www/gmk-blog && echo "  前端文件数: $(find /var/www/gmk-blog -type f | wc -l)"'

# ---------- 3. 上传后端（可选） ----------
if [ "$UPDATE_API" = "1" ]; then
  echo ""
  echo "[3/4] 上传后端到 /opt/gmk-blog-api ..."
  tar --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' \
    -C "$ROOT/backend" -cf - . | $SSH \
    'tar -C /opt/gmk-blog-api -xf - && chown -R www-data:www-data /opt/gmk-blog-api && chmod 600 /opt/gmk-blog-api/.env && echo "  后端已更新"'

  echo ""
  echo "[3.5/4] 重启后端服务 ..."
  $SSH 'systemctl restart gmk-blog-api && echo "  后端状态: $(systemctl is-active gmk-blog-api)"'
else
  echo ""
  echo "[3/4] 跳过（只更新前端，如需更新后端请加 --api）"
fi

# ---------- 4. 验证 ----------
echo ""
echo "[4/4] 验证线上 ..."
echo "  首页: $($SSH 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/')"
if [ "$UPDATE_API" = "1" ]; then
  echo "  后端健康: $($SSH 'curl -s http://127.0.0.1:8000/health')"
fi

echo ""
echo "=============================================="
echo " ✅ 部署完成"
echo " 访问: http://$HOST"
echo "=============================================="
