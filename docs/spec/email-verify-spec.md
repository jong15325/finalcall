# Email Verification Spec (회원가입 이메일 인증)

상태: **v0.1 (2026-07-25) — 확정.** 게이트2(스키마·계약·정책값) 사용자 승인(2026-07-24, 전 8항목). DRAFT 해제.
소유: architect (변경은 계약 변경 절차 `common/rules.md [6]` + 영향 티켓 산출 후 사용자 확인)
정본 에픽: `docs/board/epics/EPIC-EMAIL-VERIFY.md`
연동 계약: api-contract **v1.15**(§2 signup·set-email·verification·§2.5 GET /me·§5 EMAIL_*)
근거: domain-spec §6.1(회원 계정 관리)·§12(보안), erd §4.1(user), SEC-007(열거 방지), D-081(soft delete 자연키 UK), B-011(RefreshTokenStore 패턴)

---

## 1. 범위와 전제 (확정)

사용자 확정(2026-07-24, EPIC-EMAIL-VERIFY 게이트2):

1. **이메일 = 가입 시 선택(필수 아님).** 계정은 이메일 없이도 생성된다. 가입 시 이메일을 넣으면 **미인증 상태로 저장**하고, 안 넣으면 생략한다. 이후 **이메일 설정/변경 엔드포인트**로 언제든 추가·교체한다.
2. **인증 흐름 = 가입 후 인증.** 계정 생성(미인증) → 이메일 설정(안 했으면) → 코드 발송 요청 → 6자리 코드 확인 → `email_verified=true`. **미인증 제한 정책(어떤 기능을 막나)은 이월**(코어 인증 동작 후 별도 결정, 에픽 열린 결정 6). 이 문서는 인증 동작만 다룬다.
3. **인증 방식 = 6자리 숫자 코드 입력**(매직 링크 아님). 앱 안에서 완결한다.
4. **발송 = 진짜 SMTP**(표준 `JavaMailSender`), 제공자 **네이버**(`smtp.naver.com:465` SSL). 크리덴셜은 사용자가 env로 직접 주입. **로컬 = 발송 스킵 + 코드 로그**, dev/prod = 실발송 + fail-fast.
5. **코드 저장 = Redis TTL + SHA-256 해시**(RefreshTokenStore 패턴 재사용, Lua 원자 CAS·상수시간 비교). 신규 `EmailVerificationCodeStore`.
6. **정책값**: 코드 만료 **10분** · 재전송 쿨다운 **60초** · 시도 제한 **5회** · **6자리** 숫자.
7. **이메일 유니크**(활성 회원 기준, `email_active` 생성 컬럼 — V4 `login_id_active`/`nickname_active` 패턴 동형). **NULL(이메일 미설정)은 유니크 대상 제외** → 여러 계정이 이메일 없이 공존 가능.
8. **GET /me = `emailVerified` 노출 + `emailMasked`(마스킹, nullable)**. 이메일 원문은 노출하지 않는다.

**범위 밖**: 미인증 기능 제한(입찰·판매 차단 등), 비밀번호 찾기(이메일 활용), 발송 감사 이력 영속화 — 코어 인증이 독립 정책 층을 막지 않도록 분리한다.

---

## 2. 데이터 모델

### 2.1 Member(user) 컬럼 추가 — Flyway V17

`user` 테이블에 컬럼 2개 + 생성 컬럼 1개(UK)를 추가한다(**V17**, V16이 최신).

| 컬럼 | 타입 | null | 기본 | 설명 |
|---|---|---|---|---|
| `email` | `VARCHAR(255)` | **NULL** | — | 회원 이메일(정규화 저장 = lowercase+trim). 미설정이면 NULL. 255 = 이메일 표준 상한. |
| `email_verified` | `BIT` | NOT NULL | `0` | 인증 완료 플래그. 미설정·설정직후·이메일 변경 시 항상 `0`. |
| `email_active` | `VARCHAR(255)` (생성) | — | `IF(is_deleted, NULL, email)` STORED | 활성 회원 유니크 강제용. 원본 `email` 컬럼엔 UK를 걸지 않는다(V4 패턴 동형). |

- 기존 행(가입 회원)은 `email=NULL`·`email_verified=0`으로 backfill된다(이메일 없음·미인증). `email`이 nullable이므로 backfill 충돌 없음.
- **엔티티(`com.finalcall.domain.member.entity.User`)**: `email`(String, nullable)·`emailVerified`(boolean) 필드 추가. 도메인 메서드(`@Setter` 금지, §5):
  - `assignEmail(String normalizedEmail)` — 이메일 설정/변경. `emailVerified`를 **false로 (재)초기화**.
  - `markEmailVerified()` — 인증 성공 시 `emailVerified=true`.
  - (동일 이메일 재설정은 서비스에서 no-op 판단 — 아래 §4.2.)

### 2.2 이메일 유니크 (활성 회원 기준, NULL 제외)

```sql
-- V17 (요지)
ALTER TABLE user
    ADD COLUMN email VARCHAR(255) NULL AFTER nickname,
    ADD COLUMN email_verified BIT NOT NULL DEFAULT 0 AFTER email,
    ADD COLUMN email_active VARCHAR(255)
        GENERATED ALWAYS AS (IF(is_deleted, NULL, email)) STORED AFTER email_verified;
ALTER TABLE user
    ADD UNIQUE KEY uk_user_email_active (email_active);
```

- **NULL 유니크 제외**: MySQL UNIQUE는 NULL을 유일성에서 제외한다. 이메일 미설정(NULL)·탈퇴행(`email_active`=NULL) 계정은 얼마든 공존한다. 활성 & 이메일 설정 회원 사이에서만 유일성이 강제된다.
- **제약명 `uk_user_email_active`**: `AuthService.toDuplicateException`이 제약명으로 위반 UK를 구분한다(기존 `uk_user_login_id_active`/`uk_user_nickname_active` 판정 로직에 email 분기 1건 추가 → `EMAIL_007`).
- **정규화**: 저장 전 lowercase+trim만 적용. gmail `+`태그·`.` 제거 등 제공자별 정규화는 하지 않는다(과설계·오탐 회피). 유니크·비교는 정규화된 값 기준.
- **유니크 시점 = 미인증 포함(단순 패턴).** `email_active`는 인증 여부와 무관하게 활성 회원의 이메일 유일성을 강제한다 → 미인증 이메일도 선점된다(§7 스쿼팅 트레이드오프·향후 강화안 참조).

### 2.3 인증 코드 저장 — Redis TTL + SHA-256 해시

`RefreshTokenStore` 스킴을 준용한 신규 `EmailVerificationCodeStore`(infra/security 또는 infra/mail):

```
키:   auth:email:verify:{userId}          (Hash)
필드: codeHash   = SHA-256(6자리 코드)      ← 평문 미저장
      emailHash  = SHA-256(정규화 이메일)    ← 코드가 발송된 이메일 바인딩(§ TOCTOU 방어)
      attempts   = 시도 횟수(정수, 검증 실패 시 증가)
TTL:  코드 만료 = 600초(10분)               ← 자연 소멸

키:   auth:email:verify:cd:{userId}        (String, 존재만으로 쿨다운 판정)
TTL:  재전송 쿨다운 = 60초
```

**발송 시**: 쿨다운 키 존재 → `EMAIL_004` 거부. 없으면 코드 생성 → `verify:{userId}` 해시 세팅(`attempts=0`, `emailHash` 바인딩, TTL 600s) + `cd:{userId}` 세팅(TTL 60s) → SMTP 발송.

**검증 시**(Lua 원자):
1. `verify:{userId}` 없음 → `EMAIL_002`(만료·미발송 통일).
2. `emailHash` ≠ SHA-256(현재 user.email) → 코드가 다른(변경 전) 이메일용 → 키 삭제 후 `EMAIL_002`(존재 비노출).
3. `attempts+1 > 5` → 키 삭제 후 `EMAIL_003`(시도 초과, 코드 폐기).
4. `codeHash` 상수시간 비교 불일치 → `attempts` 증가 커밋, `EMAIL_001`.
5. 일치 → 키 삭제 후 서비스가 `email_verified=true` 커밋.

- **원자성**: attempts 증가·상한 검사·삭제·비교를 Lua 단일 EVAL로(RefreshTokenStore `ROTATE_SCRIPT` 선례) — 동시 검증 경쟁의 시도 카운트 누수 방지.
- **TOCTOU 방어**: 발송~검증 사이 이메일이 변경되면(§4.2 PUT /me/email) (a) set-email이 `verify:{userId}`·`cd:{userId}`를 **삭제**하고(주 방어), (b) `emailHash` 바인딩으로 경쟁 시에도 옛 코드가 새 이메일을 인증하지 못한다(심층 방어).

### 2.4 정책 값 바인딩

`EmailVerifyProperties`(`@ConfigurationProperties` + `@Validated`, 섹션 4 표준. `bid.increment`·`fee.policy` 선례)로 주입 — 만료·쿨다운·시도제한·자릿수는 **컴파일 상수 아님**. 0/음수/빈 값은 부팅 차단(조용한 기본값 대체 금지).

---

## 3. 정책 값 (확정)

| 정책 | 값 | 설명 |
|---|---|---|
| 코드 만료 | **10분(600s)** | 받은 코드를 10분 안에 입력. 넘으면 재발송. |
| 재전송 쿨다운 | **60초** | "코드 다시 받기" 후 1분간 재요청 불가(메일 폭탄·비용 방지). |
| 시도 제한 | **5회** | 코드 5회 오입력 시 그 코드 폐기, 재발송 필요(무차별 방지). |
| 코드 자릿수 | **6 고정** | 6자리 숫자(`000000`~`999999`, 상수시간 비교). |
| 재전송 총량 상한 | **미도입** | 쿨다운(60초)만 적용. 시간당 총량 상한은 향후 남용 관측 시 추가(선택·범위 밖). |

---

## 4. API 계약 (api-contract v1.15 반영 요지)

세 엔드포인트 모두 **인증 필요**, 주체 = SecurityContext(userId). 임의 이메일을 파라미터로 받지 않는다(자기 계정 이메일만) → 이메일 열거면 최소(SEC-007). `me` 접두 규약(api-contract §4)에 정합하며, `/api/v1/me/**`는 이미 `authenticated()`라 **SecurityConfig 변경 불요**.

**엔드포인트 3종(신규) + signup 변경 + GET /me 변경**:

### 4.1 signup 변경 — email optional

- 요청: `{ loginId, password, nickname, email? }`. `email`은 선택. 제공 시 `@Email`·`@Size(max=255)`. **미제공(null)이면 생략**(이메일 없는 계정 생성).
- 저장: 제공 시 정규화(lowercase+trim)해 `email` 세팅, `email_verified=false`. **가입은 코드를 자동 발송하지 않는다** — 인증은 별도 `verification-request` 단계(가입이 SMTP 장애·fail-fast에 결합되지 않게 분리).
- 응답 201: `{ userPublicId, nickname }` **무변경**(email·인증상태 미노출).
- 이메일 중복(유니크 위반, `email` 제공 시): `EMAIL_007`(409). SEC-007 완화 = 게이트웨이 rate limit(signup은 이미 SEC-005 대상) + 사유 최소화. loginId(`AUTH_001`)·nickname(`AUTH_002`) UK 안전망과 동형 처리.

### 4.2 이메일 설정/변경 — `PUT /api/v1/me/email`

- 인증: 필요. 요청: `{ email }`(`@Email`·`@Size(max=255)`, 정규화).
- 동작: `assignEmail(정규화 email)` → `email` 저장 + **`email_verified=false` 재초기화**. **pending 코드·쿨다운 키 삭제**(§2.3 TOCTOU 주 방어).
  - **동일 이메일 재설정 = no-op**: 요청 email이 현재 저장값과 같으면 `email_verified`를 건드리지 않는다(이미 인증된 이메일을 재제출해도 인증이 풀리지 않게).
- 응답 200: `{ email, emailVerified: false }`. **자기가 방금 제출한 값**의 정규화 결과를 에코한다(열거면 아님 — 호출자가 이미 아는 값). GET /me의 원문 미노출과 의도적으로 구분.
- 에러: `EMAIL_007` 이미 사용 중(409, 유니크 위반), 검증 400, 401.

### 4.3 인증 코드 발송 요청 — `POST /api/v1/me/email/verification-request`

- 인증: 필요. 요청 body **없음**(계정 이메일 사용).
- 응답 **202 Accepted**(본문 없음) — 발송은 비동기 성격, 성공 여부로 이메일 유효성을 확증하지 않음.
- 동작: 이메일 미설정 → `EMAIL_006`. 이미 인증됨 → `EMAIL_005`. 쿨다운 내 → `EMAIL_004`. 통과 시 6자리 코드 생성 → Redis 해시 저장 → SMTP 발송 → 쿨다운 세팅.
- 에러: `EMAIL_004`(재전송 쿨다운, 429)·`EMAIL_005`(이미 인증됨, 409)·`EMAIL_006`(이메일 미설정, 409)·401.

### 4.4 인증 코드 확인 — `POST /api/v1/me/email/verify`

- 인증: 필요. 요청: `{ code }`(`@Pattern("\\d{6}")`).
- 응답 200: `{ emailVerified: true }`.
- 동작: §2.3 검증 시퀀스 → 성공 시 `markEmailVerified()` 커밋 + 코드 키 삭제.
- 에러: `EMAIL_001`(불일치, 422)·`EMAIL_002`(만료·미발송 통일, 422)·`EMAIL_003`(시도초과, 429)·`EMAIL_005`(이미 인증됨, 409)·검증 400·401.

### 4.5 프로필 노출 — `GET /api/v1/me`

- 응답에 **`emailVerified`(bool)** + **`emailMasked`(string, nullable)** 추가. `emailMasked`=null → 이메일 미설정, non-null(예 `a***@naver.com`) → 설정됨. `emailVerified`가 인증 여부. 이 조합으로 프론트가 **미설정 / 설정·미인증 / 인증완료** 3상태를 구분한다.
- 이메일 **원문은 노출하지 않는다**(마스킹만). PATCH /me 응답도 동일 스키마 공유(`MemberProfileResponse`).

### 4.6 엔드포인트 시퀀스(전체 흐름)

```
가입(email 없이)  → POST /auth/signup {loginId,password,nickname}          → 201
이메일 설정        → PUT  /me/email {email}                                  → 200 {email, emailVerified:false}
코드 발송          → POST /me/email/verification-request                     → 202  (SMTP 발송, 쿨다운 60s)
코드 확인          → POST /me/email/verify {code}                            → 200 {emailVerified:true}
상태 조회          → GET  /me                                                → {..., emailMasked, emailVerified}
이메일 변경(재인증) → PUT  /me/email {newEmail}  (verified=false 재초기화, pending 코드 폐기) → 재발송·재확인
```

가입 시 email을 넣은 경우는 `PUT /me/email` 단계를 건너뛰고 바로 `verification-request`로 진입한다.

---

## 5. 에러코드 (신규 EmailErrorCode — enum↔계약 1:1)

새 도메인 enum `EmailErrorCode`(`EMAIL_{3자리}`). **api-contract §5 등재 + 프론트 `errorCodes.ts` 동기화가 규약상 필수**(`errorCodes.test.ts`가 계약 §5 표를 파싱 — 등재 누락 시 프론트 빌드 실패).

| 코드 | 상태 | 의미 |
|---|---|---|
| `EMAIL_001` | 422 | 인증 코드 불일치 |
| `EMAIL_002` | 422 | 코드 만료·미발송(존재 여부 비노출 통일) |
| `EMAIL_003` | 429 | 시도 횟수 초과(코드 폐기) |
| `EMAIL_004` | 429 | 재전송 쿨다운 |
| `EMAIL_005` | 409 | 이미 인증된 이메일 |
| `EMAIL_006` | 409 | 이메일 미설정(이메일 없는 상태에서 인증요청) |
| `EMAIL_007` | 409 | 이메일 이미 사용 중(유니크 위반 — signup·set-email) |

상태코드 근거(api-contract §1.5): 도메인 규칙 위반(코드 불일치·만료)=422, 남용 억제(쿨다운·시도초과)=429, 상태 충돌(이미 인증·이미 사용 중·미설정)=409.

---

## 6. 발송(SMTP) 설정

### 6.1 의존성
- `backend/build.gradle`에 `spring-boot-starter-mail` 추가(현재 없음).

### 6.2 application.yml (`spring.mail.*`)
```yaml
spring:
  mail:
    host: smtp.naver.com
    port: 465
    username: ${MAIL_USERNAME}      # dev/prod: 기본값 없음 → 미주입 시 fail-fast
    password: ${MAIL_PASSWORD}      # 시크릿 — 커밋 금지, 사용자 env 주입
    properties:
      mail.smtp.auth: true
      mail.smtp.ssl.enable: true    # 465 = SSL(SMTPS)
      mail.smtp.starttls.enable: false
email:
  verify:
    code-length: 6
    ttl-seconds: 600
    resend-cooldown-seconds: 60
    max-attempts: 5
    sender-enabled: ${MAIL_SENDER_ENABLED:false}   # local 기본 false(발송 스킵+로그)
```
- 네이버 전제: 메일 환경설정 **POP3/SMTP 사용 ON** + 계정(또는 2단계 인증 시 애플리케이션) 비밀번호. 총괄 대리 입력 불가(사용자 주입).
- `spring.mail.*`의 `username`/`password` 기본값은 **공통 application.yml에 두지 않는다**(prod fail-fast 무력화 방지, 섹션 4). 로컬은 `application-local.yml`에서 `sender-enabled:false`로 발송 자체를 건너뛰어 크리덴셜 없이 부팅.

### 6.3 로컬/운영 거동
- `EmailSender` 추상화 + `email.verify.sender-enabled` 플래그. **local 기본 false** → SMTP 미호출·생성 코드를 로그로 출력(개발자가 크리덴셜 없이 인증 흐름 테스트). **dev/prod = true** → 실발송, `${MAIL_USERNAME}`/`${MAIL_PASSWORD}` 미주입 시 부팅 실패(fail-fast).
- 발송 실패(SMTP 예외)는 `verification-request`만 실패시키고 **가입·로그인엔 영향 없음**(§4.1 자동발송 미채택 근거).

---

## 7. 보안·함정 체크리스트

- **이메일 열거 방지(SEC-007)**: 인증 요청/확인/설정은 **로그인 주체 자기 이메일만** 대상(임의 이메일 파라미터 없음) → 열거면 최소. 발송 202가 이메일 유효성을 확증하지 않음. 유니크 위반(`EMAIL_007`)은 signup(SEC-005 rate limit 대상)·set-email(인증·rate limit 검토)에서만 노출되며 nickname 중복(`AUTH_002`, 이미 공개) 대비 노출면이 크지 않다.
- **코드 무차별 방지**: 6자리=10^6 → **시도제한(`EMAIL_003`) 필수** + 만료(10분) 결합으로 실효 공격창 축소. 시도 카운트 Lua 원자 처리(누수 방지). 해시 저장으로 Redis 덤프 시 코드 직접 노출 차단(무차별 방어의 본질은 시도제한, 해시는 보조).
- **재전송 남용(메일 폭탄·비용)**: 쿨다운(`EMAIL_004`) 60초.
- **이메일 변경 TOCTOU**: set-email이 pending 코드·쿨다운 키 삭제(주) + `emailHash` 바인딩(심층) — 옛 코드가 변경된 이메일을 인증하지 못하게(§2.3).
- **시크릿**: `MAIL_PASSWORD`는 env only, 커밋 금지(섹션 2·4).
- **★ 미인증 이메일 스쿼팅(accepted risk / 향후 강화안)**: `email_active` UK가 **인증 여부 무관** 유일성을 강제하므로, 공격자가 피해자 이메일을 자기 계정에 **미인증 상태로 선점**하면 실소유자의 가입·설정을 막을 수 있다(registration DoS). 현 설계는 이 위험을 **감수**한다 — (a) 공격은 피해자 이메일을 사전 인지해야 하고, (b) 이메일이 선택이라 피해자는 이메일 없이 가입 가능하며, (c) 게임 아이템 마켓 특성상 가치가 낮다. **향후 강화안** = 생성 컬럼을 `IF(is_deleted OR NOT email_verified, NULL, email)`로 바꿔 **인증된 이메일만** 유일성 강제(미인증 중복 허용, 인증 커밋 시점에 유일성 검사). 채택 시 계약 변경(6절)+게이트2. 이번 범위에선 확정된 단순 패턴 유지.

---

## 8. 하위 티켓 분해안 (게이트1 조정 대상)

확정(게이트2) 후 팬아웃. 쓰기 파일 집합 기준 병렬성 표기. 티켓 ID는 총괄이 부여(아래는 논리 라벨·의존).

**백엔드**
- **B1. Flyway V17** — `user`에 `email`(nullable)·`email_verified`·`email_active` 생성컬럼 UK. (단일 파일, 선행 없음)
- **B2. User 엔티티** — `email`·`emailVerified` 필드 + `assignEmail`/`markEmailVerified` 도메인 메서드. (B1 의존)
- **B3. EmailVerificationCodeStore** — Redis 저장소(issue/verify/attempts/cooldown, Lua 원자, emailHash 바인딩). (신규 파일, RefreshTokenStore 무교차 → **B1·B2와 병렬 가능**)
- **B4. 메일 인프라** — `spring-boot-starter-mail`(build.gradle) + `MailConfig` + `EmailSender`(추상화·local skip/log) + 코드 메일 템플릿. (신규 파일 → **B1·B2·B3와 병렬 가능**)
- **B5. EmailErrorCode enum + EmailVerifyProperties + application.yml** — `spring.mail.*`·`email.verify.*` + 프로파일별 sender-enabled. (B3·B4 참조 값)
- **B6. signup 변경** — `SignupRequest` email 선택 필드 + `AuthService.signup` email 전달·`toDuplicateException` email UK→`EMAIL_007` 분기 + `AuthController`. (B2 의존)
- **B7. 이메일 설정·인증 엔드포인트 3종** — `MemberController`(또는 신규 `MemberEmailController`) `PUT /me/email`·`POST /me/email/verification-request`·`POST /me/email/verify` + `EmailVerificationService` + `MemberService` 이메일 설정 + `MemberProfileResponse`에 `emailVerified`·`emailMasked` 추가. (B2·B3·B4·B5 의존) 배치 = member feature 트리(`com.finalcall.domain.member.{controller,service,dto}`, ErrorCode·Properties는 feature 루트).

**프론트엔드**
- **F1. 가입 폼** — email 입력 필드(**선택** 표기) + `@Email` 형식 검증. (계약 §2 확정 후)
- **F2. 이메일 인증 화면**(디자인 게이트 — 새 화면) — 이메일 설정 입력 + 6자리 코드 입력 + 재전송(쿨다운 카운트다운)·시도초과 안내. (디자인 게이트 후)
- **F3. errorCodes.ts** — `EMAIL_001`~`EMAIL_007` 동기화 + 메시지 분리(만료·불일치·시도초과·쿨다운·이미인증·미설정·이미사용중은 재시도성·안내가 각각 다름). (계약 §5 확정 후)
- **F4. GET /me 반영** — `emailVerified`·`emailMasked` 3상태(미설정/미인증/인증완료) 배너·게이트. (F2와 연계)

**의존 요약**: B1→B2→(B6, B7). B3·B4 독립 선행(B1·B2와 병렬). B5는 B3·B4 후 B7 전. 프론트 F1은 §2 계약 확정 후, F2는 디자인 게이트 후. B6(signup)와 B7(email 엔드포인트)는 쓰기 파일 교차(둘 다 api 계층이나 파일 다름 — SignupRequest/AuthController vs MemberController) → 병렬 가능하나 B2 공통 선행.
