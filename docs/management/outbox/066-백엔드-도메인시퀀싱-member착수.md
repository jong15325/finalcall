상태: SENT
# [총괄 → 백엔드] 작업 지시: 다음 도메인 순서 지정 — member/잔액 착수 (D-074 시퀀싱)

## 목표
auth(G4-1) 다음 도메인으로 **member/잔액**을 착수한다. ON-HOLD 3종과 무관한 선행 구간이라 사용자 결정을 기다리지 않고 진행 가능하다(D-028 의존 없는 작업 pull).

## 순서 지정 (D-074)
전체 도메인 순서 = member/잔액 → 화폐(충전·교환) → item → auction/shop → 마감인프라 → bid → sale_order.
이 중 **지금 착수 = member/잔액만**. 화폐 이하는 아래 게이트에 걸린다.

## 착수 범위 (member/잔액)
- 회원 계정 도메인: 프로필 조회·수정, 탈퇴(soft delete) 등 계약 §2 이후 회원 관련 조항.
- 잔액: balance 엔티티·리포지토리(V3 user_and_balance 스키마 기반), 잔액 조회. 홀드/차감 로직의 구조적 골격까지(실제 충전 유입은 화폐 도메인).
- 컨벤션: CLAUDE.md §5 도메인 코드 컨벤션 + §7 스타일. notice 참조 구현 준수. DoD=계약+컨벤션+테스트+빌드.

## 게이트 (착수 금지 — 선행 확정 전)
- 화폐(교환): 캐시↔게임머니 **교환비율 ON-HOLD** 확정 전 착수 금지.
- item(시드): **아이템 시드 데이터 ON-HOLD** 확정 전 시드 확정 금지(엔티티 구조는 이후 지시 시).
- settlement: **수수료·정산 정책 ON-HOLD** 확정 전 착수 금지.
- 위 3종은 사용자 결정 대기 중. 확정되면 총괄이 순차 지시한다.

## 병행 후속 (계약 v1.3, 065)
- 게이트웨이 커스텀 에러 핸들러(GATEWAY_429 + Retry-After / GATEWAY_403)를 v1.3 §1.6에 맞춰 구현. member 도메인과 독립이라 병행 가능. 착수 시점은 자율(member 우선 권장).

## 의존
- 확정 스펙: domain-spec v0.4 · erd v0.5 · api-contract v1.3. 모두 착수 가능(선행 확정됨).
- QA: member 시나리오는 QA(Q)가 도메인 완료 후 설계. 고위험 아님 → 백엔드 dev 테스트 그린으로 게이트 판정 가능(D-078).

## 하지 말 것
- 화폐/item/settlement 선행 착수(위 게이트). 계약 변경(6절 요청). 임의 도메인 순서 변경.

## 관련
- docs/erd.md v0.5(§ member/balance) · docs/api-contract.md v1.3 · docs/domain-spec.md v0.4
- CLAUDE.md §5·§7 · notice 참조 구현 · backend/decision-log B-015~027

회신: 필요 — member/잔액 구현 계획(작업 단위 분해 + Claude Code 프롬프트 세트) 완료 보고.
신규 발번 ID: 없음 (D-074 시퀀싱 집행 — 순서 지정은 총괄 자율, 신규 D 미발번)
