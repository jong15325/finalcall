---
id: EPIC-CURRENCY
type: epic
jira_key: KAN-9
title: 화폐 — 잔액 원자적 증감 + 캐시↔게임머니 교환 (계약 4.4절)
state: done
children: [FC-007, FC-008, FC-009, FC-010]
gate: null
---
## 목표
- `UserBalance` 원자적 증감(D-008) 구현 + 캐시↔게임머니 교환(`POST /exchanges`). 계약 4.4절, erd `user_balance`·`money_exchange`.
- 제외: **충전(토스 test 결제)은 별도 EPIC-CHARGE**(외부 연동·시크릿). 홀드/해제 실사용은 입찰 도메인(메서드는 FC-008에서 구현).

## 분해안 (게이트1 승인)
- FC-007 architect: 계약 4.4/erd 검증 + 교환비율 저장 기전 확정(gate2)
- FC-008 backend-impl: UserBalance 원자적 증감(addCash/addGameMoney/hold/release, D-008)
- FC-009 backend-impl: 교환(money_exchange + V5 + POST /exchanges + EXC_001/002)
- FC-010 reviewer: 화폐 통합 리뷰

의존: FC-007 → FC-008 → FC-009 → FC-010
결정: **교환비율 = 1 캐시 = 1,000,000 게임머니**, 추후 변경 가능(DB 추적표 또는 옵션 — 기전은 FC-007 확정). 각 교환은 applied_rate 스냅샷 기록.
비고: FC-008(잔액 원자화)은 교환·충전·입찰(홀드)·정산이 공통으로 쓰는 핵심 기반.

## 완료 (게이트3, 2026-07-17)
- 전 하위 done + FC-010 통합 리뷰 passed(critical/major 0, minor 3) + 위임 승인. 빌드·테스트 그린(reviewer 재확인).
- **원격 push됨**(`4239e38`, 사용자 직접). 후속: minor 1 위생 티켓(FC-011, cashAmount 상한) 백로그로 분리.
