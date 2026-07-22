#!/usr/bin/env bash
# EPIC-SEARCH(FC-107): listings 물리 인덱스(listings_v1) + 읽기 alias(listings_search) 생성(search-spec §12.4·§12.5).
#   멱등: 이미 있으면 200/이미 존재 응답을 그대로 둔다. 매핑 변경 시 v2 를 만들어 재색인 후 alias 를 스위치한다.
set -euo pipefail

ES_URL="${ES_URL:-http://localhost:9200}"
INDEX="${INDEX:-listings_v1}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Elasticsearch 헬스 대기: ${ES_URL}"
until curl -sf "${ES_URL}/_cluster/health" >/dev/null; do
  sleep 2
done

echo "==> 인덱스 생성: ${INDEX} (+ alias listings_search)"
curl -sf -X PUT "${ES_URL}/${INDEX}" \
  -H 'Content-Type: application/json' \
  --data-binary "@${DIR}/listings-index.json" \
  && echo " [OK]" \
  || echo " [SKIP] 이미 존재하거나 생성 실패 — 응답 확인 필요"
