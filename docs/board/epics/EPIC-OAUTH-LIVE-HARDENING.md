---
id: EPIC-OAUTH-LIVE-HARDENING
type: epic
jira_key: KAN-450
title: 카카오·네이버 OAuth 운영 활성화와 보안 보강
state: doing
children: [FC-397, FC-398, FC-399, FC-400, FC-401, FC-402, FC-403]
gate: null
---

## 목표
- 완료된 FinalCall OAuth 구현을 실제 카카오·네이버 앱 키로 운영 활성화하고 state 수명·복귀 경로·오류 UX·관측성을 보강한다.
- OnRace의 로그인 경험은 참고하되 NextAuth·Spring OAuth 이중화, URL 쿼리 토큰 전달, 검증되지 않은 provider 신원 신뢰는 도입하지 않는다.

## 승인된 범위
- 게이트1·게이트2 승인: 2026-08-25 사용자 지시 `구현 진행`, 키는 환경변수로 관리.
- 현행 SPA 주도 authorization code + 백엔드 교환, 즉시 자동가입, 이메일 자동연결 금지, 기존 JWT/refresh 회전을 유지한다.
- state는 브라우저 저장을 유지하되 TTL·provider·안전한 내부 복귀 경로를 결합한다.
- PKCE와 명시적 계정 연결, HttpOnly refresh cookie 전환은 이번 범위 밖이다.

## 분해
- FC-397 계약 확정 → FC-398 운영 환경 계약·설정 ∥ FC-399 프론트 보강 ∥ FC-400 백엔드 보강 → FC-401 Gateway·관측성 → FC-402 실제 provider E2E → FC-403 통합 리뷰.

## 완료 기준
- 시크릿은 환경변수로만 주입되고 저장소·로그·응답에 노출되지 않는다.
- 카카오·네이버 실제 로그인, 최초가입, 재로그인, 오류·거부·만료 흐름이 검증된다.
- state 변조·만료, redirect 변조, code 재사용, 동시 최초가입, refresh 회전·로그아웃 회귀를 통과한다.
- reviewer와 에픽 완료 직전 보안 리뷰를 통과하고 사용자 게이트3 승인을 받는다.
