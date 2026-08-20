# EPIC-CHAT(FC-321): 채팅 outbox 전용 Connect runtime.
# 검색 worker의 Elasticsearch sink plugin/offset topic과 분리해 장애와 SMT 변경을 격리한다.
FROM quay.io/debezium/connect:2.7

ARG JMX_EXPORTER_VERSION=1.6.0
ARG JMX_EXPORTER_SHA256=a95983fd96e865d2bcdf911cc500e7c82808c27ab9fd226bf96732b6c3d8c46e

RUN mkdir -p /kafka/jmx \
    && curl -fsSL \
        "https://github.com/prometheus/jmx_exporter/releases/download/${JMX_EXPORTER_VERSION}/jmx_prometheus_javaagent-${JMX_EXPORTER_VERSION}.jar" \
        -o /kafka/jmx/jmx_prometheus_javaagent.jar \
    && echo "${JMX_EXPORTER_SHA256}  /kafka/jmx/jmx_prometheus_javaagent.jar" | sha256sum -c -

COPY --chown=kafka:kafka jmx-exporter.yml /kafka/jmx/config.yml
