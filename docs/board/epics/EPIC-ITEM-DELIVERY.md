---
id: EPIC-ITEM-DELIVERY
type: epic
jira_key: KAN-210
title: 게임 아이템 지급 연동 (웹 우편함 다리)
state: doing
children: [FC-185, FC-186, FC-187, FC-188, FC-189, FC-190, FC-191, FC-192, FC-193]
gate: null
---

> **게이트1 승인(2026-08-05)**: 분해안 7티켓 그대로 확정. 순서 = FC-185(계약) → FC-186(스키마) → {FC-187→FC-189, FC-188}(백엔드 직렬, 정산영역 파일 겹침) ∥ FC-190(프론트, 계약 후 병렬) → FC-191(리뷰).

## 목표
장터에서 낙찰(SOLD)·즉시구매(BUYNOW)한 아이템을 **웹측 우편함(다리)**까지 완성한다. 게임이 실제로 받아가는 실이식(claim 구현·boundary 번역)은 게임 서버 조정 단계(후속 별건)로 분리한다. 계획 정본 = `docs/spec/proposals/game-item-delivery-proposal-v0.1.md`(FC-185에서 확정 spec으로 승격).

## 설계 요지 (게이트2 확정 G1~G7)
- **G2 우편함 = 하이브리드**: DB(`item_delivery`)가 내구 정본, Redis는 best-effort 알림(폴링 제거)만. 순수 Redis 기각(증발·이중쓰기·장애전파, bid-spec §8 정신).
- **G3 enqueue 원자성**: 배송 생성을 정산 TX와 **같은 TX**(SettlementRecorder 공통 꼬리)에 넣어 소유이전과 exactly-once 결합.
- **G4 claim 멱등**: 상태 CAS(PENDING→CLAIMED→APPLIED) + 리스 재청구(at-least-once) + `item_uuid` UK(exactly-once 효과). ★ 게임측 claim 구현은 후속, 이번엔 DB 프로토콜/계약만 확정.
- **G5 소유 이동**: 배송 성공 시 item_instance는 "게임 이관됨"으로 전이, 웹↔게임 이중 존재·재판매 차단.
- **G6 실패 회수**: 만실(확장 상한 96 도달)·타임아웃 시 우편함 안전 보관·멱등 재시도, **금전 미역전**(판매 완결 I-H 보존).
- **G1 배치**: B-지금(크로스-스키마, new_sp 유지) / A-목표(완전 통합은 별도 에픽). 우편함이 점진 이관 seam.
- **웹 먼저·게임 나중**: 게임 서버 재컴파일 가능·클라 고정 → 웹측 코어 완성 후 게임 서버를 웹에 맞춤. boundary 번역(−1·스킬 패킹·usr_id 매핑)은 전적으로 게임 서버 소속.

## 분해 (7티켓)
| 티켓 | owner | 내용 | 의존 | 병렬 |
|---|---|---|---|---|
| FC-185 | architect | 계약 정본화 — delivery-domain-spec 신규 + erd(item_delivery) + api-contract(배송상태 조회·게임 claim DB 프로토콜) + item_instance 이관 상태축 형상 확정 | — | — |
| FC-186 | backend-impl | 우편함 스키마 — item_delivery 테이블 + Flyway V21 + 엔티티/리포지토리 | FC-185 | — |
| FC-187 | backend-impl | 정산 TX 내 enqueue — SettlementRecorder 꼬리에 배송 1행 INSERT(낙찰+즉시구매) | FC-186 | 직렬 |
| FC-188 | backend-impl | 소유 이동 + 재판매 차단 + 실패 안전보관(G5·G6) | FC-186 | 직렬 |
| FC-189 | backend-impl | Redis best-effort 알림(커밋 후 신호 발행) | FC-187 | 직렬(FC-187 후) |
| FC-190 | frontend-impl | 배송 상태 UI — 구매자 인벤/구매내역 "게임으로 배송중/도착" 표시 | FC-185 | ∥(백엔드와 파일 무교차) |
| FC-191 | reviewer | 통합 리뷰 — 정산 TX 원자성·멱등·동시성 중점 | 위 전부 | — |

- **게이트2 재확인(FC-185에서 확정)**: (a) item_instance "게임 이관됨" 상태 표현 = enum 확장 vs 별도 배송 상태축. (b) 게임 claim = DB 직접 프로토콜(웹 API 아님) 확정.
- **범위 밖(후속 별건)**: 게임 서버 claim 실이식·boundary 포맷터·user_item.itm_uuid UK 신설 / 게임 살아있는 인벤토리 통째 이전(완전 통합 A) / 역방향 출품(게임→장터) / 장착(user_equipments) 연동.
- **보안 층(경매 에픽 골격)**: 커밋 보안 리뷰 warn-only, reviewer 확인소, 에픽 완료 직전 온디맨드 `/security-review` 1회. 정산 TX·멱등이 최고위험 → 필요 시 end-of-turn 리뷰 한시 on.
