# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-26** (EPIC-CONVENTION-V2 종료 · EPIC-EMAIL-VERIFY 재개 대기)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: EPIC-RESTRUCTURE(layer→feature-first) 종료 후, feature *내부* 어휘·구조 정리
> **EPIC-CONVENTION-V2**를 게이트1~게이트3 전건 완료했다(reviewer PASS). 코드 12커밋은 사용자가 push 완료(`dccf200..e8f31e9`).
> 남은 것은 **보드 종료 커밋 1건**(done 상태 반영, 승인 후)뿐이고, 그다음 **EPIC-EMAIL-VERIFY 재개**다.

---

## 지금 어디인가 — 한 문단

**EPIC-CONVENTION-V2 종료(reviewer PASS). EPIC-EMAIL-VERIFY 재개 대기.** feature 내부 어휘·구조를 On-Race 정본으로 정리 완료 — ErrorCode 12종 `common/exception` 중앙화(축2), feature Properties 8종 `domain/<f>/config/` 분리(축3), 웹 DTO를 Request/Response로 축약(`*View`/`*Detail`/`*Slice` 폐지→중첩 record+공용 `CursorResponse<T,C>`, `*Command`/`*Result`는 bid·settlement만 존치)(축1 C), Service 헬퍼 네이밍 표준화(축4), ArchUnit 신규칙 (e)(f)(g)로 기계 강제(FC-127). 응답 JSON 형상·인가 무회귀는 reviewer가 확인. 코드 12커밋 push 완료, **보드 종료 커밋만 승인 대기**. 다음 일감 = EPIC-EMAIL-VERIFY(FC-117/118 unblock, 엔드포인트 **FC-128~** 발번).

---

## A. EPIC-CONVENTION-V2 (종료 — 보드 커밋만 잔여)

### 결과 (되돌리지 말 것)
- **축1=C**: 웹 DTO=Request/Response(+공용 `CursorResponse<T,C>`)만. `*View`/`*Detail`/`*Slice` 폐지(전 도메인 잔존 0). `*Command`/`*Result`는 **bid·settlement에만**(auction·shop·search 축약). 공용 `CursorResponse<T,C>`는 커서 타입 제네릭으로 도메인별 nextCursor 형상 보존(notice=Long, 나머지=String).
- **축2=b**: 도메인 ErrorCode 12종 → `com.finalcall.common.exception`(분리 유지). **예외: `infra/security/GatewayErrorCode`는 infra 잔류**(게이트2).
- **축3**: feature 전용 Properties 8종 → `domain/<feature>/config/`. cross-cutting 3종(AppProperties·JwtProperties·GatewayInternalProperties)은 `infra/config` 잔류(게이트2).
- **축4**: Service 헬퍼 네이밍 표준화(`ExchangeWriter→ExchangeRecorder`, `ListingBootReindexer→ListingBootIndexer`). VO는 `service/` 잔류(sample·bid 이미 준수, 무변경).
- **FC-127**: `ConventionArchitectureTest` (e)DTO 접미사·(e-2)Command/Result 한정·(f)ErrorCode 위치·(g)Properties 위치 강제. 화이트리스트 = `common.response.FieldErrorDetail`(스코프)·`GatewayErrorCode`(FQN).
- **AGENTS.md/.agents = gitignore 대상**(Codex 로컬 미러) → feature-first+V2 이식은 디스크만 반영, git 커밋 없음. 드리프트 해소 완료.
- 규약 정본: `docs/common/proposals/layer-restructure-proposal-v0.1.md`(내용 **v0.4**, §9.7~§9.10·§10) + `CLAUDE.md` §5. 계약영향 정본 = `docs/spec/convention-v2-contract-impact.md`. 리뷰 = `docs/board/reviews/EPIC-CONVENTION-V2-review.md`.

### 티켓 (KAN-137 에픽, 전부 done·review_status passed)
| 티켓 | Jira | 커밋 |
|---|---|---|
| FC-123 규약확정(consultant) | KAN-138 | 9e7ec84 |
| FC-124 ErrorCode 중앙화 | KAN-139 | 48ad20b |
| FC-125 Properties 분리 | KAN-140 | 23bda85 |
| FC-126 DTO+Service(8도메인) | KAN-141 | b7e7214·6cfda18·665ef17·b7ef1ba·cf7d488·1953871·36d5576·7e98ee3 |
| FC-127 ArchUnit+검증 | KAN-142 | e8f31e9 |

### ★ 총괄이 할 일 (재개 시)
1. **보드 종료 커밋**(승인 후): `chore(board): EPIC-CONVENTION-V2 종료 — FC-123~127 done·에픽 done 반영` — 티켓5+에픽+리뷰파일+HANDOVER. 커밋 후 **사용자 push**(코드는 이미 push됨, 이 보드 커밋만 미푸시).
2. **EPIC-EMAIL-VERIFY 재개**(아래 C절).

---

## B. Git 상태
- **코드 push 완료**: `dccf200..e8f31e9`(2026-07-26 사용자 직접). FC-122·EPIC-RESTRUCTURE 종료·EPIC-CONVENTION-V2 코드 12커밋 전부 원격 반영. 원격 CI 발동.
- **미커밋 워킹트리**: 보드 done 상태 파일(FC-123~127·에픽·리뷰파일·HANDOVER). → 보드 종료 커밋 승인·커밋·push 남음.
- ★ 교훈: 부분 커밋 전 `git diff --cached --name-only` 확인([[git-mv-prestage-commit-bleed]]). backend-impl `git mv` 선-스테이징을 매 도메인 `git reset -q` 후 경로 재지정으로 정리했다 — 누출 0.

---

## C. EPIC-EMAIL-VERIFY (재개 대기 — 다음 에픽)
- 설계 확정됨(spec v0.1·api-contract v1.15, 게이트2 승인 07-24). 이제 구현 착수 가능(RESTRUCTURE·V2 완료로 경로·어휘 확정).
- FC-117(Flyway V17 email 컬럼)·FC-118(User 엔티티 email 필드) = **unblock**(depends_on FC-121 done). Jira KAN-135·136(에픽 KAN-134).
- ⚠️ **KAN-134 설명 stale**: "이메일 엔드포인트 FC-123~ 발번"이라 적혔으나 FC-123~127은 V2가 선점 → **이메일 엔드포인트는 FC-128~ 발번**. 재개 시 KAN-134 설명 정정(미러 패리티).
- 재개 시: **V2 확정 규약**으로 구현 — `com.finalcall.domain.member.entity.User`에 필드 추가, DTO는 Request/Response(+필요시 CursorResponse), ErrorCode는 `common/exception`, 엔드포인트 3종 티켓 FC-128~ 발번. 미인증 제한·스쿼팅 감수(spec §7).
- SMTP 크리덴셜은 사용자 env 직접 주입(네이버). 로컬 `sender-enabled:false`.

---

## D. 완료 에픽·환경 (배경)
- 완료 에픽: **EPIC-CONVENTION-V2**(2026-07-26 게이트3) · **EPIC-RESTRUCTURE**(2026-07-26) · EPIC-SHOP·MARKET-DATA·SHOP-MANAGE·SEARCH·PURCHASE 등.
- 데모 계정: `demo1`~`demo10` / `demo1234!`. 마켓 5천 시드.
- 환경 기동(재부팅 시): `docker start finalcall-mysql finalcall-redis`; 검색 스택 `cd backend && docker compose -f docker-compose.local.yml up -d --build` + create-index·register-connectors. 백엔드: `JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11` (루트에서) `./gradlew :backend:bootRun --args='--spring.profiles.active=local'`. 프론트: `cd frontend && npm run dev`.
- 규약 정리는 스택 없이도 검증됨(ArchUnit·컴파일 Docker 불요, 통합/동시성만 Testcontainers).
- 함정: ES 8.18.8 버전 일치·Confluent CDN 차단(Aiven)·mysql binlog·`flyway repair`·bootRun cwd는 레포 루트.

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지(오케스트레이션·게이트·티켓·커밋 규약).
2. 이 파일 + `git status`(미커밋 보드·HANDOVER) + `git log --oneline -20` + `docs/board/epics/EPIC-CONVENTION-V2.md`(done) + `docs/common/proposals/layer-restructure-proposal-v0.1.md`(v0.4).
3. On-Race 정본 소스 `D:\Java\ktcloud\backend\On-Race\backend`(차용 원형).
4. 메모리: `commit-needs-approval`·`git-mv-prestage-commit-bleed`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`handoff-completion-report`·`handover-cadence`.
5. **미러 패리티 점검**(총괄 전용): 보드 done인데 Jira 미완료 대조. 이번 종료분 KAN-137~142 완료 미러 확인. KAN-134 설명 stale(위 C절) 정정 대상.

## 다음 수
1. **보드 종료 커밋**(승인 후) + 사용자 push(보드 커밋만).
2. **EPIC-EMAIL-VERIFY 재개**: 게이트1 필요 없음(설계 확정·게이트2 승인 완료) — FC-117/118부터 착수, 엔드포인트 FC-128~ 발번. KAN-134 stale 정정.
3. 여력 시 별도 티켓: feature 단위 순환 강제(레거시 auction↔bid 결합 해소 선행).

---

## 교훈
1. **차용 원형은 실소스로 검증** — On-Race가 View/Detail/Slice를 쓴다고 오해했으나 실측은 Request/Response뿐. 드리프트는 자체 발생.
2. **순수 어휘 리팩터도 형상·인가가 관건** — record 컴포넌트 순서=Jackson 순서, 커서 제네릭으로 nextCursor 타입 보존, 파생인자(viewerId 마스킹)는 매퍼 클로저 종결. reviewer가 형상·인가·over-fetch 동치를 최종 확인.
3. **도메인별 원자 커밋 + 매 커밋 승인** — 8도메인을 패스로 묶어 실행하되 커밋은 도메인별로 분리(리뷰·롤백 용이).
4. **`git mv` 선-스테이징 주의** — 매 커밋 `git reset -q` 후 경로 재지정, `git diff --cached` 확인.
5. **AGENTS.md(Codex)는 gitignore** — feature-first+V2 이식은 디스크만, 커밋 아티팩트 없음(정본 이원화 회피).
