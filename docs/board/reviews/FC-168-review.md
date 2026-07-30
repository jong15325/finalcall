---
ticket: FC-168
epic: EPIC-LOGINID-CHECK
reviewer: reviewer
date: 2026-07-30
verdict: PASS
blocking: []
scope: [FC-166(backend), FC-167(frontend)]
contract: docs/spec/api-contract.md §2 v1.18
---

# FC-168 통합 리뷰 — EPIC-LOGINID-CHECK (아이디 가용성 조회 + 준비중 placeholder 교체)

## 판정: PASS (critical/major/minor 0)
닉네임 에픽(FC-163) 미러로서 대칭 정확. FC-163에서 뒤늦게 잡혔던 게이트웨이 rate-limit 배선을 **이번엔 처음부터 포함**(MAJOR-1 재발 없음).

## 확인 결과 (축별)
1. **게이트웨이 배선(MAJOR-1 재발 방지) ✅**: `application.yml` `auth-rate-limited` predicate에 `/api/v1/auth/login-id/availability` 실제 등재(nickname 뒤). 라우트 순서상 catch-all `service-proxy`보다 먼저 매칭 → rate limit 실적용.
2. **정합성/QA ✅**: 경로·응답 형상(`ApiResponse<{available}>`)·advisory·400 errors[] 계약(§2 v1.18) 일치. 판정=`existsByLoginIdAndIsDeletedFalse`(signup과 동일 경로, 드리프트 없음). 최종권위 AUTH_001(409). 검증 `@NotBlank @Size(max=50)`(signup 동일). 유니크 제약·검사 무변경. 테스트 유닛2·통합4 커버.
3. **보안(아이디 열거) ✅**: signup AUTH_001이 이미 노출 → 순증분 0. 게이트웨이 rate limit·응답 최소화(boolean)·permitAll 정확경로. readOnly·advisory(TOCTOU는 signup UK 원자 방어).
4. **프론트 리팩터 회귀 ✅**: `NicknameCheck`→공용 `AvailabilityCheck`, `NicknameCheckButton`→`AvailabilityCheckButton` 일반화. 닉네임·아이디 양쪽 동작(FC-162 유지). advisory·접근성(aria-label 구분·aria-live·aria-invalid)·원문 미노출·색 토큰 회귀 없음.

## 후속 관찰 (비차단)
- loginId param 완전 누락 케이스는 통합 테스트 명시 없음(`@NotBlank` null 포착으로 400 보장). 다음 손볼 때 1건 추가 고려.
- 향후 loginId 정규화(trim/lowercase) 도입 시 조회·signup 동반 개정 필수(현재 둘 다 원문, 정합).

## 백엔드 설계 전달용 보고
- 판정 로직을 signup과 단일 메서드로 공유해 조회↔가입 드리프트 구조적 차단(닉네임 동일 패턴).
- 게이트웨이 동시 배선이 제도화됨 — 향후 permitAll 신설 auth 엔드포인트는 `auth-rate-limited` predicate 등재를 DoD에 명문화(자격증명/열거 민감 경로 특히).
