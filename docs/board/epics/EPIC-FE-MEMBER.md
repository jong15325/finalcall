---
id: EPIC-FE-MEMBER
type: epic
jira_key: KAN-14
title: 프론트 — 내 계정(auth + 마이페이지 + 잔액 표시) 실구현
state: done
children: [FC-012, FC-013, FC-014, FC-015, FC-016]
gate: null
---
## 목표
- 프론트 스켈레톤의 placeholder/stub을 백엔드 확정 계약(§2 auth·§2.5 member·§4.4 balance)에 맞춘 **실구현**으로 대체.
- 범위(게이트1 승인, 안 A): auth 실구현(로그인·회원가입·로그아웃) + 마이페이지(프로필 조회·닉네임 수정·탈퇴) + 잔액 표시(GET /me/balance).
- 제외: 충전(EPIC-CHARGE)·교환(EPIC-CURRENCY 백엔드 완료, 프론트 UI는 별도 wallet 에픽)·타인 프로필·비밀번호 변경.

## 분해안 (게이트1 승인 2026-07-17)
- FC-012 architect: 프론트 계약 정합(사본 D-030, v1.5) + 화면 spec + API 함수층/상태 매트릭스 설계. 디자인 게이트 입력.
- FC-013 frontend-impl: auth 실구현(POST /auth/login·signup·logout, AUTH_001/002/003, stub 제거). 디자인 게이트.
- FC-014 frontend-impl: 마이페이지(GET/PATCH/DELETE /me, MEMBER_001/002, COMMON_005). 디자인 게이트.
- FC-015 frontend-impl: 잔액 표시(GET /me/balance — 캐시·게임머니·홀드·가용).
- FC-016 reviewer: 통합 리뷰(보안·접근성·QA).

의존: FC-012 → (FC-013 ∥ FC-014 ∥ FC-015) → FC-016
파이프라인: architect → **디자인 게이트(새 화면: 로그인·가입·마이페이지)** → frontend-impl 팬아웃(쓰기파일 무교차 검증 후) → reviewer → Done.
비고: 스켈레톤 재사용 — lib/api/client(401 회전)·authStore·레이아웃 4종·feedback 컴포넌트. login/signup은 stub 세션 대체.
