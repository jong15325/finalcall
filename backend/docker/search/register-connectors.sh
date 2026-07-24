#!/usr/bin/env bash
# EPIC-SEARCH(FC-107): Kafka Connect REST 로 Debezium source + ES sink 커넥터를 등록한다(search-spec §12.1·§12.3).
#   멱등(재실행 안전): 커넥터가 이미 있으면 삭제 후 재등록한다. ES sink 는 _id(public_id) 기준 멱등이고,
#   source 는 snapshot.mode=initial 이라 재등록 시 재스냅샷돼 데이터 정합이 유지된다.
#
# ★ python 비의존(FC-115 후속 · Windows 함정): 이전 버전은 config 추출/PUT 에 python 을 썼는데, Windows
#   Git Bash 의 `python` 이 Microsoft Store 스텁이라 "Python" 만 출력하고 실패했다(스크립트 중단). 커넥터
#   파일이 이미 `{name, config}` 형식(POST /connectors 본문과 동일)이므로 파일을 그대로 POST 한다 —
#   config 서브객체 추출이 불필요해 python/jq 없이 순수 curl 로 동작한다.
set -euo pipefail

CONNECT_URL="${CONNECT_URL:-http://localhost:8083}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Kafka Connect 헬스 대기: ${CONNECT_URL}"
until curl -sf "${CONNECT_URL}/connectors" >/dev/null; do
  sleep 2
done

register() {
  local file="$1"
  local name
  # 최상위 "name" 추출(config 서브객체엔 name 키가 없어 첫 매치가 곧 커넥터명이다).
  name="$(grep -m1 -oE '"name"[[:space:]]*:[[:space:]]*"[^"]+"' "${file}" | sed -E 's/.*"([^"]+)"$/\1/')"
  if [ -z "${name}" ]; then
    echo "!! name 을 파싱하지 못함: ${file}" >&2
    return 1
  fi
  echo "==> 커넥터 등록: ${name}"

  # 멱등: 이미 있으면 삭제하고 재생성한다(위 헤더의 재실행 안전성 근거).
  if curl -sf -o /dev/null "${CONNECT_URL}/connectors/${name}"; then
    curl -s -o /dev/null -X DELETE "${CONNECT_URL}/connectors/${name}"
    # Connect 가 삭제를 반영할 시간(재생성 409 회피).
    sleep 1
  fi

  # 파일 전체({name, config})를 POST 한다.
  local code
  code="$(curl -s -o /tmp/fc-connect-resp.json -w '%{http_code}' -X POST \
    -H "Content-Type: application/json" --data @"${file}" "${CONNECT_URL}/connectors")"
  echo " [HTTP ${code}] ${name}"
  if [ "${code}" != "201" ] && [ "${code}" != "200" ]; then
    echo "!! 등록 실패 응답:" >&2
    cat /tmp/fc-connect-resp.json >&2 || true
    echo >&2
    return 1
  fi
}

register "${DIR}/connectors/debezium-mysql-source.json"
register "${DIR}/connectors/elasticsearch-sink.json"

echo "==> 등록된 커넥터 상태:"
curl -sf "${CONNECT_URL}/connectors?expand=status" || true
echo
