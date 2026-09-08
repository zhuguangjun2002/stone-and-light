#!/usr/bin/env bash
# 部署到 Cloudflare Pages（项目 church → https://church.bigcow.net）
# 需要环境变量 CLOUDFLARE_API_TOKEN；账号 ID 见下。
# 只上传站点运行所需文件，不含 test/ tools/ .git/。
set -euo pipefail

export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-8fc041ad121a1dbd1207ec9db9301945}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -r "$ROOT/index.html" "$ROOT/src" "$ROOT/lib" "$ROOT/docs" "$STAGE"/
echo "暂存 $(find "$STAGE" -type f | wc -l) 个文件 ($(du -sh "$STAGE" | cut -f1))"

npx --yes wrangler@latest pages deploy "$STAGE" \
  --project-name church --branch main --commit-dirty=true

echo "完成 → https://church.bigcow.net"
