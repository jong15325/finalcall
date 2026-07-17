---
name: concurrency-review
description: reviewer가 동시성·분산락·보안 민감 코드(입찰/정산/인증)를 리뷰할 때, 또는 backend-impl이 그런 로직을 구현할 때 참조한다. 부록 C 실무 함정 15건 + 동시성/분산락/JWT 체크리스트.
---

# 동시성·분산락·보안 리뷰 체크리스트

정본 근거: CLAUDE.md 섹션 4 + `docs/backend/references/spring-skeleton-prompts.md` 부록 C(15건).

## 부록 C — 실무 함정 15건
1. AOP self-invocation — 같은 클래스 내부 호출은 프록시 미적용(@Cacheable/@DistributedLock/@Retry/@ServiceLog). 외부 빈 경유.
2. QueryDSL jakarta 분류자 누락.
3. 락-트랜잭션 순서 — 락이 트랜잭션 바깥, HIGHEST_PRECEDENCE.
4. 캐시 JavaTimeModule 누락(Instant 직렬화).
5. Retry + 부수효과 — 재시도 대상은 멱등이어야.
6. fallback 시그니처 규약.
7. @DataJpaTest H2 대체 금지(replace=NONE, Testcontainers).
8. MDC 미정리(요청 종료 시 clear).
9. flyway-mysql 누락.
10. open-in-view=true 방지(false).
11. @Setter 남용.
12. @Builder 위치(생성자).
13. Loki 고카디널리티 라벨 회피.
14. Prometheus host.docker.internal.
15. Promtail→Alloy 전환.

## 동시성/분산락 중점
- @DistributedLock이 트랜잭션 경계 바깥에서 획득/해제되는가.
- 마감 직전 입찰 폭주: 최고가 갱신이 원자적인가(조건부 UPDATE/CAS).
- 잔액·정산: 원자적 조건부 UPDATE인가(read-modify-write 경합 없음).
- 락 획득 실패/타임아웃 경로가 정의됐는가.

## 인증/인가(JWT) 중점
- 서명·만료·클레임 검증. refresh 회전·재사용 탐지.
- 상수시간 비교(토큰·공유비밀).
- IDOR: 리소스 소유자 검증(주체=SecurityContext, X-User-Id 미신뢰).
