#!/usr/bin/env bash
set -euo pipefail

app1_metrics="${1:?app1 metrics path is required}"
app2_metrics="${2:?app2 metrics path is required}"
consumer_members="${3:?consumer members path is required}"
metric_name='chat_kafka_consumer_lag_collection_age_seconds'

count_metric() {
    local file="$1"
    grep -c -E "^${metric_name}(\\{|[[:space:]])" "$file" || true
}

app1_count="$(count_metric "$app1_metrics")"
app2_count="$(count_metric "$app2_metrics")"
if (( app1_count != 1 || app2_count != 0 )); then
    echo "TOPOLOGY_FAILED: active monitor metric은 app1=1/app2=0이어야 합니다. actual=app1:$app1_count app2:$app2_count" >&2
    exit 1
fi

consumer_count="$(awk '$1 == "finalcall-chat-fanout-v1" {print $2}' "$consumer_members" | sort -u | wc -l)"
if (( consumer_count != 2 )); then
    echo "TOPOLOGY_FAILED: active Kafka consumer는 2개여야 합니다. actual=$consumer_count" >&2
    exit 1
fi
