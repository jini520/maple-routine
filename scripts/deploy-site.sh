#!/usr/bin/env bash
# mapleroutine.store 정적 사이트를 Oracle 로 올린다.
#
# GitHub Actions 가 아니라 손으로 도는 이유. 자동화하려면 GitHub Actions 에 Oracle 접속
# 열쇠를 둬야 하고, 그 열쇠가 새면 서버가 열린다. 이 사이트는 처방침을 고칠 때나 바뀌는데
# 그것이 1년에 몇 번이라, 상시 열려 있는 열쇠를 그 빈도에 내주는 것이 안 맞는다.
#
# 열쇠를 둘 만큼 자주 바뀌게 되면 그때 CI 로 옮긴다.
set -euo pipefail

HOST="${DEPLOY_HOST:-ubuntu@158.179.175.230}"
DEST="${DEPLOY_DEST:-/var/www/mapleroutine/}"

cd "$(dirname "$0")/.."

echo "빌드"
npm run build:site

echo "올린다 → $HOST:$DEST"
# --delete 로 지운 파일이 서버에 안 남게 한다. 옛 페이지가 남으면 그것도 열린다.
rsync -az --delete --stats dist-site/ "$HOST:$DEST" | grep -E "Number of files|Total transferred"

echo "확인"
for p in / /privacy /support /api-key /app-ads.txt; do
  code=$(curl -sL --max-time 15 -o /dev/null -w '%{http_code}' "https://mapleroutine.store$p")
  printf '  %-14s %s\n' "$p" "$code"
done
