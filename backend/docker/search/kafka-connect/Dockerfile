# EPIC-SEARCH(FC-107): Kafka Connect 런타임(search-spec §12.1).
#   베이스 debezium/connect 는 Debezium MySQL source 를 이미 포함한다. 여기에 Confluent ES sink 커넥터를 추가한다.
#   confluent-hub-client 로 kafka-connect-elasticsearch 플러그인을 플러그인 경로에 설치한다.
#   ★ 빌드 시 인터넷(Confluent Hub) 접근이 필요하다. 폐쇄망이면 커넥터 zip 을 사전 다운로드해 COPY + unzip 으로 대체한다.
FROM quay.io/debezium/connect:2.7

# Debezium 이미지의 커넥터 플러그인 경로.
ENV KAFKA_CONNECT_PLUGINS_DIR=/kafka/connect

USER root
RUN mkdir -p /kafka/connect/confluent-elasticsearch \
    && curl -fsSL -o /tmp/es-sink.zip \
       "https://d1i4a15mxbxib1.cloudfront.net/api/plugins/confluentinc/kafka-connect-elasticsearch/versions/14.1.2/confluentinc-kafka-connect-elasticsearch-14.1.2.zip" \
    && unzip -q /tmp/es-sink.zip -d /tmp/es-sink \
    && cp -r /tmp/es-sink/*/lib/* /kafka/connect/confluent-elasticsearch/ \
    && rm -rf /tmp/es-sink.zip /tmp/es-sink
USER kafka
