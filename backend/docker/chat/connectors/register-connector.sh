#!/bin/sh
set -eu

curl -fsS \
    -X PUT \
    -H "Content-Type: application/json" \
    --data-binary @/config/debezium-chat-outbox-config.json \
    http://chat-kafka-connect:8083/connectors/finalcall-chat-outbox-source/config
