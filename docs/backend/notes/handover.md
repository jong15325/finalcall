# 백엔드 handover (2026-07-13)

D-059 핸드오버. "파일에 없는 기억"만. 기존 내용은 경로 참조. 재개 시 이 파일부터 읽는다.

## 진행 중
- G4-1 auth 도메인 구현(총괄 승인, mgmt/outbox/041). Claude Code가 손(D-069).
- 완료: 유닛 A(006 기반: User·UserBalance·Repository·AuthErrorCode·V3 마이그레이션), 유닛 B(007 토큰·refresh Redis 인프라). 둘 다 src에 반영, 빌드·테스트 통과.
- 다음 착수 가능: C(008 signup), D(009 login), F(011 logout), G(012 SCG 게이트웨이). 프롬프트는 backend/outbox/008·009·011·012.

## 대기 중(블로커)
- E(010 refresh): 기획 api-contract v1.1(D-070 — /refresh 응답에 refreshToken 추가) 확정 후 최종화. 지시됨(mgmt/outbox/042). 그 전 착수 금지. outbox/010 상태 HOLD.
- erd §6 Flyway 매핑 정정: backend/outbox/014 회신 대기(기획·총괄). B-012 관련.
- 총괄 auth 완료 보고(041 회신 필요): 현재 A·B만 완료 → 유닛 더 진행 후 묶음 보고 예정.
- refresh 만료 14일(B-013)·클레임 단일화(B-014)는 잠정/흡수분 — 보안 게이트2 검토 대상.

## 휘발성 맥락(파일에 없음)
- 구현 손 방식: Claude Code 킥오프 = notes/claude-code-kickoff.md, 마지막 줄 작업 프롬프트 경로만 교체. 완료 보고 텍스트를 백엔드 대화가 흡수.
- RefreshTokenStore(B-011): refresh 원문 `userId.sessionId.secret`, 서버는 SHA-256 해시만 저장(라우팅용 userId·sessionId만 평문). 재사용 탐지=세션 전체 무효화(탈취 대응). 009 login=issue, 010 refresh=rotate(반환 Optional.empty()→AUTH_004), 011 logout=revoke.
- 토큰(B-014): filter principal=userId, isAdmin→ROLE_ADMIN 선반영. RefreshTokenStore 테스트는 Testcontainers Redis 통합(단위 대체).
- On-Race 차용 패턴(입찰/정산 구현 시): notes/onrace-reference.md.

## 재개 필독(경로·순서)
1. notes/handover.md(이 파일)
2. inbox-log.md + "수신함 확인" 스캔(신규 [→ 백엔드], B- 언급) — 특히 mgmt/042(계약 v1.1), outbox/014 회신, 041 auth 완료 보고 요청.
3. decision-log.md B-001~014
4. 확정 스펙: docs/domain-spec.md, docs/erd.md, docs/api-contract.md + 저장소 루트 CLAUDE.md
5. 진행: backend/outbox 008·009·011·012 프롬프트 → Claude Code. 010은 계약 v1.1 확정 후.
