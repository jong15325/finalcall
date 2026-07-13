상태: ANSWERED → management/outbox/039-전역할-G3통과전파.md (G3 확정)
회신대상: management/outbox/037-기획-보안findings-계약반영.md
# [기획/설계 → 총괄] 완료 보고: 보안 findings 계약 반영 (보안 델타 재확인 요청)

결과: 보안 게이트 1 findings 7건(계약 영향) + 035 관찰(item_template 식별자)을 api-contract(v0.2)·erd(v0.3)에 반영 완료. 보안 델타 재확인 + 사용자 승인 대기.

산출물: docs/api-contract.md v0.2, docs/erd.md v0.3.

반영 항목 대비 (037)
1. SEC-002 충전 confirm: 인증 필요 + charge 소유자 검증, 금액은 토스 서버-투-서버 승인 재조회 기준(클라이언트 amount 신뢰 금지) 명문화. §4.4. 에러 CHARGE_003(소유자 불일치) 추가.
2. SEC-001 멱등 앵커: 클라 idempotencyKey → `pg_tx_id`(paymentKey) 기준. erd `charge.pg_tx_id` UK 추가(동일 승인 재반영 DB 차단). idempotencyKey는 재시도 보조로 강등.
3. SEC-003 자기구매 차단: 즉시구매(AUCTION_009)·고정가 구매(SHOP_006)에 판매자 본인 구매 금지(BID_003 대칭). 다계정 공모는 시세 이상탐지 후속(범위 밖).
4. SEC-004 교환 멱등: `/exchanges`에 `Idempotency-Key` 헤더 필수 + 캐시 차감 조건부 원자 갱신.
5. SEC-006 토큰 전략: §2에 refresh 서버 저장(해시)·회전·재사용 탐지·logout 무효화 필수 명문화(무상태 access + 서버 저장 refresh).
6. SEC-007 열거 완화: signup 실패 사유 최소화 + 게이트웨이 rate limit(D-068). nickname 중복은 표시용이라 유지.
7. SEC-009 시간 검증: 경매 등록 서버 검증(endAt>now, startAt≤endAt, maxEndAt≥endAt, window/extend 양수·상한) + AUCTION_008.
+ 035 관찰: item_template 외부 식별자를 `typeCode`로 통일(계약 §4.1·market-prices, erd type_code UK). public_id 미부여로 계약·erd 일치.

무영향·이월 확인
- SEC-005(인증 rate limit): D-068(SCG 엣지 게이트웨이) rate limit 담당으로 해소 — 계약 §2 비고에 명시, 앱 레벨 off 유지. 계약 문안 변경 없음.
- SEC-008(잔액 TOCTOU)·SEC-011(/admin 인가): 구현 게이트 2 이월. 계약 변경 없음(원자 갱신·인가는 구현 규약).
- SEC-010(ULID 시각 노출): 정보성, 현 단계 수용.

미확정(추적표): 캐시↔게임머니 교환 비율, 플랫폼 수수료 정책 — ON-HOLD.

다음 단계 제안: 보안 델타 재확인(Critical 부재 확인) → 사용자 승인 → G3 통과 → 백/프론트/QA/보안 동시 기동 + 프론트 저장소 계약 복사본(D-007·D-030). v1 확정 표기는 승인 후.

회신: 필요 — 보안 델타 재확인 + G3 판정
신규 발번 ID: 없음

---
커밋 메시지 블록 (D-061 — git 실행은 사용자, `git add docs/design/ docs/api-contract.md docs/erd.md`)
```
docs(기획): 보안 게이트 1 findings 계약 반영 (SEC 7건 + 식별자 정정)

목적
- 보안 게이트 1 findings를 계약·erd에 반영, 보안 델타 재확인 대기.
변경
- api-contract.md: SEC-001·002·003·004·006·007·009 반영, item_template typeCode 통일, 에러코드 4종 추가, v0.2
- erd.md: charge.pg_tx_id UK(멱등 앵커), item_template.type_code 외부 식별자 UK, v0.3
- design/outbox/018: 보안 반영 완료 보고 / design/outbox/017: ANSWERED→035
- design/inbox-log.md: 035·037 수신 처리
관련: SEC-001~009, D-013, D-051~053, D-065, D-068, G3
```
