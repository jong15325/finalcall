#!/usr/bin/env bash
set -euo pipefail

mode="${1:-diagnostic}"
fixture="${CHAT_FIXTURE_FILE:?CHAT_FIXTURE_FILE is required}"
output_dir="${CHAT_RESULT_DIR:?CHAT_RESULT_DIR is required}"
k6_bin="${K6_BIN:-k6}"
base_urls="${CHAT_BASE_URLS:-http://localhost:18090,http://localhost:18091}"

mkdir -p "$output_dir"

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
}

run_sustained warmup-10s 10 10s 30 100
run_sustained diagnostic-50s 50 30s 100 400
run_sustained diagnostic-150s 150 30s 300 1200
run_sustained diagnostic-300s 300 30s 600 2400

if [[ "$mode" == "diagnostic" ]]; then
    exit 0
fi
if [[ "$mode" != "extended" ]]; then
    echo "지원하지 않는 실행 mode입니다." >&2
    exit 2
fi

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
