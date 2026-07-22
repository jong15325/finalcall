# EPIC-SEARCH(FC-107): nori(analysis-nori) 를 구운 커스텀 Elasticsearch 이미지(search-spec §12.2).
#   ES 는 nori 를 기본 미동봉하므로 --batch 로 설치해 이미지에 고정한다(런타임 설치 취약성 회피).
#   userdict(게임 고유어 사용자 사전)도 config 에 동봉한다 — 사전 변경은 분석기 변경이라 재색인(alias 스위치)을 수반한다(§12.5·§12.6).
# 버전은 앱의 Elasticsearch Java 클라이언트(Spring Boot 관리)와 맞춘다(8.15.x).
FROM docker.elastic.co/elasticsearch/elasticsearch:8.15.3

RUN bin/elasticsearch-plugin install --batch analysis-nori

# userdict 를 nori 가 읽는 config 경로에 둔다. listings-index.json 의 nori_tokenizer.user_dictionary 가 이 상대경로를 참조한다.
COPY userdict_ko.txt config/userdict_ko.txt
