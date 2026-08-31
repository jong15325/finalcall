---
id: EPIC-HOME-MARKET-RECOMMEND
type: epic
jira_key: KAN-462
title: 홈 오늘의 추천 마켓 실데이터화
state: done
children: [FC-408, FC-409, FC-410, FC-411, FC-412, FC-413, FC-414, FC-415, FC-416]
gate: null
---
## 목표
- 홈의 자리표시자였던 `오늘의 추천 마켓 아이템`을 공개 실데이터 추천 6개로 교체한다.
- 개인화나 인기처럼 증명할 수 없는 표현 없이 신규·마감 임박·검증 판매자라는 추천 근거를 함께 제공한다.

## 게이트1 승인 (2026-08-31, 사용자)
- 기본 구성: 신규 3 + 24시간 이내 마감 임박 2 + 완료 판매 5회 이상 판매자 1.
- 후보 부족분은 일반 최신 매물로 보충하고, 동일 판매자·동일 아이템 쏠림을 억제한다.
- 계약 확정 후 백엔드와 프론트를 병렬 구현하고, 새 주요 UI는 디자인 게이트를 선행한다.

## 분해안
- FC-408: 추천 규칙·공개 API 계약·성능 경계 확정 및 게이트2 상신 — architect
- FC-409: 추천 후보 조회·조립 API 구현 — backend-impl
- FC-410: 추천 API 타입·쿼리 훅 구현 — frontend-impl
- FC-411: 추천 카드·이유 배지 dev-only 워크벤치 디자인 게이트 — frontend-impl
- FC-412: 홈 추천 자리표시자 실데이터 섹션 전환 — frontend-impl
- FC-413: 계약·성능·접근성·구매 후 갱신 통합 리뷰 — reviewer
- FC-414: 최신 추천 복합 인덱스와 실행계획 검증 — backend-impl
- FC-415: 공개 추천 API 게이트웨이 rate limit — backend-impl
- FC-416: V29 온라인 DDL 배포 runbook — architect

## 범위 밖
- 사용자 행동 기반 개인화, 조회수·찜·전환 기반 인기순, 기준가격 대비 가격 매력 추천.

## 추가 성능 게이트2 승인 (2026-08-31, 사용자)
- `ix_shop_status_created_at_id(status, created_at, id)` 인덱스 1개를 추가한다.
- 신규·GENERAL 최신 후보의 전체 scan·정렬을 제거하고 실행계획을 재검증한다.
- 검증 판매자 쿼리와 무캐시 정책은 유지하며 대규모 재측정에서 후속 판단한다.

## 보안 게이트2 승인 (2026-08-31, 사용자)
- 공개 추천 GET에 IP당 초당 1회, burst 10, 요청당 1토큰의 전용 게이트웨이 rate limit을 적용한다.
- Redis limiter 장애 시 fail-closed 성격을 유지하고 추천 섹션 오류 격리로 처리한다.
- V29 온라인 DDL의 사전 점검·중단·검증·append-only rollback 절차를 재사용 runbook으로 기록한다.

## 완료 직전 검증
- reviewer 최종 재검토 PASS, critical·major·minor 0건.
- 온디맨드 보안 최종 재검토 PASS, critical·major·minor 0건.
- 게이트3 사용자 Done 승인과 커밋 승인 대기.

## 게이트3 Done 승인 (2026-08-31, 사용자)
- FC-408~416 전건 review_status=passed 후 Done 전환.
- atomic commit 3건 승인, push는 사용자 직접 수행.
