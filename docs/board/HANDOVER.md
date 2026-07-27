# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-28** (EPIC-EMAIL-VERIFY-FE 프론트 F1~F4 **구현·검수·커밋 완료** · **미푸시 · Done 미전이** — 게이트3 대기)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: 백엔드 이메일 인증·템플릿 done 이후 프론트 F1~F4를 발번·구현했다. F2(이메일 인증 화면)는 디자인 게이트로 목업 선제작·사용자 승인 후 구현. reviewer 통과(critical/major 0·minor 3건 보완). 사용자 승인으로 **커밋 2개 완료(미푸시)**. 실 로컬 스택으로 인증 전 흐름을 시연하던 중 사용자가 마감(“일어나서 이어서”). **다음 = 게이트3(push·Done)** 와 잔여 미러/정리.

---

## 지금 어디인가 — 한 문단

**프론트 이메일 인증 F1~F4 완료·커밋됨(미푸시). 다음 = 게이트3(사용자 push + Done 전이).** 회원가입 email 선택 입력(F1)·이메일 인증 화면(F2: 3상태·6칸 OTP·TTL/쿨다운 카운트다운·시도초과)·errorCodes 동기화(F3)·GET /me 3상태 배너(F4)를 spec/목업 확정본대로 구현·리뷰(passed)했다. 로컬 실행으로 미설정→설정·미인증→코드입력(TTL·쿨다운 실동작)→불일치 에러까지 실제 렌더 검증(인증완료 직전 마감). 코드 2커밋(`a91583f` 코드·`a145968` 보드)은 **로컬에만**, origin/master=`86efbcd` 그대로. **다음 수 = 사용자 push + Done 전이 승인 → 총괄이 티켓/에픽 done 전이·Jira done 미러.**

---

## A. 완료 — EPIC-EMAIL-VERIFY-FE (KAN-152) · 프론트 F1~F4

### 정본·규약
- **정본 spec**: `docs/spec/email-verify-spec.md`(§8 프론트 분해)·`docs/spec/api-contract.md`(§2 email 3종·§2.5 GET /me·§5 EMAIL_001~007).
- **디자인 목업(승인)**: `docs/ux/mockups/template-email-verify.html`(3상태·OTP·쿨다운·에러 카탈로그·웹/모바일 별도 설계). 디자인 게이트 통과(2026-07-27, 사용자 승인).
- **리뷰 기록**: `docs/board/reviews/EMAIL-VERIFY-FE-review.md`(critical/major 0·minor 5, M-1~3 보완·M-5 정정·M-4 유지).

### 구현 요지 (티켓 = review·passed)
| 티켓 | Jira | 내용 |
|---|---|---|
| FC-136 (F3) | KAN-153 | `types/errorCodes.ts` EMAIL_001~007 동기화·재시도성 메시지 분리(빌드 선행) |
| FC-137 (F1) | KAN-154 | `SignupForm` email 선택 입력·@Email·생략 전송·EMAIL_007 필드 표면화 |
| FC-138 (F2) | KAN-155 | `VerificationCard` 활성화 + `lib/api/email.ts`·`OtpInput`·`emailVerifyErrors` — 3상태·OTP·TTL/쿨다운·시도초과 (디자인 게이트) |
| FC-139 (F4) | KAN-156 | `MeResponse`(auth.ts)·me 쿼리 emailVerified·emailMasked 3상태 배너(마스킹만) |

### 검수 결과 (반드시 인지)
- reviewer **critical 0·major 0·minor 5**. 보안(원문 미노출·코드 미로깅·서버 에러 원문 미노출·IDOR/열거방지)·계약 1:1·타이머 정리(setInterval `[mode]` 의존·언마운트 clear)·접근성(OTP role=group·label·one-time-code) 정합.
- **보완 완료(비차단)**: M-1(쿨다운 시 코드 입력 경로 부재→EMAIL_004도 enterCode 진입)·M-2(만료 후 OtpInput onComplete 자동제출 차단)·M-3(resend EMAIL_006 방어). **유지**: M-4(SignupForm.test prettier 노이즈). **정정**: M-5(FC-139 artifact `session.ts`→`auth.ts`).
- **테스트**: vitest 590 passed(3연속)·typecheck·lint 그린.

### 실 렌더 검증 (로컬 스택, 스크린샷 사용자 확인)
미설정(이메일 등록 폼) → 설정·미인증(마스킹 `d***@naver.com`·"미인증"·인증코드받기) → 코드입력(TTL "남은 시간 9:xx"·쿨다운 "xx초 후"·시도 n/5·6칸 OTP) → 불일치 에러(EMAIL_001 "남은 시도 4회") 까지 실제 동작 확인. **인증완료 화면 직전 마감**(코드 254421은 로그에서 확인, 재입력 시 인증완료 예상).

---

## B. 다음 수 — 게이트3 + 정리 (미완)

1. **게이트3(push + Done) — 사용자 승인 필요**:
   - **push는 사용자 직접**(에이전트 차단). 로컬 2커밋(`a91583f`·`a145968`) + 이 HANDOVER 커밋을 origin/master로 push.
   - **Done 전이(사용자 승인 후 총괄)**: FC-136~139 `state: review→done`, 에픽 EPIC-EMAIL-VERIFY-FE `doing→done`.
2. **Jira 미러 패리티(총괄)**: KAN-152~156이 현재 **"해야 할 일"(todo) 상태**로 생성됨(review/done 미반영) — Done 전이 시 KAN-153~156·152를 **완료**로 transition. (`getTransitionsForJiraIssue`로 전이 ID 조회 후 `transitionJiraIssue`.)
3. **(정리) 데모 계정 이메일 원복 검토**: 시연으로 데모 계정 **파랑기사(userId=4)** 에 `email=demo-verify@naver.com`(미인증) 설정됨. 실 DB 변경. 방치해도 무해(미인증·데모)하나, 원복하려면 `PUT /me/email`로 다른 값 재설정 또는 DB에서 정리. pending 코드는 TTL(10분)로 자연 소멸.
4. **(선택) 네이버 SMTP 실발송 테스트**: 현재 local `sender-enabled=false`(로그 대체)라 **실제 메일 미발송**. dev/prod 또는 로컬에서 실발송하려면 **사용자가 env 주입** — `MAIL_USERNAME`/`MAIL_PASSWORD`(네이버 메일 POP3/SMTP ON + 앱 비밀번호) + `MAIL_SENDER_ENABLED=true`. 미주입 시 health `mail:DOWN`(535)은 정상(로컬 데모 무관).
5. **(선택·후속 백로그)**: 미인증 기능 제한 정책(입찰·판매 차단 등, spec 열린 결정 6 이월). spec §2.3 "상수시간" 문구 갱신(architect, minor·이월).

**제안 커밋(HANDOVER)**: `chore(board): HANDOVER 갱신 — 프론트 F1~F4 커밋 완료·다음 게이트3 (마감)`

---

## C. Git 상태
- **미푸시 2커밋**: `a91583f`(feat 코드 15파일)·`a145968`(chore 보드 7파일). **origin/master=`86efbcd` 그대로** — push는 사용자 직접(게이트3).
- **워킹트리**: 이 HANDOVER 갱신만(미커밋). 그 외 클린.
- ⚠️ **실 DB = V18까지 적용됨**(무변경). 데모 파랑기사 email 설정 side-effect(B-3).
- 규율: 부분 커밋 전 `git diff --cached --name-only` 확인([[git-mv-prestage-commit-bleed]]). 커밋 매번 사용자 승인([[commit-needs-approval]]).

---

## D. 배경 — 완료 에픽·환경
- **완료 에픽**: EPIC-EMAIL-VERIFY-FE(프론트, 이번·커밋만·미푸시) · EPIC-EMAIL-VERIFY·EPIC-EMAIL-TEMPLATE(백엔드, push됨) · EPIC-CONVENTION-V2 · EPIC-RESTRUCTURE · EPIC-SHOP·MARKET-DATA·SHOP-MANAGE·SEARCH·PURCHASE.
- **이메일 인증 아키텍처(중요)**: 제공자=**네이버 SMTP**(`smtp.naver.com:465` SSL, 구글 아님). 코드=Redis TTL+SHA-256 해시(Lua 원자). 문구=DB 템플릿 `EMAIL_VERIFICATION`(`{{code}}` 치환, `[장터] 이메일 인증 코드`). 발송기 `EmailSender` 추상화 — **local=LoggingEmailSender(발송 스킵·코드 로그)**, dev/prod=SmtpEmailSender(실발송·fail-fast). 코드 미영속 경계(로그도 마스킹 to·코드는 렌더 인자만).
- **프론트 신규 파일**: `lib/api/email.ts`·`features/member/components/{VerificationCard(활성화),OtpInput}`·`features/member/lib/emailVerifyErrors.ts`. VerificationCard의 휴대폰 인증은 백엔드 없음 → "준비 중" 유지. CTA=오렌지(앱 전역 표준, 목업 블랙은 템플릿 로컬 색·회귀 아님).
- 데모 계정 `demo1~10`/`demo1234!`. 마켓 5천 시드.
- 환경 기동: `docker start finalcall-mysql finalcall-redis`(ES/Kafka는 이메일·/me엔 불요). 백엔드 `JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11`(루트)`./gradlew :backend:bootRun --args='--spring.profiles.active=local'`(부팅 ~40s, health 503=ES·mail DOWN이나 API 정상). 프론트 `cd frontend && npm run dev`(5173, /api→8080 프록시). 검색 스택 필요 시 `cd backend && docker compose -f docker-compose.local.yml up -d --build`.
- 함정: gradle **동시 실행 금지**(서브에이전트 순차 위임). 프론트=npm/vite(gradle 아님). 브라우저 확장 `file://` 차단(로컬 http 서버로 목업 열기). `finalcall` DB 계정 CREATE DATABASE 권한 없음(스크래치=root/root).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지(오케스트레이션·게이트·티켓·커밋 규약).
2. 이 파일 + `git status`(HANDOVER만 미커밋·2커밋 미푸시) + `git log --oneline -10` + `docs/spec/email-verify-spec.md`·`api-contract.md`(정본).
3. 메모리: `commit-needs-approval`·`git-mv-prestage-commit-bleed`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`design-mockup-first`·`options-need-html-mockup`·`responsive-separate-design`·`clock-in-resume`·`handover-cadence`.
4. **미러 패리티**(총괄 전용): KAN-152~156이 아직 todo 상태 → 게이트3 done 전이 시 함께 완료 미러(B-2).

## 다음 수
1. **게이트3**: 사용자 push(직접) + Done 전이 승인 → 총괄이 FC-136~139·EPIC-EMAIL-VERIFY-FE done 전이 + Jira KAN-152~156 완료 미러.
2. (정리) 데모 파랑기사 email side-effect 원복 검토(B-3).
3. (선택) 네이버 SMTP 실발송 — 사용자 env 주입 시(B-4).

---

## 교훈
1. **디자인 게이트 = 목업 선제작·승인 후 구현**: F2 새 화면을 `template-email-verify.html`로 선제작→스크린샷 상신→승인 후 구현. 웹/모바일 별도 설계([[responsive-separate-design]]). 실구현 CTA는 앱 표준 오렌지로 치환(목업 블랙=템플릿 로컬 색, reviewer가 회귀 아님 확인).
2. **F3(errorCodes) 빌드 선행**: `errorCodes.test.ts`가 api-contract §5를 파싱하므로 EMAIL 코드 동기화가 나머지 프론트 티켓의 빌드 선행. 반드시 먼저.
3. **동시성 리뷰 실효(프론트)**: reviewer가 쿨다운 시 코드 입력 경로 부재(M-1)·만료 후 자동제출(M-2)을 잡음 → OTP onComplete 자동제출 가드는 버튼 disabled 조건과 대칭이어야(만료·쿨다운 포함).
4. **로컬 실 렌더 검증 가치**: local LoggingEmailSender가 코드를 로그로 내보내 실 SMTP 없이도 인증 전 흐름(TTL·쿨다운 카운트다운·에러 상태)을 실제 렌더로 검증 가능. 단 실발송은 네이버 크리덴셜 env 주입 별건.
