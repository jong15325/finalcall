#!/usr/bin/env bash
set -euo pipefail

mode="${1:-diagnostic}"
fixture="${CHAT_FIXTURE_FILE:?CHAT_FIXTURE_FILE is required}"
output_dir="${CHAT_RESULT_DIR:?CHAT_RESULT_DIR is required}"
k6_bin="${K6_BIN:-k6}"
base_urls="${CHAT_BASE_URLS:-http://localhost:18090,http://localhost:18091}"

mkdir -p "$output_dir"

verify_wiring() {
    grep -Eq 'noConnectionReuse:[[:space:]]*false' scripts/chat/k6-chat-load.js || {
        echo "LOAD_WIRING_FAILED: k6 keep-alive가 활성화되어야 합니다." >&2
        exit 1
    }
    python3 - "$fixture" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    users = json.load(source).get("users", [])
client_ips = [user.get("clientIp") for user in users]
if len(client_ips) < 2 or any(not isinstance(ip, str) or not ip for ip in client_ips):
    raise SystemExit("LOAD_WIRING_FAILED: 모든 fixture에 clientIp가 필요합니다.")
if len(set(client_ips)) < 2:
    raise SystemExit("LOAD_WIRING_FAILED: fixture clientIp는 2개 이상으로 분산되어야 합니다.")
PY
}

verify_prewarm() {
    local summary="$1"
    python3 - "$summary" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    summary = json.load(source)

checks = summary.get("root_group", {}).get("checks", {})
required = ("message write 201", "ApiResponse data 존재")
for name in required:
    check = checks.get(name)
    if check is None or check.get("fails") != 0 or check.get("passes", 0) < 5:
        raise SystemExit(f"prewarm 응답 검증 실패: {name}")
PY
}

run_prewarm() {
    local name="$1" gateway="$2"
    local summary="$output_dir/$name.json"
    "$k6_bin" run --no-thresholds --summary-export "$summary" \
        -e CHAT_FIXTURE_FILE="$fixture" \
        -e CHAT_BASE_URLS="$gateway" \
        -e CHAT_FORWARD_CLIENT_IP=true \
        -e CHAT_MODE=sustained \
        -e CHAT_SUSTAINED_RATE=2 \
        -e CHAT_SUSTAINED_DURATION=5s \
        -e CHAT_SUSTAINED_PRE_VUS=2 \
        -e CHAT_SUSTAINED_MAX_VUS=10 \
        scripts/chat/k6-chat-load.js
    verify_prewarm "$summary"
}

run_sustained() {
    local name="$1" rate="$2" duration="$3" pre_vus="$4" max_vus="$5"
    "$k6_bin" run --summary-export "$output_dir/$name.json" \
        -e CHAT_FIXTURE_FILE="$fixture" \
        -e CHAT_BASE_URLS="$base_urls" \
        -e CHAT_FORWARD_CLIENT_IP=true \
        -e CHAT_MODE=sustained \
        -e CHAT_SUSTAINED_RATE="$rate" \
        -e CHAT_SUSTAINED_DURATION="$duration" \
        -e CHAT_SUSTAINED_PRE_VUS="$pre_vus" \
        -e CHAT_SUSTAINED_MAX_VUS="$max_vus" \
        scripts/chat/k6-chat-load.js
    verify_sustained "$output_dir/$name.json"
}

verify_sustained() {
    local summary="$1"
    python3 - "$summary" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    metrics = json.load(source).get("metrics", {})
dropped_metric = metrics.get("dropped_iterations", {})
dropped = dropped_metric.get("values", dropped_metric).get("count", 0)
checks_metric = metrics.get("checks", {})
checks = checks_metric.get("values", checks_metric)
write_metric = metrics.get("chat_write_success", {})
write_success = write_metric.get("values", write_metric)
duration_metric = metrics.get("chat_write_duration", {})
duration = duration_metric.get("values", duration_metric)
if dropped != 0:
    raise SystemExit(f"LOAD_THRESHOLD_FAILED: scheduled iteration drop={dropped}")
write_passes = write_success.get("passes")
write_fails = write_success.get("fails")
write_rate = write_success.get("rate", write_success.get("value"))
write_is_complete = (
    write_fails == 0 and write_passes is not None and write_passes > 0
) if write_fails is not None else write_rate == 1
checks_are_complete = (
    checks.get("fails") == 0
    and checks.get("passes") is not None
    and checks.get("passes") > 0
)
if not checks_are_complete or not write_is_complete:
    raise SystemExit("LOAD_THRESHOLD_FAILED: HTTP 201 성공률은 100%여야 합니다.")
if duration.get("p(95)", float("inf")) >= 200 or duration.get("p(99)", float("inf")) >= 500:
    raise SystemExit("LOAD_THRESHOLD_FAILED: REST p95/p99 기준을 초과했습니다.")
PY
}

IFS=',' read -r -a gateways <<< "$base_urls"
if [[ "${#gateways[@]}" -ne 2 || -z "${gateways[0]}" || -z "${gateways[1]}" ]]; then
    echo "CHAT_BASE_URLS에는 두 gateway가 필요합니다." >&2
    exit 2
fi
verify_wiring
run_prewarm prewarm-gateway-1 "${gateways[0]}"
run_prewarm prewarm-gateway-2 "${gateways[1]}"

run_sustained smoke-10s 10 10s 30 100

if [[ "$mode" == "diagnostic" ]]; then
    exit 0
fi
if [[ "$mode" != "extended" ]]; then
    echo "지원하지 않는 실행 mode입니다." >&2
    exit 2
fi

run_sustained release-50s 50 30s 100 400
run_sustained release-150s 150 30s 300 1200
run_sustained release-300s 300 30s 600 2400

run_sustained sustained-300s-5m 300 5m 600 2400

"$k6_bin" run --summary-export "$output_dir/burst-1000s-60s.json" \
    -e CHAT_FIXTURE_FILE="$fixture" \
    -e CHAT_BASE_URLS="$base_urls" \
    -e CHAT_FORWARD_CLIENT_IP=true \
    -e CHAT_MODE=burst \
    -e CHAT_BURST_RATE=1000 \
    -e CHAT_BURST_DURATION=60s \
    -e CHAT_BURST_PRE_VUS=2000 \
    -e CHAT_BURST_MAX_VUS=6000 \
    scripts/chat/k6-chat-load.js
verify_sustained "$output_dir/burst-1000s-60s.json"

run_socket() {
    local name="$1" vus="$2" duration="$3"
    "$k6_bin" run --summary-export "$output_dir/$name.json" \
        -e CHAT_FIXTURE_FILE="${CHAT_SOCKET_FIXTURE_FILE:?CHAT_SOCKET_FIXTURE_FILE is required for extended mode}" \
        -e CHAT_BASE_URLS="$base_urls" \
        -e CHAT_WS_URLS=ws://localhost:18090/ws/chat,ws://localhost:18091/ws/chat \
        -e CHAT_FORWARD_CLIENT_IP=true \
        -e CHAT_MODE=socket \
        -e CHAT_SOCKET_VUS="$vus" \
        -e CHAT_SOCKET_DURATION="$duration" \
        -e CHAT_SOCKET_HOLD="$duration" \
        scripts/chat/k6-chat-load.js
}

run_socket socket-100-30s 100 30s
run_socket socket-1000-30s 1000 30s
run_socket socket-5000-30s 5000 30s
run_socket socket-20000-10m 20000 10m
