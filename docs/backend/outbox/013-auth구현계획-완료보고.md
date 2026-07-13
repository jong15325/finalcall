상태: SENT
회신대상: management/outbox/040-백엔드-auth구현계획.md
# [백엔드 → 총괄] 완료 보고: auth 구현 계획·작업 프롬프트 세트 (G4-1)

산출물 경로:
- 작업 프롬프트(templates 18, Claude Code 대상) — backend/outbox/006~012:
  006 auth 기반(User·UserBalance·UserRepository·AuthErrorCode·V1 정합)
  007 토큰·refresh 인프라(access JWT 재사용 + Redis refresh 저장소)
  008 signup / 009 login / 010 refresh / 011 logout
  012 SCG 엣지 게이트웨이 스켈레톤(D-068)
- 결정: decision-log B-011(refresh 저장소 Redis).

완료 기준 충족:
1. auth 단위 분해(signup/login/refresh/logout + SEC-006 토큰 전략) — 충족(006~011). 토큰 전략은 007에 집약.
2. templates 18 형식 작업 프롬프트 backend/outbox 작성(참조 계약 절·erd 테이블·DoD 포함) — 충족.
3. 구현 순서·의존 — 충족. 순서 A(006)→B(007)→{C(008)·D(009)·E(010)·F(011)}. C는 A만 의존해 B와 병행 가능. 선행 = User/UserBalance(A)·JWT 스켈레톤 재사용·refresh Redis(B).
4. SCG 게이트웨이(D-068) 별도 단위(012) — 충족. auth와 독립 병행 가능하나 우선순위는 auth(A~F). auth 착수 후 여력 시 병행 권장.
5. 완료 보고 — 본 문서.

스켈레톤 재사용 확인: access JWT는 이미 구비(infra/security/HmacTokenProvider·JwtAuthenticationFilter·SecurityConfig, common/security/TokenProvider). 신규는 도메인(User·잔액)·refresh Redis·실제 4개 엔드포인트(데모 AuthController 대체).

계약 정합 이슈(회신 필요 — 6절 대상 가능):
- api-contract §2 `POST /refresh` 응답이 `{ accessToken, accessExpiresAt }`로 refreshToken 미포함인데, SEC-006은 "재발급 시 refresh 회전(이전 폐기)"을 요구 → 회전한 신규 refresh를 클라이언트가 수신할 수 없는 모순.
- 선택지: (a) /refresh 응답에 `refreshToken` 추가(회전분 전달, 계약 변경 6절) — 추천. (b) 회전을 매 재발급이 아닌 임계시점만(계약 유지, 재사용 탐지 완화). 프론트 영향 있어 총괄·기획 결정 요청.
- 010(refresh) 단위는 이 회신 전까지 조건부 보류(가정=(a) 표기). 나머지 006~009·011~012는 착수 가능.

다음 단계 제안:
- 총괄 검토 후 Claude Code 착수: 006→007 선행, 이후 008~011. 012는 병행/후속.
- 계약 정합 이슈 회신 후 010 최종화. 회신이 (a)면 기획 api-contract 6절 갱신 필요.

회신: 필요 — (1) 계획 검토 결과, (2) refresh 계약 정합 결정((a)/(b)).

신규 발번 ID: B-011 (ACCEPTED, refresh 저장소 Redis)
