---
id: EPIC-EMAIL-VERIFY
type: epic
jira_key: KAN-134
title: 회원가입 이메일 인증 (FC-114 실기능화)
state: done
children: [FC-117, FC-118, FC-128, FC-129, FC-130, FC-131, FC-132]
gate: null
---
## 목표
회원가입에 이메일 인증을 도입한다. 사용자와 **단계별 협업(하나하나)**으로 설계 확정 후 구현. FC-114 백로그의 실기능화.

## 현황 (그린필드 — 2026-07-24 확인)
- `Member` 엔티티에 email 필드 **없음**(loginId·passwordHash·nickname만).
- signup 계약 `{ loginId, password, nickname }` → email 미포함.
- 이메일 발송 인프라 **전무**(JavaMailSender·starter-mail·SMTP 설정 없음).

## 확정된 결정 (사용자, 2026-07-24)
1. **인증 흐름 = 가입 후 인증.** 계정을 먼저 생성(미인증 상태) → 이메일 인증은 나중에. 미인증이면 일부 기능 제한.
2. **인증 방식 = 6자리 코드 입력.** 앱 안에서 완결(별도 랜딩 페이지 불필요). 코드 만료·재전송·시도제한 필요.
3. **발송 수단 = 진짜 SMTP 발송(Gmail/네이버).** 표준 `JavaMailSender`. ★ 크리덴셜은 **사용자가 env로 직접** 주입(총괄이 대신 입력 불가 — 보안). 로컬 기본값 없이 fail-fast 또는 미설정 시 발송 스킵 처리(구현 시 확정).

4. **발송 제공자 = 네이버.** `smtp.naver.com:465`(SSL). 크리덴셜은 사용자가 env 주입(네이버 메일 POP3/SMTP 사용 설정 + 계정/애플리케이션 비밀번호).

5. **데이터·계약(게이트2 확정, 2026-07-24 사용자)**:
   - **이메일 = 가입 시 선택**(필수 아님). 가입 후 나중에 추가 가능 → **set-email 엔드포인트 필요**. Member.email nullable.
   - **이메일 유니크**(활성 회원 기준, `email_active` 생성컬럼 — 기존 login_id_active 패턴 동형).
   - **정책값 = 만료 10분 · 재전송 쿨다운 60초 · 시도 5회 · 6자리**.
   - 기술 기본값(채택): 코드 저장 **Redis TTL·SHA-256 해시**(RefreshTokenStore 패턴 재사용) · `GET /me`는 **emailVerified만** 노출(이메일 원문 미노출) · 로컬 **발송 스킵+코드 로그** / 운영 실발송·fail-fast · 의존성 `spring-boot-starter-mail`.
   - Flyway **V17**(email·email_active 컬럼 추가). 에러코드 **EMAIL_*** 신규(계약 §5 + 프론트 errorCodes 동기화 강제).
   - spec: `docs/spec/email-verify-spec.md`(architect 확정) · api-contract v1.15.

## 열린 결정 (진행하며 확정)
- **6. 미인증 제한 정책(이월)** — 어떤 기능을 미인증 시 막나(입찰·판매 등). **핵심 인증 동작 후 별도 결정**(독립 정책 층 — 코어 구현 안 막음).
- **7. 프론트 UI** — 가입 email 입력 + 마이페이지/배너 인증 진입 + 코드 입력 화면.

## 재개 (2026-07-26) — 선행 에픽 완료
EPIC-RESTRUCTURE·EPIC-CONVENTION-V2 완료로 **구현 재개**(설계·게이트2 기확정, 재게이트 불요). FC-117·118 unblock. **V2 확정 규약 적용**: User=`com.finalcall.domain.member.entity`, ErrorCode=`common/exception`(EmailErrorCode), Properties=member `config/`, DTO=Request/Response.
분해(spec §8): FC-117(B1 V17)→FC-118(B2 User 필드)→**FC-128(B3 코드저장소)∥FC-129(B4 메일인프라)**→FC-130(B5 ErrorCode·Properties·yml)→**FC-131(B6 signup)∥FC-132(B7 엔드포인트 3종)**. 프론트 F1~F4는 백엔드 계약 확정 후 별도 발번(F2 이메일 인증 화면=디자인 게이트).
※ 엔드포인트 티켓 발번은 **FC-128~**(FC-123~127은 EPIC-CONVENTION-V2 선점).

## 구조 변경 (2026-07-27 · 게이트2) — 메일 문구 DB 이관
사용자 요청으로 이메일 본문을 코드 상수에 심던 방식을 폐기하고 **재사용 템플릿을 DB 저장**하는 방향 승인. 별도 에픽 **EPIC-EMAIL-TEMPLATE**(feature `com.finalcall.domain.mail`, spec `email-template-spec.md` v1.0)로 분리하고 본 에픽이 이를 **의존(소비)** 한다.
- **FC-129 rework**: EmailSender 시그니처 `sendVerificationCode(to,code)`→`send(to,subject,body,html)` 범용화(문구 책임 제거). review→doing 회귀.
- **FC-132**: `EmailTemplateService.render`→`EmailSender.send` 조립으로 배선. depends_on에 FC-135(렌더 서비스) 추가.
- FC-128·130·131·117·118은 EMAIL-TEMPLATE와 무관하게 진행. 수렴점 = FC-132. api-contract 외부 계약 불변.

## 진행 방식
각 결정을 사용자와 확정 → architect가 계약(§) 반영 → backend-impl/frontend-impl 구현 → reviewer → Done. 커밋은 매번 사용자 승인(섹션 13).
