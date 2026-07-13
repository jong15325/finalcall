상태: SENT (Claude Code 대상, 총괄 검토 후 착수)
# [백엔드 → Claude Code] 작업 지시: auth - 토큰 발급·refresh 저장소(Redis)

대상: access 토큰 발급/검증 재사용 + refresh 저장소 신규. (구현 순서 2/B, A 의존)
참조: api-contract §2 토큰 전략(SEC-006), CLAUDE.md E1·F1, B-009·B-011, 스켈레톤 infra/security/*, common/security/TokenProvider.
범위(포함):
- 스켈레톤 재사용: `HmacTokenProvider`(access JWT HS256)에 클레임(userId, public_id, is_admin) 정합, `JwtAuthenticationFilter`→SecurityContext 인증 주체 세팅 확인(B-009, X-User-Id 미사용).
- `RefreshTokenStore`(Redis, B-011): refresh는 opaque 난수(≥256bit). Redis 키 `auth:refresh:{userId}:{sessionId}` = SHA-256 해시, TTL=refresh 만료. 기능: issue(저장), rotate(신규 저장+구 삭제), validate(해시 대조), detectReuse(불일치 시 세션 무효화), revoke(logout 폐기).
- refresh 만료·access 만료는 JwtProperties(@ConfigurationProperties + @Validated).
하지 말 것: 로그인/재발급/로그아웃 엔드포인트(D·E·F 단위), rate limit(게이트웨이 D-068).
구현 지침: CLAUDE.md §4(설정 @ConfigurationProperties, AOP self-invocation 주의). Redis 접근은 Lettuce(캐시)·필요 시 Redisson. 해시는 상수시간 비교.
DoD: 단위 테스트(회전·재사용 탐지·만료 폐기) + 빌드 성공.
커밋 제안: feat(auth): access 토큰 정합·refresh Redis 저장소(회전·재사용 탐지)
