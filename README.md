# FinalCall

게임 아이템 경매 플랫폼 — 대규모 트래픽 경매 백엔드 (Spring Boot 스켈레톤).

## 실행

```bash
# 로컬 인프라(MySQL/Redis) 기동 — Stage D/E1 부터 필요
docker compose -f docker-compose.local.yml up -d

# 애플리케이션 실행 (활성 프로파일 미지정 시 local)
./gradlew bootRun
```

## 프로파일

| 프로파일 | 활성화 | 특징 |
|---|---|---|
| local | 기본값(SPRING_PROFILES_ACTIVE 미지정 시) | 모든 값에 기본값 → 환경변수 없이 실행 |
| dev / prod | `SPRING_PROFILES_ACTIVE=prod` 등 | 시크릿은 `${ENV}` 기본값 없음 → 누락 시 부팅 실패(fail-fast) |

설정·변수·컨벤션은 [CLAUDE.md](CLAUDE.md), 단계별 구축 지시는 [docs/spring-skeleton-prompts.md](docs/spring-skeleton-prompts.md) 참조.
