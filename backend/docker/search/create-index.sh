#!/usr/bin/env bash
# EPIC-SEARCH(FC-107): listings 색인 부트스트랩(search-spec §12.4·§12.5).
#   1) 인덱스 템플릿(listings*) 등록 — settings(nori/ngram)·mappings(코드축·publicId keyword 등)를 고정한다.
#      ★ 템플릿이 있으면 앱/CDC 가 명시 생성 전에 문서를 써서 인덱스가 자동 생성돼도 올바른 매핑이 적용된다
#        (동적 매핑으로 publicId 가 text 가 되면 앱의 publicId 정렬이 'fielddata disabled' 로 실패 → 검색 503).
#   2) 물리 인덱스(listings_v1) + 읽기 alias(listings_search) 생성 — settings/mappings 는 템플릿에서 상속.
#   멱등: 이미 있으면 그대로 둔다. 매핑 변경 시 v2 를 만들어 재색인 후 alias 를 스위치한다.
set -euo pipefail

ES_URL="${ES_URL:-http://localhost:9200}"
INDEX="${INDEX:-listings_v1}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Elasticsearch 헬스 대기: ${ES_URL}"
until curl -sf "${ES_URL}/_cluster/health" >/dev/null; do
  sleep 2
done

echo "==> 인덱스 템플릿 등록: listings (patterns: listings*)"
curl -sf -X PUT "${ES_URL}/_index_template/listings" \
  -H 'Content-Type: application/json' \
  --data-binary "@${DIR}/listings-template.json" \
  && echo " [OK]" \
  || { echo " [FAIL] 템플릿 등록 실패 — 응답 확인 필요"; exit 1; }

echo "==> 인덱스 생성: ${INDEX} (+ alias listings_search, 매핑은 템플릿 상속)"
curl -sf -X PUT "${ES_URL}/${INDEX}" \
  -H 'Content-Type: application/json' \
  -d '{"aliases":{"listings_search":{}}}' \
  && echo " [OK]" \
  || echo " [SKIP] 이미 존재 — 기존 인덱스 매핑이 템플릿과 다르면 재생성(삭제 후 재실행) 필요"
