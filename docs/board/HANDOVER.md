# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-27** (EPIC-EMAIL-VERIFY 진행 중 — FC-117 done, FC-118 다음. 마감)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: EPIC-CONVENTION-V2 게이트3 종료 후 **EPIC-EMAIL-VERIFY 재개**. FC-117(Flyway V17)까지 구현·검증·커밋하고 마감했다. 다음은 FC-118(User 엔티티 email 필드).

---

## 지금 어디인가 — 한 문단

**EPIC-EMAIL-VERIFY 진행 중. FC-117(Flyway V17) done, FC-118부터 재개.** 회원가입 이메일 인증(6자리 코드·네이버 SMTP·Redis 해시)을 spec 확정본대로 구현 중이다. FC-117로 `user`에 `email`·`email_verified`·`email_active`(생성컬럼 UK) 3종을 추가했고(스크래치 스키마 비파괴 실검증·UK 시맨틱 실증), 커밋됐다. ⚠️ **V17은 다음 앱 부팅 시 자동 적용**된다(실 DB엔 아직 미적용). 하위 티켓 FC-128~132(B3~B7)는 발번 완료(KAN-143~147). 다음 수 = **FC-118(User email 필드·도메인 메서드)** → 이후 **FC-128∥FC-129(코드저장소·메일인프라 병렬)** → FC-130 → FC-131∥FC-132 → reviewer → 게이트3. 선행 에픽(RESTRUCTURE·CONVENTION-V2)은 done.

---

## A. EPIC-EMAIL-VERIFY (진행 중 — KAN-134)

### 정본·규약
- **정본 spec**: `docs/spec/email-verify-spec.md`(v0.1 확정, 게이트2 승인 2026-07-24). api-contract v1.15. 에픽 파일 `docs/board/epics/EPIC-EMAIL-VERIFY.md`.
- **V2 규약 적용**: User=`com.finalcall.domain.member.entity`, **ErrorCode(EmailErrorCode)=`common/exception`**, Properties=member `config/`, DTO=Request/Response.
- **정책값**(spec §3): 코드 만료 10분·재전송 쿨다운 60초·시도 5회·6자리. Properties 바인딩(상수 하드코딩 금지).

### 티켓 상태 (KAN-134 에픽)
| 티켓 | Jira | 상태 | 내용 |
|---|---|---|---|
| FC-117 B1 | KAN-135 | **review(커밋 a8b11d4)** | Flyway V17 email 컬럼 3종·UK |
| FC-118 B2 | KAN-136 | **todo(다음 수)** | User email·emailVerified 필드 + assignEmail/markEmailVerified |
| FC-128 B3 | KAN-143 | todo | EmailVerificationCodeStore(Redis·Lua·emailHash) — **FC-117/118과 병렬 가능** |
| FC-129 B4 | KAN-144 | todo | 메일 인프라(starter-mail·EmailSender·local skip) — 병렬 가능 |
| FC-130 B5 | KAN-145 | todo | EmailErrorCode·EmailVerifyProperties·yml (FC-128·129 후) |
| FC-131 B6 | KAN-146 | todo | signup email 선택 + EMAIL_007 (FC-118·130 후) |
| FC-132 B7 | KAN-147 | todo | 엔드포인트 3종 + service + /me 노출 (FC-118·128·129·130 후) |

### ★ 총괄이 할 일 (재개 시, 순서대로)
1. **FC-118 착수**(backend-impl): `User`에 `email`(String nullable)·`emailVerified`(boolean) + `assignEmail(정규화 email)`(emailVerified=false 재초기화)·`markEmailVerified()`. @Setter 금지. 정규화는 서비스 책임(엔티티는 정규화값 수신). depends_on FC-117 충족. spec §2.1.
   - ⚠️ **주의**: FC-118로 email 필드가 엔티티에 생기면 JPA ddl-auto=validate가 **V17 적용된 스키마와 일치해야** 부팅 성공 → FC-118 검증 시 V17이 적용된 DB 필요(앱 부팅=V17 자동 적용, 또는 순서 확인).
2. **FC-128 ∥ FC-129 팬아웃**(파일 무교차 — Redis store vs mail infra): FC-118과도 병렬 가능(다른 파일). 총괄 판단으로 동시 위임 가능.
3. FC-130(값 참조) → FC-131 ∥ FC-132(signup vs member email 엔드포인트, 파일 다름).
4. **reviewer**(에픽 done 전 필수): 동시성(Lua CAS·시도카운트 누수)·인가(주체=SecurityContext·이메일 열거 SEC-007)·TOCTOU(set-email 코드 폐기) 중점. concurrency-review 스킬.
5. **게이트3**: 에픽 done(사용자 승인)·보드 커밋·사용자 push.
6. **프론트 F1~F4**: 백엔드 계약 커밋 후 별도 발번(F2 이메일 인증 화면=디자인 게이트).

### 민감 포인트 (spec 근거)
- **코드 저장 = Redis TTL+SHA-256, Lua 원자 검증**(attempts 증가·상한·삭제·상수시간 비교). emailHash 바인딩 + set-email의 코드 폐기로 TOCTOU 방어(spec §2.3).
- **이메일 열거 최소**(SEC-007): 엔드포인트는 주체 자기 이메일만(임의 파라미터 없음). 발송 202가 유효성 확증 아님.
- **미인증 스쿼팅 = accepted risk**(spec §7). email_active UK가 인증무관 유일성 강제 — 향후 강화안은 별도.
- **SMTP 크리덴셜 = 사용자 env 주입**(네이버, 총괄 대리 불가). 로컬 `sender-enabled:false`.

---

## B. Git 상태
- **push 완료**: `dccf200..e8f31e9`(V2 코드 12커밋, 2026-07-26 사용자).
- **미푸시 커밋 3건**(다음 push 대상): `1c80e05`(V2 보드 종료) · `a8b11d4`(FC-117 V17) · 이번 마감 **보드 커밋**(FC-117~132 티켓·에픽·HANDOVER).
- ⚠️ **V17 미적용**: 실 `finalcall.user`엔 email 컬럼 없음(flyway 최신=16). **다음 앱 부팅 시 V17 자동 적용**. FC-118 검증 전 부팅 필요.
- 규율: 부분 커밋 전 `git diff --cached --name-only` 확인([[git-mv-prestage-commit-bleed]]).

---

## C. 배경 — 완료 에픽·환경
- **완료 에픽**: EPIC-CONVENTION-V2(2026-07-26 게이트3 — feature 내부 어휘·ErrorCode 중앙화·Properties 분리·DTO 축약·ArchUnit e/f/g) · EPIC-RESTRUCTURE(feature-first) · EPIC-SHOP·MARKET-DATA·SHOP-MANAGE·SEARCH·PURCHASE.
- **V2 규약 요지**(신규 코드 준수): DTO=Request/Response(+공용 `CursorResponse<T,C>`), ErrorCode=`common/exception`, feature Properties=`domain/<f>/config/`, ArchUnit `ConventionArchitectureTest`가 강제. 정본 proposal v0.4 + CLAUDE.md §5.
- 데모 계정 `demo1~10`/`demo1234!`. 마켓 5천 시드.
- 환경 기동: `docker start finalcall-mysql finalcall-redis`; 검색 스택 `cd backend && docker compose -f docker-compose.local.yml up -d --build` + create-index·register-connectors. 백엔드 `JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11` (루트)`./gradlew :backend:bootRun --args='--spring.profiles.active=local'`. 프론트 `cd frontend && npm run dev`.
- 함정: ES 8.18.8 버전일치·Confluent CDN차단(Aiven)·mysql binlog·`flyway repair`·bootRun cwd=레포루트. **finalcall DB 계정은 CREATE DATABASE 권한 없음**(스크래치 검증은 root/root).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지(오케스트레이션·게이트·티켓·커밋 규약).
2. 이 파일 + `git status`(미푸시 3커밋) + `git log --oneline -20` + `docs/spec/email-verify-spec.md`(정본) + `docs/board/epics/EPIC-EMAIL-VERIFY.md`.
3. 메모리: `commit-needs-approval`·`git-mv-prestage-commit-bleed`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`handoff-completion-report`·`handover-cadence`·`clock-in-resume`.
4. **미러 패리티**(총괄 전용): 보드 done인데 Jira 미완료 대조. 이번 세션 KAN-135 검토중·143~147 todo 미러 확인.

## 다음 수
1. **사용자 push**(미푸시 3커밋) — 원하면. 아니어도 로컬 작업 진행 가능.
2. **FC-118 착수**(User email 필드) → 이후 FC-128∥129 팬아웃 → FC-130 → FC-131∥132 → reviewer → 게이트3.
3. 프론트 F1~F4는 백엔드 계약 커밋 후.

---

## 교훈
1. **스키마 마이그레이션 = 비파괴 검증**: 실 DB 부팅 대신 스크래치 스키마에 V17 적용해 UK 시맨틱까지 실증(실 DB·flyway 이력 무오염). 되돌리기 어려운 변경은 이 패턴.
2. **ddl-auto=validate 순서**: DB 컬럼만 추가(FC-117)하면 미매핑 컬럼이라 부팅 OK. 엔티티 필드 추가(FC-118) 후엔 스키마 일치 필수 → V17 적용된 DB 필요.
3. **도메인별 원자 커밋 + 매 커밋 승인**(섹션 13). backend-impl `git mv` 선-스테이징은 매 커밋 `git reset -q` 후 경로 재지정.
4. **EmailErrorCode는 V2 규약대로 `common/exception`**(feature 루트 아님) — 신규 도메인도 V2 배치 준수.
