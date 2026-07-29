---
id: EPIC-OAUTH
type: epic
jira_key: KAN-170
title: 네이버·카카오 소셜 로그인 (방식 B — 프론트 주도 + 백엔드 교환)
state: done
children: [FC-152, FC-153, FC-154, FC-155, FC-156, FC-157]
gate: null
---

> **에픽 완료(2026-07-30)**: 전 자식 done, reviewer 통과(FC-157 PASS · critical 0/major 0/minor 3). 커밋 `090d372`(FC-153)·`b06d728`(FC-154)·`7c2c056`(FC-155)·`f454736`(FC-156)·`5a8303e`(FC-152 spec)·`53ae55b`(board). 라이브 확인 = 키 발급 + 재기동 후(사용자). push는 사용자 직접.

## 목표
네이버·카카오 소셜 로그인을 도입한다. 기존 loginId/password 인증에 소셜 신원을 추가하되, **기존 스테이틀리스 JWT·게이트웨이·토큰 인프라를 재사용**한다.

## 방식 (게이트1 승인 2026-07-29)
**방식 B — 프론트 주도 + 백엔드 교환**: 프론트가 provider에서 `code` 수신 → `POST /api/v1/auth/oauth/{provider}`로 백엔드 전달 → 백엔드가 code교환·userinfo 조회·find-or-create → **기존 `TokenProvider`+`RefreshTokenStore.issue(userId)`로 JWT 발급**(응답 = 기존 `LoginResponse` 형상 그대로). 스프링 `oauth2Login`(방식 A)은 STATELESS·SPA·게이트웨이와 충돌해 기각.
- 근거: `TokenProvider`·`RefreshTokenStore`가 userId 기반(provider 무관)이라 재사용. 콜백은 `/login`처럼 일반 permitAll API. provider 리다이렉트는 백엔드가 아니라 프론트 `/oauth/callback`으로 복귀.

## 결정 3건 (사용자 승인 2026-07-29)
1. **로그인·가입 통합** — 소셜 버튼은 최초=자동가입, 이후=로그인(단일 동작).
2. **이메일 자동연결 안 함** — `provider + provider_user_id`를 독립 신원으로. 소셜 이메일이 기존 비번계정과 같아도 자동 연결하지 않는다(SEC-007 정합·단순·안전). 이메일은 프로필 데이터로만.
3. **닉네임 유니크 접미사** — provider 닉네임이 기존과 충돌 시(nickname UK) 자동 유니크 접미사.

## 분해 (병렬)
FC-152 계약·스키마(architect, **게이트2**) → 백엔드 체인 **FC-153→FC-154** ∥ 프론트 체인 **FC-155→FC-156**(계약 확정 후 동시) → **FC-157** 리뷰(보안+QA+/security-review).

## 제약·재사용
- 재사용(무변경): `TokenProvider`·`HmacTokenProvider`·`TokenClaims`·`RefreshTokenStore`·`JwtAuthenticationFilter`·`UserBalance` 생성 흐름.
- 신규: `user_social_account` 테이블(Flyway V19)·`password_hash` nullable화·`OAuthService`·콜백 라우트·`SocialLoginButton`.
- 보안: SEC-007(열거방지)·state/CSRF·X-Gateway-Token(D-068) 정합. code 교환은 **풀링 RestClient**(FC-151 커넥션 누수 교훈).
- 키: architect 계약 후 FC-154(client-secret)·FC-155(client-id·redirect-uri) 착수 시 사용자에게 네이버·카카오 콘솔 발급 요청.
