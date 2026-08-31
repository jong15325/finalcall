# 문서로 운영한 AI 개발체계

FinalCall은 AI에게 긴 프롬프트 하나를 주고 결과를 기다리는 방식이 아니라 규칙과 계약, 역할과 상태, 리뷰와 인수인계를 저장소 안에 남기는 방식으로 개발했다  사용자가 운영체계를 직접 설계하고 스키마·성능·인가·Done을 승인했으며 AI는 정해진 경계 안에서 설계안 작성, 구현, 검증을 분담했다

| 문제 | 만든 장치 | 실제 효과와 증거 |
|---|---|---|
| 세션과 도구가 바뀔 때 맥락과 결정 이유 소실 | `AGENTS.md`에 구조·코딩 규칙·게이트·권한을 고정하고 `rules.md`와 `templates.md`로 반복 작업 형식을 표준화 | Claude Code에서 시작한 역할 체계를 Codex로 이식하면서 같은 spec과 파일 보드를 계속 사용  도구 교체보다 공통 정본 유지에 집중 |
| 요구가 구현 중 달라지고 프론트와 백엔드 계약이 흔들림 | architect가 spec·ERD·API 계약·불변식을 먼저 확정하는 contract-first  스키마·API·성능 결정은 게이트2에서 사용자 승인 | 입찰에서 Redis 분산락을 기각하고 auction 행 비관적 락+금전 CAS로 확정  구현과 동시성 테스트가 같은 계약을 기준으로 진행 |
| AI가 역할과 범위를 넘거나 작성자가 스스로 통과 판정 | architect·backend-impl·frontend-impl·reviewer 역할별 프롬프트  reviewer 읽기 전용  파일 소유권과 의존 관계 명시 | 즉시구매 구현 테스트가 green인 상태에서도 reviewer가 AB-BA 잔액 락 순서를 major로 발견  `user_id` 정렬과 교차 경합 테스트 후 재통과 |
| 여러 에픽과 세션의 상태가 대화에만 남음 | 티켓당 파일 1개인 `docs/board`  상태·owner·의존·gate·review_status 기록  Jira는 파일에서 단방향 멱등 미러 | Jira 미생성·상태 드리프트를 발견한 뒤 커밋 전 경고와 HANDOVER 패리티 점검 추가  파일 정본과 대시보드 역할 분리 |
| 인수 시 다음 작업과 미해결 위험 누락 | `HANDOVER.md`에 현재 상태·이어받는 순서·검증·미러 패리티를 기록 | 새 세션이 대화 기억에 의존하지 않고 보드·spec·테스트에서 작업 상태 복원 |
| 문서 규칙이 권고에 머물고 코드가 조용히 이탈 | feature-first 의존 규칙, DTO·ErrorCode·Properties 위치를 ArchUnit과 ConventionArchitectureTest로 검사  Checkstyle·Spotless 적용 | `com.finalcall.domain.<feature>.<layer>` 구조와 `common`·`infra` 경계를 기계적으로 강제  전 도메인 재구성 완료 |
| 기능 테스트만으로 보안·동시성·출시 위험을 놓침 | 읽기 전용 reviewer, 공통 위협모델, 에픽 완료 보안 리뷰, 원격 CI, 실 DB 동시성·부하 테스트 | 입찰 불변식 I1~I10과 12개 클래스 69건 검증  채팅은 기능 구현과 300 req/s 지속 통과에도 1,000 req/s burst 실패를 숨기지 않고 `RELEASE BLOCKED` 유지 |

```text
사용자 범위 승인
  → architect  spec · ERD · API 계약
  → backend-impl ∥ frontend-impl
  → reviewer  보안 · 동시성 · QA · 접근성
  → 재작업 또는 사용자 Done 승인

공통 기억  AGENTS · rules/templates · spec · file board · reviews · HANDOVER
```

제출 근거 경로

- `AGENTS.md`
- `.codex/agents/architect.toml`과 `.codex/agents/reviewer.toml`
- `docs/common/rules.md`
- `docs/common/templates.md`
- `docs/spec/erd.md`
- `docs/spec/api-contract.md`
- `docs/spec/bid-domain-spec.md`
- `docs/board/HANDOVER.md`
- `docs/board/reviews/FC-035-review.md`
- `docs/board/reviews/FC-089-090-review.md`

결론  AI의 생성 속도보다 맥락·계약·검증·사람의 최종 책임이 반복 가능하도록 만든 개발 운영체계

<!-- 편집 메모  16:9 한 장 기준으로 제목과 소개를 상단 20%, 표를 중앙 58%, 흐름과 근거 경로를 하단 22%에 배치  검정 배경과 민트 포인트 1색 사용  제출본에서는 코드 경로를 8pt 이하로 줄이지 말고 필요하면 QR 또는 부록 링크로 분리 -->
