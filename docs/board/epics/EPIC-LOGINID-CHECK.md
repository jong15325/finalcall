---
id: EPIC-LOGINID-CHECK
type: epic
jira_key: KAN-185
title: 회원가입 아이디(loginId) 라이브 중복확인 (준비중 placeholder 교체)
state: done
children: [FC-165, FC-166, FC-167, FC-168]
gate: null
---

> **에픽 완료(2026-07-30)**: 전 자식 done, reviewer PASS(FC-168 · critical/major/minor 0 · 게이트웨이 배선 처음부터 포함으로 MAJOR-1 재발 없음). 커밋 `0367fe0`(FC-165 spec)·`31f080f`(FC-166 백엔드+게이트웨이)·`e448ce7`(FC-167 프론트). 프론트는 닉네임/아이디 공용 `AvailabilityCheck` 일반화. push는 사용자 직접.

## 목표
회원가입 화면 아이디(loginId) 필드의 "준비 중" 비활성 placeholder를 **라이브 중복확인으로 교체**한다. 닉네임(EPIC-NICKNAME-UX)과 동일 패턴을 미러. loginId는 로그인 자격증명(유일)이라 사전 중복확인 UX 가치가 크다.

## 분해 (병렬)
FC-165 계약(architect) → 백엔드 **FC-166** ∥ 프론트 **FC-167**(계약 확정 후 동시, 파일 무교차) → **FC-168** 리뷰.

## 제약·재사용·교훈
- 닉네임 엔드포인트(`/auth/nickname/availability`)·프론트 라이브 확인 UX를 **패턴 그대로 재사용**.
- 판정=기존 loginId 존재 검사(`existsByLoginId…AndIsDeletedFalse` 등) 재사용. 유니크 제약·검사 로직 무변경.
- **MAJOR-1 재발 방지**: 새 auth 엔드포인트는 **게이트웨이 `auth-rate-limited` 라우트 등재를 계약(FC-165) DoD에 처음부터 포함**(FC-161 교훈). backend(FC-166)가 게이트웨이 predicate에 경로 추가까지 수행.
- 보안: 아이디 열거(enumeration)는 닉네임과 동일 성격 — reviewer(FC-168)가 게이트웨이 배선·응답 최소화 확인.
