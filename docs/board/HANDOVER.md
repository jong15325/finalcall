# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-28** (EPIC-EMAIL-VERIFY-FE 프론트 F1~F4 **구현·검수·커밋·push·Done 전이 전건 완료** — 에픽 클로즈. 다음 = 신규 작업)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: 백엔드 이메일 인증·템플릿 done 이후 프론트 F1~F4를 발번·구현했다. F2(이메일 인증 화면)는 디자인 게이트로 목업 선제작·사용자 승인 후 구현. reviewer 통과(critical/major 0·minor 3건 보완). 사용자 승인 커밋(3커밋) → **사용자 push** → **Done 전이·Jira 완료 미러**까지 게이트3 전건 종료. 실 로컬 스택으로 인증 전 흐름 시연 검증. **이 에픽은 완전히 닫혔다. 다음 = 신규 지시 대기**(후보: 미인증 기능 제한 정책·경매 에픽·SMTP 실발송).

---

## 지금 어디인가 — 한 문단

**프론트 이메일 인증 F1~F4 전건 완료·push·Done. 진행 중 작업 없음 — 신규 지시 대기.** 회원가입 email 선택 입력(F1)·이메일 인증 화면(F2: 3상태·6칸 OTP·TTL/쿨다운 카운트다운·시도초과)·errorCodes 동기화(F3)·GET /me 3상태 배너(F4)를 spec/목업 확정본대로 구현·리뷰(passed)·커밋·push·Done했다. origin/master=`ee86352`(push 완료). Jira KAN-152~156 전부 완료. 워킹트리 클린. **다음 수 = 사용자 신규 지시**(아래 후보 참조).

---

## A. 완료·클로즈 — EPIC-EMAIL-VERIFY-FE (KAN-152) · 프론트 F1~F4

### 정본·규약
- **정본 spec**: `docs/spec/email-verify-spec.md`(§8 프론트 분해)·`docs/spec/api-contract.md`(§2 email 3종·§2.5 GET /me·§5 EMAIL_001~007).
- **디자인 목업(승인)**: `docs/ux/mockups/template-email-verify.html`(3상태·OTP·쿨다운·에러 카탈로그·웹/모바일 별도 설계). 디자인 게이트 통과.
- **리뷰 기록**: `docs/board/reviews/EMAIL-VERIFY-FE-review.md`(critical/major 0·minor 5, M-1~3 보완·M-5 정정·M-4 유지).

### 구현 요지 (티켓 = done)
| 티켓 | Jira | 내용 |
|---|---|---|
| FC-136 (F3) | KAN-153 ✅ | `types/errorCodes.ts` EMAIL_001~007 동기화·재시도성 메시지 분리(빌드 선행) |
| FC-137 (F1) | KAN-154 ✅ | `SignupForm` email 선택 입력·@Email·생략 전송·EMAIL_007 필드 표면화 |
| FC-138 (F2) | KAN-155 ✅ | `VerificationCard` 활성화 + `lib/api/email.ts`·`OtpInput`·`emailVerifyErrors` — 3상태·OTP·TTL/쿨다운·시도초과 (디자인 게이트) |
| FC-139 (F4) | KAN-156 ✅ | `MeResponse`(auth.ts)·me 쿼리 emailVerified·emailMasked 3상태 배너(마스킹만) |

### 검수 결과 (인지)
- reviewer **critical 0·major 0·minor 5**. 보안(원문 미노출·코드 미로깅·서버 에러 원문 미노출·IDOR/열거방지)·계약 1:1·타이머 정리·접근성 정합. minor 3건 보완(M-1 쿨다운 코드입력 경로·M-2 만료 자동제출 차단·M-3 resend 방어)·M-4 유지·M-5 정정.
- **테스트**: vitest 590 passed(3연속)·typecheck·lint 그린.
- **실 렌더 검증**: 미설정→설정·미인증(마스킹 `d***@naver.com`)→코드입력(TTL·쿨다운 실동작·시도 n/5)→불일치 에러(EMAIL_001)까지 로컬 실동작 확인.

---

## B. 다음 수 — 신규 지시 대기 (진행 중 작업 없음)

이메일 인증 에픽은 닫혔다. **후보**(사용자 지시로 착수):
1. **미인증 기능 제한 정책**(spec 열린 결정 6 이월) — 미인증 시 어떤 기능(입찰·판매 등)을 막을지. 코어 인증과 분리된 독립 정책 층. 착수 시 게이트2 대상(계약·정책).
2. **경매 에픽**(EPIC-BID 등) — 도메인 핵심(마감 직전 동시성). 보안 층 첫 적용 대상(CLAUDE.md §9 보안 층).
3. **(정리) 데모 계정 파랑기사(userId=4) email 원복** — 시연으로 `email=demo-verify@naver.com`(미인증) 설정됨(실 DB). 방치 무해(미인증·데모). 원복은 `PUT /me/email` 재설정 또는 DB 정리. pending 코드는 TTL 소멸됨.
4. **(선택) 네이버 SMTP 실발송** — 현재 local `sender-enabled=false`(로그 대체)라 실발송 없음. 실발송하려면 **사용자 env 주입**: `MAIL_USERNAME`/`MAIL_PASSWORD`(네이버 POP3/SMTP ON + 앱 비밀번호) + `MAIL_SENDER_ENABLED=true`. 미주입 시 health `mail:DOWN`(535)은 정상(로컬 데모 무관).
5. **(선택·이월) spec §2.3 "상수시간" 문구 갱신**(architect, minor).

---

## C. Git 상태
- **origin/master = `ee86352`**(push 완료). 미푸시 없음(이 갱신 커밋 제외 — 다음 push 때 함께).
- 이번 에픽 커밋: `a91583f`(feat 코드 15파일)·`a145968`(chore 보드)·`ee86352`(HANDOVER)·본 done 전이 커밋.
- **워킹트리**: 클린(예정 — done 전이 5파일 + 이 HANDOVER를 함께 커밋).
- ⚠️ **실 DB = V18까지**(무변경). 데모 파랑기사 email side-effect(B-3).
- 규율: 부분 커밋 전 `git diff --cached --name-only` 확인([[git-mv-prestage-commit-bleed]]). 커밋 매번 사용자 승인([[commit-needs-approval]]). push는 사용자 직접.

---

## D. 배경 — 완료 에픽·환경
- **완료 에픽**: EPIC-EMAIL-VERIFY-FE(프론트, Done·push) · EPIC-EMAIL-VERIFY·EPIC-EMAIL-TEMPLATE(백엔드) · EPIC-CONVENTION-V2 · EPIC-RESTRUCTURE · EPIC-SHOP·MARKET-DATA·SHOP-MANAGE·SEARCH·PURCHASE.
- **이메일 인증 아키텍처(중요)**: 제공자=**네이버 SMTP**(`smtp.naver.com:465` SSL, 구글 아님). 코드=Redis TTL+SHA-256 해시(Lua 원자). 문구=DB 템플릿 `EMAIL_VERIFICATION`(`{{code}}` 치환, `[장터] 이메일 인증 코드`). 발송기 `EmailSender` 추상화 — **local=LoggingEmailSender(발송 스킵·코드 로그)**, dev/prod=SmtpEmailSender(실발송·fail-fast). 코드 미영속 경계(로그도 마스킹 to·코드는 렌더 인자만).
- **프론트 신규 파일**: `lib/api/email.ts`·`features/member/components/{VerificationCard(활성화),OtpInput}`·`features/member/lib/emailVerifyErrors.ts`. VerificationCard 휴대폰 인증은 백엔드 없음 → "준비 중" 유지. CTA=오렌지(앱 전역 표준, 목업 블랙은 템플릿 로컬 색·회귀 아님).
- 데모 계정 `demo1~10`/`demo1234!`. 마켓 5천 시드.
- 환경 기동: `docker start finalcall-mysql finalcall-redis`(ES/Kafka는 이메일·/me엔 불요). 백엔드 `JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11`(루트)`./gradlew :backend:bootRun --args='--spring.profiles.active=local'`(부팅 ~40s, health 503=ES·mail DOWN이나 API 정상). 프론트 `cd frontend && npm run dev`(5173, /api→8080 프록시). 검색 스택 필요 시 `cd backend && docker compose -f docker-compose.local.yml up -d --build`.
- 함정: gradle **동시 실행 금지**(서브에이전트 순차 위임). 프론트=npm/vite. 브라우저 확장 `file://` 차단(로컬 http 서버로 목업 열기). `finalcall` DB 계정 CREATE DATABASE 권한 없음(스크래치=root/root).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지(오케스트레이션·게이트·티켓·커밋 규약).
2. 이 파일 + `git status`(클린) + `git log --oneline -10`(origin=`ee86352`) + 신규 작업 spec.
3. 메모리: `commit-needs-approval`·`git-mv-prestage-commit-bleed`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`design-mockup-first`·`options-need-html-mockup`·`responsive-separate-design`·`clock-in-resume`·`handover-cadence`.
4. **미러 패리티**(총괄 전용): 이번 에픽 KAN-152~156 전부 완료 미러 확인됨. 신규 티켓은 전이마다 즉시 미러.

## 다음 수
1. **사용자 신규 지시 대기** — 후보: 미인증 기능 제한 정책(게이트2) · 경매 에픽(보안 층 첫 적용) · SMTP 실발송(env) · 데모 email 원복.

---

## 교훈
1. **디자인 게이트 = 목업 선제작·승인 후 구현**: F2 새 화면을 `template-email-verify.html`로 선제작→스크린샷 상신→승인 후 구현. 웹/모바일 별도 설계([[responsive-separate-design]]). 실구현 CTA는 앱 표준 오렌지(목업 블랙=템플릿 로컬 색, reviewer가 회귀 아님 확인).
2. **F3(errorCodes) 빌드 선행**: `errorCodes.test.ts`가 api-contract §5를 파싱하므로 EMAIL 코드 동기화가 나머지 프론트 티켓의 빌드 선행. 반드시 먼저.
3. **동시성 리뷰 실효(프론트)**: reviewer가 쿨다운 시 코드 입력 경로 부재(M-1)·만료 후 자동제출(M-2)을 잡음 → OTP onComplete 자동제출 가드는 버튼 disabled 조건(만료·쿨다운 포함)과 대칭이어야.
4. **로컬 실 렌더 검증 가치**: local LoggingEmailSender가 코드를 로그로 내보내 실 SMTP 없이 인증 전 흐름(TTL·쿨다운·에러)을 실 렌더로 검증. 단 실발송은 네이버 크리덴셜 env 별건.
5. **게이트3 = push(사용자 직접)+Done(승인)+Jira 완료 미러 3종 세트**: push 후 Done 전이 승인받아 보드 state→done·에픽 롤업, Jira transition ID 41(완료)로 미러. 미러 패리티까지가 게이트3 종료.
