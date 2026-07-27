# Email Template Spec (재사용 메일 템플릿 저장소)

상태: **v1.0 (2026-07-27) — DECIDED. 게이트2 사용자 승인(2026-07-27).**
소유: architect (변경은 계약 변경 절차 `common/rules.md [6]` + 영향 티켓 산출 후 사용자 확인)
정본 에픽: `docs/board/epics/EPIC-EMAIL-TEMPLATE.md`(신규 · 게이트1 분해안 아래 §8)
연동: EPIC-EMAIL-VERIFY(첫 소비자) · `email-verify-spec.md` §6 델타(§7)
근거: CLAUDE.md §4(레이어 규율)·§5(도메인 컨벤션·V2)·layer-restructure-proposal §9.7~§9.10·§10, D-081(soft delete 자연키 UK), V6 `item_template`(마스터/시드 테이블 선례).

---

## 1. 범위와 전제 (사용자 확정 — 재논의 없음)

사용자 확정(2026-07-27, EPIC-EMAIL-VERIFY 진행 중 구조 변경):

1. **공용 '메일 템플릿' 기능으로 분리.** 이메일 본문을 코드 상수에 심는 현행(email-verify-spec §6 / `SmtpEmailSender` 상수)을 폐기하고, **재사용 가능한 템플릿을 DB에 저장**한다. 이메일 인증은 그중 '인증 코드' 템플릿(`EMAIL_VERIFICATION`)을 **소비**한다. 이후 안내·낙찰알림 등도 같은 저장소를 재사용한다. → **새 에픽 EPIC-EMAIL-TEMPLATE**로 분해하고, EMAIL-VERIFY가 이를 의존한다.
2. **지금은 개발자가 초기 데이터로 문구 주입.** Flyway 마이그레이션(V18) 시드로 템플릿을 심는다. **운영자 편집 화면·권한·미리보기·버전 이력은 범위 밖**(향후 별도 에픽). 과설계 금지.

**범위 밖(명시적 이월)**: 운영자 CRUD·권한·미리보기, 템플릿 버전 이력/롤백, 다국어(locale)별 템플릿, 첨부파일, 발송 감사 이력 영속화, 인증 외 실제 소비자(안내·낙찰알림) 구현. 본 스펙은 **저장소 + 렌더링 + 인증 코드 템플릿 1건 소비**까지만 다룬다.

---

## 2. 레이어 배치 결정 (핵심)

### 2.1 문제 — infra는 domain을 의존할 수 없다

현행 `com.finalcall.infra.mail.EmailSender`는 **커널(infra)** 이다. 커널 격리 규칙(§4·proposal §10-c)상 infra는 어떤 도메인 feature도 참조할 수 없다. 따라서 템플릿 **엔티티/리포지토리/렌더링**을 infra에 두면 규율 위반이다(infra→domain 금지). 또한 본문 문구를 `SmtpEmailSender` 상수에 심는 현행은 "재사용 저장소" 요구와 정면충돌한다.

### 2.2 결정 — 템플릿 = 도메인 feature `com.finalcall.domain.mail`, EmailSender = 범용 발송기로 축소

- **신규 feature = `com.finalcall.domain.mail`**(단일 소문자 명사). 이메일 템플릿의 저장·조회·렌더링을 담는다.
  - `entity/` : `EmailTemplate`(엔티티), `EmailTemplateKey`(귀속 enum·자연키), `MailContentType`(귀속 enum: TEXT/HTML)
  - `repository/` : `EmailTemplateRepository`(+ `findByKeyOrThrow`)
  - `service/` : `EmailTemplateService`(렌더링 = 템플릿 조회 + 변수 치환 → 제목·본문 산출), `RenderedEmail`(렌더 결과 계산 VO — 영속 아님·직렬화 아님, §9.10 service 잔류)
- **`com.finalcall.infra.mail.EmailSender` = 템플릿을 모르는 범용 발송기로 축소**: `sendVerificationCode(toEmail, code)` → `send(toEmail, subject, body, html)`. 인증·제목·본문을 모른다. `LoggingEmailSender`(local)·`SmtpEmailSender`(dev/prod) 두 구현 유지, 시그니처만 범용화(§7 델타·FC-129 rework).

**feature명이 `notification`이 아니라 `mail`인 근거**: 사용자 재사용 대상(인증·안내·낙찰알림)은 모두 **이메일**이다. `notification`은 인앱·푸시 등 다채널을 함의해 지금 없는 것을 선반영하는 과설계다(§1 원칙). 구체적으로 존재하는 것 = "이메일 템플릿"이므로 feature명 = `mail`. infra의 `mail`(전송 어댑터)과 동명이지만 최상위 그룹이 다르고(domain vs infra) 관계가 자연스럽다 — **mail 도메인이 mail 인프라를 사용**한다.

### 2.3 조립(오케스트레이션) — 소비자가 render→send를 조립

facade를 신설하지 않는다(과설계 회피). 소비 도메인 서비스가 두 협력자를 직접 조립한다:

```
member/EmailVerificationService (verification-request 경로):
  1) code       = codeStore.issue(userId, email)        // FC-128, 평문 코드(민감값·비영속)
  2) rendered   = emailTemplateService.render(
                      EmailTemplateKey.EMAIL_VERIFICATION,
                      Map.of("code", code, "expiryMinutes", ttlSeconds/60))   // mail feature
  3) emailSender.send(email, rendered.subject(), rendered.body(), rendered.html())  // infra
```

- 의존 방향 검증: `member → mail`(domain→domain, 비순환) · `member → infra.mail`(domain→infra 허용) · `mail → infra`(EmailSender 미참조 — mail은 렌더링만, 발송은 소비자가) · `mail → common`(ErrorCode). **순환 없음, 커널 무침범.** ArchUnit 신규 slice 규칙이 자동 적용된다.
- facade(`mailService.dispatch(to, key, vars)`)를 두면 소비자 코드가 1줄로 줄지만, 지금 소비자는 인증 1곳뿐이라 **지금은 도입하지 않는다**. 소비처가 2곳 이상으로 늘면 그때 facade 승격을 재검토(향후·범위 밖).

---

## 3. 테이블 설계 — Flyway V18 (`email_template`)

V17이 최신 → **V18**. `email_template`는 **개발자 시드 마스터/설정 테이블**이다(사용자 생성 행 아님). 따라서 V6 `item_template` 선례를 따른다 — **soft delete 없음 · D-081 생성 컬럼 UK 패턴 불요**. 삭제 대신 `is_active` 플래그로 비활성화한다. 자연키(`template_key`)에 **직접 UK**를 건다.

```sql
-- V18 (요지)
CREATE TABLE email_template
(
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    template_key VARCHAR(50)  NOT NULL,               -- 자연키 = EmailTemplateKey enum name
    subject      VARCHAR(255) NOT NULL,               -- 제목(치환 대상 placeholder 포함 가능)
    body         TEXT         NOT NULL,               -- 본문(placeholder 포함). TEXT = 장문 안내 대비
    content_type VARCHAR(10)  NOT NULL DEFAULT 'TEXT',-- TEXT | HTML (MailContentType)
    description  VARCHAR(500) NULL,                   -- 사람용 설명(용도·변수 목록 메모, 비-계약)
    is_active    BIT          NOT NULL DEFAULT 1,     -- 비활성화용. 삭제 대신 플래그
    created_at   DATETIME(6)  NOT NULL,
    updated_at   DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_email_template_key (template_key)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
```

**설계 판단 근거**:
- **버전 관리 컬럼 없음**(과설계 경계): 지금은 단순 유지. 마지막 변경 시각은 `updated_at`(BaseTimeEntity)로 충분. 이력/롤백이 필요해지면 별도 에픽(별도 이력 테이블).
- **변수 목록을 DB 컬럼으로 두지 않음**: 변수 계약은 **`EmailTemplateKey` enum에 코드로 선언**(§4.2, 타입 안전·컴파일 시 검증). DB `description`은 사람용 메모일 뿐 렌더링·검증에 쓰이지 않는다. DB를 파싱해 변수 목록을 관리하는 부담을 피한다.
- **`content_type`을 컬럼으로**: 인증 메일은 TEXT면 충분하나, '안내' 재사용 시 HTML이 필요하다. 템플릿별로 형식을 저장해 EmailSender가 그대로 발송한다(§5·§4.4).

엔티티 `EmailTemplate`는 `BaseTimeEntity` 상속 · `@NoArgsConstructor(PROTECTED)` · 생성자 `@Builder` · `@Setter` 금지(§5). 상태 변경 필요 시 도메인 메서드(예 `activate()`/`deactivate()`) — 단 이번 범위는 읽기·시드 위주라 setter성 메서드 최소.

### 3.1 초기 시드 (V18 동일 마이그레이션 · 인증 코드 템플릿)

EMAIL-VERIFY의 첫 소비 템플릿. 현행 `SmtpEmailSender` 상수(SUBJECT·BODY)를 DB로 이관하되 코드 자리는 **placeholder**로 둔다(§6 — 실제 코드는 절대 영속되지 않음).

```sql
INSERT INTO email_template (template_key, subject, body, content_type, description, is_active, created_at, updated_at)
VALUES ('EMAIL_VERIFICATION',
        '[장터] 이메일 인증 코드',
        '장터 이메일 인증 코드입니다.\n\n인증 코드: {{code}}\n\n위 코드를 {{expiryMinutes}}분 안에 입력해 주세요. 시간이 지나면 코드를 다시 요청해야 합니다.\n본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.',
        'TEXT', '회원가입 이메일 인증 코드. 변수: code, expiryMinutes', 1, NOW(6), NOW(6));
```

---

## 4. 템플릿 모델 (키·변수 계약)

### 4.1 템플릿 키 = enum(문자열 자연키)

`EmailTemplateKey`(enum, `entity/`). enum name = DB `template_key`. **문자열 자연키를 enum으로 못박아** 소비자가 오타 없이 타입 안전하게 참조한다(문자열 리터럴 산발 방지). 첫 값:

| enum | template_key | 용도 | 필수 변수 |
|---|---|---|---|
| `EMAIL_VERIFICATION` | `EMAIL_VERIFICATION` | 회원가입 이메일 인증 코드 | `code`, `expiryMinutes` |

향후 값(범위 밖·예시): `AUCTION_WON`(낙찰 안내), `OUTBID`(상위 입찰 알림) 등은 각자 소비 에픽에서 enum 값 + 시드 추가.

### 4.2 변수 계약 = enum 선언 + 렌더 검증

각 `EmailTemplateKey`는 **필수 변수 이름 집합**을 코드로 선언한다(예 `EMAIL_VERIFICATION` → `{"code", "expiryMinutes"}`). 렌더링은 이 계약으로 누락/오타를 잡는다(§5 검증 정책). DB엔 변수 스키마를 두지 않는다(단일 진실원 = enum).

---

## 5. 렌더링 방식

### 5.1 치환 엔진 = 단순 placeholder 치환 (템플릿 엔진 미도입)

**Thymeleaf 등 무거운 템플릿 엔진을 도입하지 않는다**(과설계 회피). 문법·표현식·조건/반복이 필요 없고, 지금 요구는 "이름→값 자리 치환"뿐이다. 자체 치환기(수십 줄)로 충분하다:

- **placeholder 문법 = `{{name}}`**(이중 중괄호). 평문/HTML 본문과 충돌이 적고 가독성이 좋다.
- 제목·본문 양쪽에 적용. 주어진 변수 맵의 각 `{{name}}`을 문자열 값으로 치환.

### 5.2 변수 검증 정책 (fail-fast)

- **누락 검증**: `EmailTemplateKey`가 선언한 필수 변수가 인자 맵에 없으면 렌더 실패(예외). "`{{code}}`"가 그대로 발송되는 사고를 막는다.
- **잔여 placeholder 검증**: 치환 후 본문/제목에 `{{...}}` 토큰이 남으면 실패 — 템플릿 문구와 enum 변수 계약이 어긋난(오타·드리프트) 신호. 이 검사가 오타를 잡는다.
- **여분 변수**: 계약에 없는 여분 인자는 무시(관대). 누락·잔여에만 엄격.
- 렌더 실패는 **서버 측 설정/시드 결함**(개발자 책임)이지 클라이언트 입력 오류가 아니다 → 500 계열(§4.3의 `MailErrorCode`). 인증 흐름에선 `verification-request`만 실패시키고 가입·로그인엔 무영향(현행 실패 전파 계약과 동형).

### 5.3 렌더 결과 = `RenderedEmail`(계산 VO)

`EmailTemplateService.render(key, vars)` → `RenderedEmail(String subject, String body, boolean html)`. `html`은 템플릿 `content_type`에서 파생(HTML→true). **영속 아님·직렬화 아님** → §9.10에 따라 `domain/mail/service/`에 record로 잔류(도메인 명사, 서비스 접미사 없음). 소비자(member 서비스)는 이 값을 `EmailSender.send(...)`로 넘길 뿐 어디에도 저장하지 않는다.

### 5.4 렌더링 에러코드 — `MailErrorCode`(신규 · common/exception)

V2 규약상 도메인 에러 enum은 `com.finalcall.common.exception`에 둔다(§9.8). `MailErrorCode`(`MAIL_{3자리}`, `ErrorCode` 구현):

| 코드 | 상태 | 의미 |
|---|---|---|
| `MAIL_001` | 500 | 템플릿 없음/비활성(`template_key` 미스/`is_active=0`) |
| `MAIL_002` | 500 | 필수 변수 누락·치환 후 잔여 placeholder(템플릿↔변수 계약 드리프트) |

이들은 **서버 측 설정 결함**(500)이며 클라이언트가 행동으로 해소할 코드가 아니다 → **api-contract §5 미등재로 확정**(게이트2 사용자 승인, 2026-07-27 — 권장안 채택). `GlobalExceptionHandler`가 일반 500으로 처리하며 프론트 `errorCodes.ts` 동기화 부담이 없다(사용자·클라이언트 계약 표면을 늘리지 않는다). 등재 시 enum↔계약 parity는 좋아지나 non-actionable 코드로 프론트 테이블·테스트가 커지므로 채택하지 않는다.

---

## 6. 보안 — 코드 미영속·변수 주입 경계 (필수)

- **인증 코드는 템플릿 DB에 절대 영속되지 않는다.** `email_template.body`엔 `{{code}}` **자리(placeholder)만** 저장된다. 실제 6자리 코드는 요청 시점에 `EmailVerificationCodeStore.issue`(FC-128)가 생성해 **렌더 인자 맵으로만** 주입되고, Redis엔 SHA-256 해시로만 남는다(email-verify-spec §2.3).
- **렌더 결과(`RenderedEmail`)에 실제 코드가 담기지만 전송 직전 값(transient)** 이다 — 어디에도 저장/로그되지 않는다. `LoggingEmailSender`가 코드를 로그로 남기는 것은 **local(sender-enabled=false) 한정**이며 운영 프로파일에선 비활성(email-verify-spec §6.3 유지). 이 경계는 EmailSender 범용화 후에도 불변.
- 요약: **템플릿 테이블 = 자리(placeholder)만 · 코드 값 = 런타임 주입 · 저장은 Redis 해시뿐.** 코드가 email_template에 영속되면 안 된다.

---

## 7. api-contract 영향

**외부 계약 변화 없음.** 본 기능은 내부(엔드포인트·요청/응답 형상 무변경). EMAIL-VERIFY 엔드포인트 3종·`EMAIL_*` 클라이언트 에러코드(api-contract v1.15)는 그대로다. §5.4 `MailErrorCode`(내부 500)는 **api-contract §5 미등재로 확정**(게이트2 사용자 승인, 2026-07-27) → api-contract·프론트 `errorCodes.ts` 모두 무변경.

---

## 8. email-verify-spec §6 델타 제안 (확정본 — 직접 수정 금지, 변경안만 제시)

`email-verify-spec.md`는 확정본(v0.1)이라 **직접 수정하지 않는다.** 사용자 확인 후 아래 델타를 반영한다.

- **§6.1(의존성)**: 무변경(`spring-boot-starter-mail` 유지).
- **§6.2(application.yml)**: 무변경. 템플릿은 DB이므로 yml에 문구·템플릿 설정을 추가하지 않는다.
- **§6.3(로컬/운영 거동) — 문구 이관**:
  - (삭제) "인증 코드 메일 템플릿(제목·본문)을 코드에 심는다" 취지의 서술 및 `SmtpEmailSender` 내 `SUBJECT`/`BODY_TEMPLATE` 상수 근거.
  - (추가) "인증 코드 메일 문구 = **mail feature의 `EMAIL_VERIFICATION` 템플릿(DB)** 을 소비한다. member 도메인 서비스가 `EmailTemplateService.render(EMAIL_VERIFICATION, {code, expiryMinutes})`로 (제목·본문)을 얻어 `EmailSender.send(toEmail, subject, body, html=false)`로 발송한다. `EmailSender` 시그니처는 `sendVerificationCode(toEmail, code)` → `send(toEmail, subject, body, html)`로 **범용화**된다(템플릿·인증을 모르는 순수 발송기). `expiryMinutes`는 `EmailVerifyProperties.ttlSeconds/60`에서 파생(신규 property 없음)."
  - (유지) local skip+코드 로그 · dev/prod 실발송·fail-fast · 발송 실패는 verification-request만 실패시키고 가입·로그인 무영향 — 전부 불변.
- **§8(하위 티켓 분해안) B4 각주**: B4(FC-129)는 "코드 메일 템플릿(제목·본문)" 책임을 **제거**하고 범용 발송기로 축소된다(§9 영향 티켓). 템플릿 책임은 EPIC-EMAIL-TEMPLATE로 이관.

---

## 9. 영향 티켓 · 신규 에픽 분해안 (게이트1 조정 대상)

### 9.1 기존 EMAIL-VERIFY 티켓 영향

| 티켓 | 현 상태 | 영향 | 조치 |
|---|---|---|---|
| **FC-128** (B3 CodeStore) | review | **없음** | `issue()`가 평문 코드를 반환·Redis엔 해시만 — 코드가 렌더 인자로 흐르는 구조와 정합. 무변경. |
| **FC-129** (B4 메일 인프라) | review | **rework 필요** | `EmailSender.sendVerificationCode(to,code)` → `send(to,subject,body,html)` 범용화. `SmtpEmailSender`의 `SUBJECT`/`BODY_TEMPLATE` 상수 제거, HTML 대비 `MimeMessage`/`MimeMessageHelper`(html 분기)로 전환(현행 `SimpleMailMessage`는 text 전용). 인증 코드 템플릿 책임 삭제(EMAIL-TEMPLATE로 이관). → review에서 doing 회귀 필요(전이 주체=메인세션). |
| **FC-130** (B5 ErrorCode·Properties·yml) | todo | **거의 없음** | EmailVerify 에러/Properties/yml 불변. `MailErrorCode`는 EMAIL-TEMPLATE 소관(FC-130 아님). `expiryMinutes`는 기존 `ttl-seconds`에서 파생 — 신규 property 없음. |
| **FC-132** (B7 엔드포인트+service) | todo | **소비 배선 추가** | `EmailVerificationService`가 `EmailSender`를 직접 호출하던 것을 **`EmailTemplateService.render` → `EmailSender.send`** 조립으로 변경. `depends_on`에 EMAIL-TEMPLATE의 렌더 서비스 티켓(FC-135) 추가. 엔드포인트 계약·형상은 불변. |

### 9.2 신규 에픽 EPIC-EMAIL-TEMPLATE 하위 티켓 (쓰기 파일 집합 기준 병렬성)

feature = `com.finalcall.domain.mail`. 티켓 ID는 총괄 부여(아래는 논리 라벨·의존).

- **T1 — Flyway V18 `email_template` + 시드**: 테이블 DDL + `EMAIL_VERIFICATION` 시드 1건. (단일 마이그레이션 파일, 선행 없음. **FC-129 rework와 파일 무교차 → 병렬 가능**)
- **T2 — 엔티티·리포지토리**: `EmailTemplate`(BaseTimeEntity)·`EmailTemplateKey` enum(자연키+필수변수)·`MailContentType` enum·`EmailTemplateRepository`(`findByKeyOrThrow`). (T1 의존 — schema validate)
- **T3 — 렌더링 서비스**: `EmailTemplateService`(조회+placeholder 치환+변수 검증)·`RenderedEmail`(service VO)·`MailErrorCode`(common/exception, MAIL_001/002). (T2 의존)

의존: **T1 →(병렬 FC-129 rework)** · T1 → T2 → T3. 에픽 내부는 소규모라 대체로 선형(T1↔FC-129만 병렬).

### 9.3 에픽 간 의존 재배선

- **EPIC-EMAIL-TEMPLATE → (blocks) EPIC-EMAIL-VERIFY**: 정확히는 T3(렌더 서비스) → **FC-132**(소비). FC-132는 T3 + FC-129(reworked 범용 발송기) 둘 다 선행.
- **EPIC-EMAIL-VERIFY**는 EMAIL-TEMPLATE를 **의존(소비)** 관계로 표기. EMAIL-VERIFY의 나머지(FC-128·130·131·117·118)는 EMAIL-TEMPLATE와 무관하게 진행.
- 병렬 가능: T1 ∥ FC-129(rework) ∥ FC-130 ∥ FC-131(파일 무교차). 수렴점 = FC-132.

### 9.4 게이트2 결정(사용자 승인, 2026-07-27)

- 새 테이블 `email_template` 1개 추가 — **승인**.
- `MailErrorCode`(내부 500) api-contract §5 **미등재로 확정**(권장안 채택).

---

## 10. 게이트2 상신 요약 (사용자용 · 평문) — 결정됨(2026-07-27 승인, 아래는 상신 원문)

**무엇을 바꾸나**: 이메일 본문 문구를 지금은 코드 안에 박아 두는데, 이걸 **DB의 '메일 문구 보관함'** 으로 옮긴다. 인증 메일은 그 보관함에서 '인증 코드' 문구를 꺼내 쓴다. 나중에 안내·낙찰 알림 메일도 같은 보관함을 재사용한다. (운영자가 화면에서 편집하는 기능은 지금 안 만든다 — 개발자가 초기 문구를 심어 둔다.)

**결정해 주실 갈림길**:

1. **새 보관함(표) 1개 추가** — 이메일 문구를 담는 `email_template` 표를 새로 만든다(제목·본문·형식·사용여부). 되돌리기: 표 하나 추가라 롤백 쉬움(참조 코드만 이전 상수 방식으로 복원). → 승인 요청.
2. **문구 안의 '빈칸' 채우는 방식** — 문구에 `{{code}}` 같은 빈칸을 두고 보낼 때 실제 값을 끼워 넣는다. 무거운 템플릿 엔진(Thymeleaf 등) 대신 **간단한 빈칸 치환**만 쓴다(지금 요구엔 충분·과설계 방지). 빈칸을 안 채우면 발송이 실패하도록 막아 "빈칸이 그대로 나가는 사고"를 방지. → 이 방향 확인.
3. **보관 문구 키 목록(지금은 1개)** — `EMAIL_VERIFICATION`(인증 코드) 하나만 심는다. 안내·낙찰알림은 각각 필요할 때 추가. → 확인.
4. **보안 경계** — 실제 인증 코드는 **표에 저장하지 않는다**(표엔 빈칸만, 코드는 보낼 때만 잠깐 끼워 넣고 Redis엔 암호화 해시로만 남음). → 확인(기술 상세는 architect 책임).
5. **되돌리기 비용** — 표 추가 + 발송기 함수 시그니처 1개 범용화(이미 만든 FC-129 소폭 재작업) + 인증 서비스가 보관함을 쓰도록 배선. 외부 API·화면 계약은 **안 바뀐다**. 되돌리기 저비용.

**기술 상세(사용자 판단 불요, architect 책임)**: 레이어 배치(mail 도메인 feature 신설·infra 발송기 축소), 표 컬럼·UK, 렌더 검증 규칙, `MailErrorCode` 내부코드 등재 여부(권장 미등재).
