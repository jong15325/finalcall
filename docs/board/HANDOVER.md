# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-27** (EPIC-EMAIL-VERIFY·EPIC-EMAIL-TEMPLATE **둘 다 done·push 완료**. 마감)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: 회원가입 이메일 인증(EMAIL-VERIFY) 구현 중 사용자가 "메일 문구를 DB 템플릿으로 재사용" 구조 변경을 요청 → 게이트2 승인 후 별도 에픽 **EPIC-EMAIL-TEMPLATE** 신설·구현. 두 에픽을 통합 reviewer로 검수(major M-1 발견·수정·재검 CLOSED)하고 게이트3(done·push)까지 종료했다. 다음은 **프론트 F1~F4**.

---

## 지금 어디인가 — 한 문단

**백엔드 이메일 인증·템플릿 완료. 다음 = 프론트엔드.** 회원가입 이메일 인증(6자리 코드·네이버 SMTP·Redis Lua 해시)과 재사용 메일 템플릿 저장소(DB `email_template`·`{{name}}` 치환)를 spec 확정본대로 구현·리뷰·done했다. 백엔드 계약은 push됐다(origin/master=`58986c0`). **다음 수 = 프론트 F1~F4 발번·구현**(F3 errorCodes.ts EMAIL_001~007 동기화 선행 필수, F2 이메일 인증 화면=디자인 게이트). 선행 에픽(RESTRUCTURE·CONVENTION-V2)·경매 이전 에픽 모두 done.

---

## A. 완료 — EPIC-EMAIL-VERIFY (KAN-134) · EPIC-EMAIL-TEMPLATE (KAN-148)

### 정본·규약
- **정본 spec**: `docs/spec/email-verify-spec.md`(v0.1, §6은 2026-07-27 템플릿 연동 갱신) · `docs/spec/email-template-spec.md`(v1.0 DECIDED, 게이트2 2026-07-27). api-contract v1.15(§5 EMAIL_001~007 등재됨).
- **리뷰 기록**: `docs/board/reviews/EMAIL-VERIFY-TEMPLATE-review.md`(통합 리뷰·M-1 CLOSED).

### 구현 요지 (done 티켓)
| 티켓 | Jira | 내용 |
|---|---|---|
| FC-117 | KAN-135 | Flyway V17 user email 컬럼 3종·email_active UK |
| FC-118 | KAN-136 | User email·emailVerified 필드·assignEmail/markEmailVerified |
| FC-128 | KAN-143 | EmailVerificationCodeStore(Redis Lua 원자검증·SHA-256·emailHash TOCTOU) |
| FC-129 | KAN-144 | 메일 인프라 EmailSender 범용 발송기(send·MimeMessage)·local skip |
| FC-130 | KAN-145 | EmailErrorCode(EMAIL_001~007)·EmailVerifyProperties·yml |
| FC-131 | KAN-146 | signup email 선택 입력·EMAIL_007 UK 분기 |
| FC-132 | KAN-147 | /me/email 3종 엔드포인트·EmailVerificationService·/me 마스킹 노출 |
| FC-133 | KAN-149 | Flyway V18 email_template 테이블·EMAIL_VERIFICATION 시드 |
| FC-134 | KAN-150 | EmailTemplate 엔티티·EmailTemplateKey(변수계약)·MailContentType·Repository |
| FC-135 | KAN-151 | EmailTemplateService(치환·fail-fast 검증)·RenderedEmail·MailErrorCode |

### 리뷰 결과 (반드시 인지)
- **M-1(major, CLOSED)**: `verify()` 성공이 detached blind-merge라 verify∥setEmail 경쟁 시 lost-update(구 이메일 verified 확정) → **조건부 원자 UPDATE** `UserRepository.markEmailVerified(id, email) WHERE email=검증이메일`(0행→EMAIL_002)로 차단. 리포지토리 메서드 `@Transactional`로 self-invocation 회피.
- **minor 후속**(비차단): m-1 프론트 errorCodes.ts EMAIL_001~007 미동기화(F3 소관·프론트 빌드 전 선행 필수), m-4 spec §2.3 "상수시간" 문구↔Lua `==`(구현 근거 타당, architect 문구 갱신 권고).

### 민감 포인트 (유지·주의)
- **코드 미영속 경계**: 코드는 Redis SHA-256 해시만·템플릿 DB엔 `{{code}}` placeholder만·@ServiceLog 인자 미덤프·LoggingEmailSender는 local(sender-enabled=false) 한정.
- **SEC-007 열거방지**: 3 엔드포인트 주체=SecurityContext만(임의 이메일 파라미터 없음), EMAIL_002 만료·미발송·emailHash불일치 통일, 202 비확증, /me 마스킹.
- **SMTP 크리덴셜**: `MAIL_USERNAME`/`MAIL_PASSWORD` env only(네이버, 커밋 금지). local `sender-enabled:false`라 크리덴셜 없이 부팅. **실발송 테스트 시 사용자 env 주입 필요**(네이버 POP3/SMTP ON + 앱 비밀번호).
- **미인증 스쿼팅 = accepted risk**(spec §7). email_active UK가 인증무관 유일성 강제.

---

## B. 다음 수 — 프론트엔드 F1~F4 (미발번)

spec `email-verify-spec.md` §8·`email-template-spec.md` 참조. 백엔드 계약 push 완료로 착수 가능. **다음 FC 번호 = FC-136부터**.
- **F1. 가입 폼** — email 입력(선택 표기)·@Email 검증. (계약 §2)
- **F2. 이메일 인증 화면**(**디자인 게이트** — 새 화면) — 이메일 설정 + 6자리 코드 입력 + 재전송 쿨다운 카운트·시도초과 안내. 목업 선제작([[design-mockup-first]]·[[options-need-html-mockup]]).
- **F3. errorCodes.ts** — `EMAIL_001`~`EMAIL_007` 동기화(**프론트 빌드 전 선행 필수** — `errorCodes.test.ts`가 api-contract §5 파싱). 메시지 분리(만료·불일치·시도초과·쿨다운·이미인증·미설정·이미사용중).
- **F4. GET /me 반영** — `emailVerified`·`emailMasked` 3상태(미설정/미인증/인증완료) 배너·게이트. F2 연계.

의존: F1(계약 확정) · F2(디자인 게이트 후) · F3(계약 §5) · F4(F2 연계). 프론트 디자인은 [[frontend-design-principles]]·[[frontend-design-decisions]]·[[responsive-separate-design]]·[[mockup-fidelity-only-fix]] 준수.

---

## C. Git 상태
- **push 완료**: `e8f31e9..58986c0`(이번 세션 이메일 15커밋 + 앞선 미푸시 3, 총 18, 2026-07-27 사용자). **미푸시 없음**, 워킹트리 클린.
- ⚠️ **실 DB = V17→V18 적용됨**(FC-118·FC-129/133 검증 부팅으로 전진). flyway 최신=18.
- 규율: 부분 커밋 전 `git diff --cached --name-only` 확인([[git-mv-prestage-commit-bleed]]). 커밋 매번 사용자 승인([[commit-needs-approval]]).

---

## D. 배경 — 완료 에픽·환경
- **완료 에픽**: EPIC-EMAIL-VERIFY·EPIC-EMAIL-TEMPLATE(2026-07-27) · EPIC-CONVENTION-V2 · EPIC-RESTRUCTURE · EPIC-SHOP·MARKET-DATA·SHOP-MANAGE·SEARCH·PURCHASE.
- **V2 규약**(신규 코드 준수): DTO=Request/Response(+공용 `CursorResponse<T,C>`), ErrorCode=`common/exception`, feature Properties=`domain/<f>/config/`, ArchUnit `ConventionArchitectureTest`·`SliceArchitectureTest` 강제. 신규 feature `com.finalcall.domain.mail`(메일 템플릿).
- 데모 계정 `demo1~10`/`demo1234!`. 마켓 5천 시드.
- 환경 기동: `docker start finalcall-mysql finalcall-redis`; 검색 스택 `cd backend && docker compose -f docker-compose.local.yml up -d --build` + create-index·register-connectors. 백엔드 `JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11` (루트)`./gradlew :backend:bootRun --args='--spring.profiles.active=local'`. 프론트 `cd frontend && npm run dev`.
- 함정: ES 8.18.8 버전일치·Confluent CDN차단(Aiven)·mysql binlog·`flyway repair`·bootRun cwd=레포루트. **finalcall DB 계정은 CREATE DATABASE 권한 없음**(스크래치 검증은 root/root). gradle **동시 실행 금지**(서브에이전트 병렬 시 bootRun/test 자원 경합 — 순차 위임).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지(오케스트레이션·게이트·티켓·커밋 규약).
2. 이 파일 + `git status`(클린·미푸시 없음) + `git log --oneline -20` + `docs/spec/email-verify-spec.md`·`email-template-spec.md`(정본).
3. 메모리: `commit-needs-approval`·`git-mv-prestage-commit-bleed`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`handoff-completion-report`·`handover-cadence`·`clock-in-resume`.
4. **미러 패리티**(총괄 전용): 보드 done인데 Jira 미완료 대조. 이번 세션 KAN-135~151·134·148 전부 완료 미러 확인됨.

## 다음 수
1. **프론트 F1~F4 발번**(FC-136~) → 구현. F3(errorCodes) 선행, F2 디자인 게이트.
2. (선택) 네이버 SMTP 실발송 테스트 — 사용자 env 주입 시.
3. (선택) spec §2.3 상수시간 문구 갱신(architect, minor).

---

## 교훈
1. **contract-first 구조 변경**: 확정 spec 도중 사용자 구조 변경 요청은 architect가 새 spec·영향 티켓·게이트2 자료를 내고 사용자 평문 상신([[gate2-plain-language]]) 후 착수. 이번 메일 템플릿 DB화가 표본.
2. **서브에이전트 병렬 = gradle 경합**: 파일 무교차라도 동일 워킹트리 gradle 빌드/부팅은 경합 → 순차 위임이 안전. 진짜 병렬 필요 시 worktree 격리 검토.
3. **동시성 리뷰 실효**: reviewer가 detached blind-merge lost-update(M-1)를 잡음 → 조건부 원자 UPDATE로 수정. NOT_SUPPORTED tx + save(detached)는 blind merge 위험, `@Version` 없으면 조건부 UPDATE(WHERE 술어)로 CAS.
4. **비파괴 스키마 검증**: V18은 root/root 스크래치 스키마에 V1~V18 적용해 UK·시드·인코딩 실증(실 DB 무오염). ddl-auto=validate는 엔티티 필드 추가 후 스키마 일치 필수.
