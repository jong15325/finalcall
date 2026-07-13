상태: SENT
# [총괄 → 기획/설계] 작업 지시: 보안 게이트 1 findings 계약 반영 (SEC 7건 + 관찰 정정)

배경: 보안 게이트 1 조건부 통과(S-001, Critical 없음). 계약 문안 영향 SEC 7건을 api-contract
초안(v0.1, 미확정)에 반영해 v1 확정 전 처리한다(6절 아닌 초안 수정). 상세는 docs/security/findings.md.

반영 항목:
1. SEC-002(최우선) 충전 confirm: 인증 주체 바인딩 명시 + 금액은 토스 서버-투-서버 승인 기준
   (클라 amount 신뢰 금지) 명문화. §4.4 charges/confirm.
2. SEC-001 충전 멱등 앵커: 클라 idempotencyKey → pg_tx_id(paymentKey) UK 기준으로 변경.
3. SEC-003 자기구매 차단: buyNow·고정가 구매에 판매자 자기구매 금지(BID_003 대칭), 에러코드 추가.
4. SEC-004 /exchanges 멱등성: 교환 요청 멱등키·재시도 안전 규약 추가.
5. SEC-006 토큰 전략: §2에 refresh 서버 저장·회전·재사용 탐지·logout 무효화 명문화.
6. SEC-007 가입 열거: signup/login 오류 응답의 계정 열거 방지(모호화).
7. SEC-009 경매 시간 파라미터 검증: startAt/endAt/maxEndAt·소프트클로즈 값 서버 검증 규칙.

추가 정정(035 관찰): item_template 외부 식별자 정합(typeCode vs public_id) 일치.

의존: 없음(계약 DRAFT). SEC-005는 D-068(SCG 엣지 게이트웨이)로 해소·계약 무영향. SEC-008·011은
게이트 2 이월.
하지 말 것: v1 확정 표기(보안 델타 재확인 + 사용자 승인 후 G3).
관련: docs/security/findings.md, docs/api-contract.md, decision-log D-068·D-051~053·D-065.

회신: 필요 — 계약 반영 완료 보고(보안 델타 재확인용).
