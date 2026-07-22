# EPIC-SEARCH(FC-107): Kafka Connect 런타임(search-spec §12.1).
#   베이스 debezium/connect 는 Debezium MySQL source 를 이미 포함한다. 여기에 Elasticsearch sink 커넥터를 추가한다.
#
#   ★ 소스 재지정(재검 후속): 최초엔 Confluent Hub CDN(d1i4a15mxbxib1.cloudfront.net)에서 받았으나 그 호스트가
#     이 네트워크에서 DNS 차단이라(curl: Could not resolve host) 빌드가 실패했다. 도달 가능한 오픈소스 대안인
#     Aiven elasticsearch-connector-for-apache-kafka(GitHub releases · Apache 2.0)로 재지정한다.
#     이 zip 은 커넥터 + 의존 jar 을 모두 동봉한 self-contained 배포라 별도 의존 수집이 불요하다.
#   기능 동등: Elasticsearch sink — key.ignore=false(_id=메시지키=public_id)·behavior.on.null.values=delete·
#     schema.ignore=true 지원. 문서를 _id 기준 색인(create-or-replace)해 §12.3 멱등 upsert 를 만족한다.
#     (Confluent 의 write.method 부분병합은 미지원 — connector JSON 주석 참조.)
FROM quay.io/debezium/connect:2.7

# Debezium 이미지의 커넥터 플러그인 경로.
ENV KAFKA_CONNECT_PLUGINS_DIR=/kafka/connect

USER root
RUN mkdir -p /kafka/connect/aiven-elasticsearch \
    && curl -fsSL -o /tmp/es-sink.zip \
       "https://github.com/Aiven-Open/elasticsearch-connector-for-apache-kafka/releases/download/v7.0.0/elasticsearch-connector-for-apache-kafka-7.0.0.zip" \
    && unzip -q /tmp/es-sink.zip -d /tmp/es-sink \
    && cp /tmp/es-sink/elasticsearch-connector-for-apache-kafka-7.0.0/*.jar /kafka/connect/aiven-elasticsearch/ \
    && rm -rf /tmp/es-sink.zip /tmp/es-sink
USER kafka
