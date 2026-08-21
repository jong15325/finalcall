---
id: EPIC-CHAT
type: epic
jira_key: KAN-359
title: 사용자 간 실시간 채팅 설계 및 구현
state: doing
children: [FC-316, FC-317, FC-318, FC-319, FC-320, FC-321, FC-322, FC-323, FC-324, FC-325, FC-326, FC-327, FC-328, FC-329, FC-330, FC-331, FC-332, FC-333, FC-334, FC-335, FC-336, FC-337, FC-338]
gate: null
---

## 목표
- 기존 Redis·Kafka 인프라를 활용해 사용자 간 실시간 채팅의 계약, 저장, 전달, 장애 복구, 보안 모델을 확정한다.
- 보유한 Vuexy 채팅 페이지를 실제 FinalCall AppShell 안에서 동일한 구조로 재사용해 구현 전 화면 계약을 검증한다.

## 하위 티켓과 의존
- FC-316: 채팅 도메인·실시간 전송·저장·보안·확장 아키텍처와 계약 설계.
- FC-317: Vuexy 채팅 페이지 기반 dev-only 디자인 워크벤치 구성. FC-316과 파일 쓰기 범위가 달라 병렬 진행한다.
- FC-318: DB migration/entity/repository와 방별 sequence·멱등 동시성 코어.
- FC-319: REST controller/service/DTO/ErrorCode 계약 구현.
- FC-320: WebSocket/STOMP 인증·인가·Gateway·Redis 실시간 fan-out.
- FC-321: outbox·Debezium connector·Kafka fallback.
- FC-322: Vuexy 기준 frontend REST/STOMP client와 replay/dedup UI.
- FC-323: 멀티노드·장애·용량·성능 검증.
- FC-324: 전체 구현 보안·QA·접근성 reviewer 최종 판정.
- FC-325: 실시간 세션 병목·Gateway IP 제한·JWT 종료·공유비밀 보강.
- FC-326: 신고 원자 quota와 retention worker 구현.
- FC-327: Kafka/Connect 관측성과 실제 장애 복구 검증.
- FC-328: 프론트 역순/gap/unread·오프라인·접근성 정합화.
- FC-329: 20k socket·300/s·1,000/s 성능 재검증.
- FC-330: 무수신 fan-out의 DB 접근 제거와 eventId 중복 hydrate 방지.
- FC-331: 부하 fixture 인증 요청에 사용자별 통제 IP 헤더 적용.
- FC-332: outbox retention·pipeline 관측 인덱스 계약 보정.
- FC-333: outbox retention 인덱스 V27 migration과 회귀 검증.
- FC-334: commit 후 Redis fast-path 비동기 전달·백프레셔·메트릭 계약 보정.
- FC-335: 전용 bounded executor 기반 Redis fast-path 구현과 회귀·성능 검증.
- FC-336: 동일 eventId Kafka replay의 중복 전달을 기대하는 통합 테스트 계약 보정.
- FC-337: 독립 Linux CI에서 채팅 2-node 단기 성능 단계를 재현하는 수동 workflow 구성.

## 게이트
- 게이트1: 2026-08-18 사용자 승인 완료.
- 게이트2: 2026-08-18 권고안 6건 사용자 승인 완료.
- 게이트2: 2026-08-20 Redis fast-path를 전용 bounded executor로 분리하는 권고안 A 사용자 승인 완료.
- 디자인 게이트: 2026-08-18 Vuexy 기반 `/__design/chat` 1안 사용자 승인 완료.
- 게이트3: 구현·reviewer·온디맨드 보안 리뷰 후 사용자 Done·push 승인 필요.
