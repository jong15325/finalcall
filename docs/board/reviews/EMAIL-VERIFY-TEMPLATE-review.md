# 통합 리뷰 — EPIC-EMAIL-VERIFY + EPIC-EMAIL-TEMPLATE

- 일자: 2026-07-27
- 리뷰어: reviewer (읽기 전용)
- 범위: `6b2f7e7..HEAD`(이번 세션 이메일 인증·템플릿 구현 13커밋). concurrency-review 스킬 적용.
- 대상 티켓: FC-118·128·129·130·131·132(EMAIL-VERIFY) · FC-133·134·135(EMAIL-TEMPLATE)
- 검증: `*Email*/*Mail*/*Auth*/*Architecture*` 테스트 green.

## 판정
- **critical 0 · major 1 · minor 다수.**
- major(M-1)는 **수정 진행**(총괄 판단 2026-07-27 — 보안 플래그 lost-update, 수정 저비용). 수정 후 재리뷰/게이트3.

## MAJOR
### M-1 — verify() 성공 커밋의 detached blind-merge lost-update (TOCTOU 잔여) → **수정함(FC-132 rework)**
- 위치: `domain/member/service/EmailVerificationService.java` verify() SUCCESS 경로.
- 문제: `@Transactional(NOT_SUPPORTED)`로 detached 로드 후 `save(user)`가 전체 컬럼 blind UPDATE(@Version 없음). 동일 사용자 verify∥setEmail 경쟁 시 뒤늦은 verify write가 setEmail 커밋을 덮어써 구 이메일을 verified=true로 확정(lost update). 자기계정·저확률·무금전이나 문서화된 clear 방어를 뚫음.
- 조치: 성공 커밋을 **조건부 원자 UPDATE**(`email_verified=true WHERE id=? AND email=검증한이메일 AND is_deleted=false`)로 교체. 영향 행 0이면(검증~커밋 사이 이메일 변경) 미반영·`EMAIL_002`. 조건부 UPDATE는 짧은 쓰기 트랜잭션에서 실행. codeLength 오버플로 가드(m-3)도 함께.

## MINOR (후속)
- m-1 프론트 `errorCodes.ts` EMAIL_001~007 미동기화 — **F3 티켓 소관**(백엔드 게이트3 비차단, 프론트 통합 전 선행 필수).
- m-2 `EmailVerifyRequest @Pattern("\\d{6}")` 자릿수 하드코딩 — spec "6 고정"이라 현행 정합(codeLength 가변화 시 드리프트 주의).
- m-3 `generateCode` codeLength≥10 시 int 오버플로 — **m-3로 수정**(codeLength 상한 제약).
- m-4 spec §2.3 "상수시간 비교" 문구 ↔ 구현 Lua `==`(해시 비교라 타이밍 노출 미미, 원자성 우선) — 구현 근거 타당, **spec 문구 갱신 권고**(architect 후속).
- m-5 setEmail의 Redis clear가 DB tx 안(commit 실패 시 코드만 삭제) — 무해(재요청 자연 해소).

## 통과 확인 항목
동시성 Lua 원자성(attempts 누수 없음·쿨다운 SET NX) · TOCTOU 주 방어(clear+emailHash, no-op 재설정) · SEC-007 열거방지(주체=SecurityContext·EMAIL_002 통일·202 비확증·마스킹) · 인가/IDOR(주체 본인만) · 코드 미영속(DB placeholder·Redis 해시·@ServiceLog 인자 미덤프·Logging local 한정·RenderedEmail transient) · 트랜잭션 경계(SMTP/Redis tx 밖) · 에러코드/형상 정합(EMAIL/MAIL 상태코드·응답 키) · 렌더 fail-fast(MAIL_001/002) · fail-fast Properties·시크릿 env-only · 레이어/V2 어휘(ArchUnit green).
