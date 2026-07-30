---
id: EPIC-NICKNAME-UX
type: epic
jira_key: KAN-179
title: 닉네임 UX 개선 (라이브 중복확인 + 소셜 랜덤 꼬리표)
state: done
children: [FC-160, FC-161, FC-162, FC-163]
gate: null
---

> **에픽 완료(2026-07-30)**: 전 자식 done, reviewer PASS(FC-163 · 1차 MAJOR-1 게이트웨이 rate-limit → 재작업 → 재검증 PASS · critical/major 0). 커밋 `493f063`(FC-160 spec)·`6f3db69`(FC-161 백엔드+게이트웨이)·`6186ff9`(FC-162 프론트). push는 사용자 직접.
> **후속(별건)**: FC-164 oauth rate-limit 즉시수정 · loginId 라이브 중복확인(준비중 placeholder 교체) — 사용자 승인(2026-07-30).

## 목표
닉네임 **유니크는 유지**(FC-159 결정 B)하되, 두 UX를 개선한다.
1. **회원가입 라이브 중복확인**: 현 비활성 "중복확인" placeholder를 실동작으로(입력→버튼→가용성 조회→즉시 피드백). 제출 시 서버 검증(AUTH_002)은 유지.
2. **소셜 최초가입 랜덤 닉네임**: 카카오·네이버 최초가입 시 닉네임을 **provider 표시명 + 항상 랜덤 꼬리표**(예: `홍길동_A3F9`)로 부여. 가입 후 사용자가 변경 가능(기존 PATCH /api/v1/me).

## 결정 근거
FC-159 게이트2: A(유니크 해제) 잠정→철회, **B(유니크 유지)** 확정(닉네임은 판매자 이름 등 표시 노출 → 유일 핸들). 후속 개선 2건은 사용자 게이트1 승인(2026-07-30).

## 분해 (병렬)
FC-160 계약(architect) → 백엔드 **FC-161** ∥ 프론트 **FC-162**(계약 확정 후 동시, 파일 무교차) → **FC-163** 리뷰(인증 영역 + 닉네임 열거 점검).

## 제약·재사용
- **유니크 제약·중복검사 로직 무변경**(nickname_active UK 유지). 이 에픽은 가용성 조회 API 추가 + 소셜 부여 방식만 손댐.
- 재사용: `existsByNicknameAndIsDeletedFalse`(가용성 조회), 기존 소셜 find-or-create 흐름·`SocialAccountRegistrar`.
- 보안: 가용성 조회 엔드포인트의 **닉네임 열거** 노출을 reviewer가 점검(닉네임은 공개 표시값이라 민감도 낮으나 남용·rate limit 관점 확인). 게이트웨이 rate limit 정합.
