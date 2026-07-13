상태: SENT
# [총괄 → 백엔드] 작업 지시: auth 도메인 구현 계획·작업 분해 (G4-1, 핸드오프 규약 D-069)

배경: G3 통과(계약 v1 확정). G4-n 구현 착수, D-002대로 auth 우선. 핸드오프 규약 D-069 확정
— 작업 프롬프트 형식은 templates 18, Claude Code는 부모(백엔드) 대화의 손(별도 outbox·스캔 없음).

목표: auth 도메인(회원가입·로그인·토큰 재발급·로그아웃) 구현 계획 + Claude Code 작업 프롬프트 분해.
완료 기준:
1. auth를 Claude Code 단위로 분해(계약 §2: signup/login/refresh/logout + SEC-006 토큰 전략
   — refresh 서버 저장·회전·재사용 탐지·logout 무효화).
2. 각 단위를 templates 18 형식의 작업 프롬프트로 backend/outbox에 작성(참조 계약 절·erd 테이블·
   DoD 포함). Claude Code는 경로 지정으로 읽는다.
3. 구현 순서·의존 명시(User 엔티티·user_balance·JWT 스켈레톤·refresh 저장소).
4. SCG 엣지 게이트웨이 스켈레톤 확장(D-068)은 별도 단위로 계획(auth 병행 여부 판단).
5. 계획을 총괄에 완료 보고 → 검토 후 Claude Code 착수.
의존: api-contract v1, erd v0.3, CLAUDE.md 컨벤션, B-001~010. (전부 확정 — 착수 가능)
하지 말 것: 계약 변경(6절), auth 외 도메인 선행, 계약 임의 확장.
관련: docs/api-contract.md §2, decision-log D-002·D-065·D-069, templates 18, docs/security/findings.md(SEC-006).

회신: 필요 — auth 구현 계획·작업 프롬프트 세트(총괄 검토).
