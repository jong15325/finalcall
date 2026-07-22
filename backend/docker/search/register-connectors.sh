#!/usr/bin/env bash
# EPIC-SEARCH(FC-107): Kafka Connect REST 로 Debezium source + ES sink 커넥터를 등록한다(search-spec §12.1·§12.3).
#   멱등: PUT /connectors/{name}/config 로 등록/갱신을 겸한다(재실행 안전).
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
  name="$(python -c "import sys,json;print(json.load(open(sys.argv[1]))['name'])" "${file}" 2>/dev/null \
        || grep -o '"name"[^,]*' "${file}" | head -1 | cut -d'"' -f4)"
  echo "==> 커넥터 등록: ${name}"
  # config 서브객체만 PUT 한다(멱등 upsert). 전체 파일에서 .config 를 추출.
  python - "$file" "$CONNECT_URL" "$name" <<'PY'
import json, sys, urllib.request
path, connect_url, name = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = json.load(open(path))["config"]
data = json.dumps(cfg).encode()
req = urllib.request.Request(f"{connect_url}/connectors/{name}/config",
                             data=data, method="PUT",
                             headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req) as r:
    print(f" [{r.status}] {name}")
PY
}

register "${DIR}/connectors/debezium-mysql-source.json"
register "${DIR}/connectors/elasticsearch-sink.json"

echo "==> 등록된 커넥터 상태:"
curl -sf "${CONNECT_URL}/connectors?expand=status" || true
echo
