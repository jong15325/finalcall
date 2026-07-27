---
id: EPIC-EMAIL-TEMPLATE
type: epic
jira_key: KAN-148
title: 재사용 메일 템플릿 저장소 (DB 문구 보관함)
state: review
children: [FC-133, FC-134, FC-135]
gate: null
---
## 목표
이메일 본문 문구를 코드 상수에 심던 방식을 폐기하고, **재사용 가능한 템플릿을 DB에 저장**한다(제목·본문·형식·사용여부). 이메일 인증이 첫 소비자로 `EMAIL_VERIFICATION` 템플릿을 소비하고, 이후 안내·낙찰알림 등도 같은 저장소를 재사용한다.

## 정본·규약
- **정본 spec**: `docs/spec/email-template-spec.md`(v1.0 DECIDED, 게이트2 승인 2026-07-27).
- **레이어 배치**: 템플릿 = 도메인 feature `com.finalcall.domain.mail`(entity/repository/service). infra `EmailSender`는 템플릿을 모르는 범용 발송기로 축소(`send(to,subject,body,html)`).
- **V2 규약**: ErrorCode(`MailErrorCode`)=`common/exception`, 렌더 VO(`RenderedEmail`)=service 잔류, DTO 없음(내부 기능).
- **게이트2 결정(2026-07-27)**: (1) 새 표 `email_template` 1개 추가 승인, (2) 단순 `{{name}}` 치환(엔진 미도입)·빈칸 미채움 시 발송 실패, (3) `MailErrorCode` **api-contract §5 미등재**(내부 500).

## 사용자 확정 범위 (2026-07-27)
1. 공용 '메일 템플릿' 기능으로 분리(별도 에픽) — 인증이 첫 소비자.
2. 지금은 개발자가 초기 데이터(Flyway 시드)로 문구 주입 — 운영자 편집 화면·권한·버전이력·다국어는 범위 밖.

## 하위 티켓 (spec §9.2)
| 티켓 | Jira | 상태 | 내용 |
|---|---|---|---|
| FC-133 T1 | KAN-149 | doing | Flyway V18 `email_template` + `EMAIL_VERIFICATION` 시드. **FC-129 rework와 병렬** |
| FC-134 T2 | KAN-150 | todo | `EmailTemplate`·`EmailTemplateKey`·`MailContentType`·`EmailTemplateRepository` (T1 후) |
| FC-135 T3 | KAN-151 | todo | `EmailTemplateService`·`RenderedEmail`·`MailErrorCode` (T2 후) |

## 에픽 간 의존 재배선
- **EPIC-EMAIL-TEMPLATE → (blocks) EPIC-EMAIL-VERIFY**: 정확히 T3(FC-135 렌더 서비스) → **FC-132**(소비 배선). FC-132는 FC-135 + FC-129(reworked) 둘 다 선행.
- **FC-129 rework**: EMAIL-VERIFY 소속 유지하되, EmailSender 시그니처 범용화(review→doing 회귀). T1과 파일 무교차 → 병렬.
- 병렬 가능: FC-133(T1) ∥ FC-129(rework) ∥ FC-130 ∥ FC-131(파일 무교차). 수렴점 = FC-132.

## 진행 방식
게이트2 확정 완료 → 구현 팬아웃. 커밋은 매번 사용자 승인(섹션 13). reviewer는 에픽 완료 직전 일괄(렌더 검증·코드 미영속 경계 중점).
