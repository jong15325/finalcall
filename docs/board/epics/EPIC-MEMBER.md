---
id: EPIC-MEMBER
type: epic
jira_key: KAN-2
title: 회원 프로필·수정·탈퇴 (계약 2.5절)
state: doing
children: [FC-001, FC-002, FC-003, FC-004, FC-005]
gate: null
---
## 목표
- 회원 계정 생애주기 중 프로필 조회·수정·탈퇴를 구현한다(GET/PATCH/DELETE /me). 계약 api-contract 2.5절.
- 제외: UserBalance 증감 원자적 구현(화폐 도메인 별도 에픽), 프론트 화면(별도 프론트 에픽).

## 분해안 (게이트1 승인)
- FC-001 architect: 계약 2.5절 검증 + MEMBER_002 (A)안 정합 확인
- FC-002 backend-impl: MemberErrorCode(MEMBER_001/002)
- FC-003 backend-impl: RefreshTokenStore 세션 일괄 폐기
- FC-004 backend-impl: 프로필 3종 GET/PATCH/DELETE /me
- FC-005 reviewer: member 통합 리뷰

의존: FC-001 → (FC-002 ∥ FC-003) → FC-004 → FC-005
결정: MEMBER_002 = (A) 확장 지점 — 현재 gameMoneyHeld>0(홀드)만 차단, 경매·주문 체크는 해당 도메인 착수 시 확장(코드에 TODO 명시).
