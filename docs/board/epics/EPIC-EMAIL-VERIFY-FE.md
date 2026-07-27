---
id: EPIC-EMAIL-VERIFY-FE
type: epic
derived_from: EPIC-EMAIL-VERIFY
jira_key: KAN-152
title: 이메일 인증 프론트엔드 (F1~F4)
state: done
children: [FC-136, FC-137, FC-138, FC-139]
gate: null
---
## 목표
EPIC-EMAIL-VERIFY 백엔드 계약(api-contract v1.15 · push 완료)을 프론트에서 실기능화한다. 회원가입 이메일 선택 입력·이메일 인증 화면(설정/6자리 코드/재전송 쿨다운/시도초과)·GET /me 3상태 배너를 구현한다. 백엔드 에픽은 done(무변경) — 이 에픽은 그 계약의 클라이언트 소비다.

## 게이트
- **게이트1(에픽 승인)**: 사용자에게 분해안(FC-136~139) 제시·"이대로 구현 진행" 승인(2026-07-27).
- **디자인 게이트(F2 = 새 화면)**: 목업 `docs/ux/mockups/template-email-verify.html` 선제작·사용자 승인 완료(2026-07-27). 기존 `template-auth-signup.html` 토큰 계승, 웹/모바일 별도 설계, 3상태+7에러코드 카탈로그.

## 분해 (spec §8 프론트)
- **FC-136 (F3) errorCodes.ts 동기화** — `EMAIL_001~007` + 메시지 분리. **빌드 선행 필수**(`errorCodes.test.ts`가 api-contract §5 파싱 → 미동기화면 프론트 테스트 실패). blocks F1·F2·F4.
- **FC-137 (F1) 가입 폼 email 선택 입력** — `SignupForm` email 필드(선택 표기)·`@Email` 검증. (auth feature — F2/F4와 파일 무교차)
- **FC-138 (F2) 이메일 인증 화면** — `VerificationCard` 활성화(현 "준비 중" 자리보류 해제) + 이메일 설정/코드 입력/재전송/시도초과 흐름 + `lib/api/email.ts` 신설. 디자인 게이트 통과.
- **FC-139 (F4) GET /me 3상태 반영** — `emailVerified`·`emailMasked` 소비, 미설정/미인증/인증완료 배너·게이트. F2 연계(같은 member feature — F2와 함께 구현).

## 의존·순서
FC-136(선행·단독) → FC-137 ∥ (FC-138 + FC-139). FC-138·139는 member feature·me 쿼리·email api 공유로 묶어 구현. 동일 워킹트리 npm 빌드 경합 회피 위해 순차 위임(교훈: 서브에이전트 병렬=빌드 경합).

## 범위 밖
- 미인증 기능 제한 정책(입찰·판매 차단 등 — spec 열린 결정 6, 이월).
- 네이버 SMTP 실발송 테스트(사용자 env 주입 시 별도).
