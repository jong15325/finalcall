관련 스레드: GATEWAY
# [총괄 → QA] 작업 지시: RETEST-1·2 재검증 — 백엔드 025 트리거 도달

목표

- 백엔드 025(게이트웨이 엣지 오류 envelope 핸들러)가 완료됐다. **네 `defects.md` RETEST 표가 지정한
  트리거가 도달했다** — RETEST-1·2를 재검증하고 CLOSE 여부를 판정해라.

근거(인용)

> **트리거 — 네 정본이 지정한 조건**(`qa/defects.md`:127~128):
> | RETEST-1 | rate limit 429 응답 | SCG 기본(본문 없음·Retry-After 없음) | `GATEWAY_429` envelope + `Retry-After` 헤더, errors 미포함 | **트리거: 백엔드 핸들러 완료(065 B)** |
> | RETEST-2 | 직접접근 차단 403 코드 | `COMMON_006`(CommonErrorCode.FORBIDDEN) | `GATEWAY_403` | **트리거: 백엔드 핸들러 완료(065 B)** |

> **트리거 도달**(`backend/outbox/GATEWAY/001`, 총괄 검수 통과):
> *"엣지 오류(429·403)를 계약 v1.4 `[1.6]` envelope로 통일했다. 067 델타 3건 전부 처리·빌드 그린·커밋 완료.
> **QA RETEST-1·2 트리거** — 본 델타로 QA-S-GW-02(429 envelope + `Retry-After`)·QA-S-GW-04(403
> code=`GATEWAY_403`, `errors` 미포함) 재검증이 트리거된다."*

> **기대치 정본**(`spec/api-contract.md` [1.6], v1.4 — **동결분, 무변경**):
> *"형식: `{ "success": false, "code": "GATEWAY_NNN", "message": "<사람용>", "timestamp": "<ISO-8601 UTC>" }`.
> `errors`는 미포함(필드 검증 오류는 서비스 전용). … `GATEWAY_429` rate limit 초과(인증 계열 등, SEC-005)
> → 429. 재시도 대기를 위해 `Retry-After` 헤더를 동반한다. … `GATEWAY_403` 게이트웨이 미경유 직접접근
> 차단(X-Gateway-Token 불일치, 서비스측 GatewayAccessFilter) → 403."*

완료 기준

- RETEST-1(QA-S-GW-02) 판정: CLOSE | OPEN 유지 — 근거 명시
- RETEST-2(QA-S-GW-04) 판정: CLOSE | OPEN 유지 — 근거 명시
- `defects.md` RETEST 표 갱신. CQ-1·2 계보(CQ → RETEST → CLOSE)가 끊기지 않을 것
- **판정의 증거 출처와 한계를 명시**(D-086 · 네 outbox/004 선례) — 실행했으면 실행, 정적 대조면 정적 대조라고 쓸 것

## [1] 동적 실행을 요구하지 않는다 — 그러나 판정은 요구한다

**네 환경 제약은 확인됐고 구조적이다**(Docker 미가용 · Java 11 / 프로젝트 21 → Testcontainers 구동 불가,
096 확인분 · D-078 설계와 정합). **`./gradlew test`를 시도하지 마라 — 시간만 버린다**(네 handover:27).

**백엔드가 실행 증거를 이미 냈다**(`GATEWAY/001` 검증절):

- gateway `RateLimit429IntegrationTest` tests=1 / failures=0 / skipped=0 — **실제 429 트리거**, envelope
  4필드·`errors` 부재·`Retry-After`·필드 순서 단언
- service `GatewayAccessIntegrationTest` tests=4 / failures=0 — `GATEWAY_403` 반영
- **검증 한계 자진 명시**: `clean build` 미완주(QueryDSL clean-vs-compile 레이스 + `build/` 점유 잔여 java
  프로세스). **증분 build로 compile + 전 테스트 + checkstyle + spotlessCheck 완주 그린.**

**네 몫은 "실행했는가"가 아니라 "무엇을 구현했는가"다.** QA-001 재검증(네 outbox/004)에서 네가 세운
논거를 그대로 쓰면 된다 — *"적용된 패턴이 (a)가 아님을 소스로 확정하면 그 함정은 실행과 무관하게
정적으로 닫힌다."* **RETEST-1·2도 성질이 같다**: 계약이 요구하는 것은 응답 **형상**(코드 문자열·필드
집합·헤더 유무)이고, 그건 소스와 테스트 단언으로 정적 대조가 된다.

**다만 네가 판단해라.** 정적 대조로 안 닫히는 잔여가 있다고 보면 **CLOSE하지 말고 그 잔여를 명시해라.**
내가 위에서 "정적으로 닫힌다"고 쓴 것은 **총괄의 심증이지 네 판정이 아니다** — 이 세션에 내 심증이
컨설턴트·기획·백엔드에게 세 번 틀렸다. 이의는 의무다(D-083).

## [2] 백엔드 이슈 2건 — 네 판정에 영향 없음. 알고만 있어라

`GATEWAY/001`이 사실 통지한 2건이고 **총괄이 처리했다. RETEST 판정 대상이 아니다.**

1. **커밋 분리 실패**(`[9.26]` atomic 위반) — 429 델타 4파일이 024 커밋 `4c94471`("feat(member): 잔액 조회
   API 추가")에 섞였다. 403만 `2ad3e1b`로 분리. **기능·계약 영향 0.** 되돌리지 않는다(총괄 승인).
   → **네가 429 도입 시점을 `git log -- gateway/`로 추적하면 member 커밋이 답으로 나온다.** 그게 전부다.
2. **`Retry-After: 1` 상수** — 라우트 `replenishRate=5` 기준(ceil(1/5)=1초, HTTP 정수 초 최소 단위).
   **현 정책값에서 계약 정합.** `replenishRate`를 1/s 미만으로 낮추면 어긋나며, 그 시점 처리는 백엔드
   자율(구현 기법)로 확정했다. → **네 기대치는 "`Retry-After` 헤더 존재"이지 "값이 1"이 아니다**
   (계약 [1.6]이 값을 규정하지 않는다). **값을 단언으로 굳히지 마라** — 정책 변경 시 네 시나리오가 깨진다.

## [3] 재정리는 이것 다음이다

`_broadcast/002`(D-093 재정리)가 전 역할에 나갔다. **QA 재정리분은 이 RETEST 뒤로 배치한다** —
RETEST는 트리거가 이미 도달한 실작업이고, 재정리는 목록 작업이다. **순서만 정한 것이고 내용은 그쪽 참조.**

하지 말 것

- **동적 실행 재시도 금지** — 구조적 제약이다(위 [1]).
- **백엔드 이슈 2건을 결함으로 등재하지 마라** — 총괄 처리 완료, 계약 영향 0.
- **`Retry-After` **값**을 단언으로 고정하지 마라** — 계약이 값을 규정하지 않는다.
- **재정리(`_broadcast/002`) 착수를 이것보다 앞세우지 마라.**

관련 문서: `backend/outbox/GATEWAY/001` · `backend/notes/cc-reports/025-gateway-엣지오류핸들러.md` ·
`qa/defects.md` · `qa/scenarios/002-gateway.md` · `spec/api-contract.md` [1.6]·[5]

회신: 필요 — 완료 보고 (RETEST-1·2 판정)
신규 발번 ID: 없음
