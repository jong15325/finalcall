# FinalCall 위협 모델 (STRIDE-lite)

방식: 전면 STRIDE 워크숍 대신 자금 흐름 중심 도메인별 표 1개(security-guide 3절).
STRIDE = Spoofing(위장)/Tampering(변조)/Repudiation(부인)/Information disclosure(정보노출)/
Denial of service(서비스거부)/Elevation of privilege(권한상승).
대상: api-contract v0.1. 잔여 리스크는 findings.md(SEC-NNN) 연계.

자금 흐름 지도: 외부결제(토스) → 캐시 충전 → 캐시↔게임머니 교환 → 입찰 홀드/구매 →
낙찰·구매 정산(sale_order) → 소유 이전. 공격 표면은 온램프(충전·교환)와 성립(입찰·구매·정산).

---

## auth (인증)

| 위협(STRIDE) | 시나리오 | 기존 통제 | 잔여 리스크 → 조치 |
|---|---|---|---|
| Spoofing | 헤더 위조로 타 사용자 위장 | 서버 JWT 검증·SecurityContext, X-User-Id 미신뢰(D-065) | 낮음(양호) |
| Elevation | 탈취 토큰으로 계정 탈취 후 자금 인출 | HS256·access 30m | 회전·무효화 미확정 → SEC-006 |
| Info disclosure | loginId 존재 열거 | login 단일 코드(AUTH_003) | signup 중복 구분 노출 → SEC-007 |
| DoS | login/refresh 무차별·스터핑 | (게이트웨이 제거로) 없음 | rate limit 공백 → SEC-005 |

## charge (캐시 충전 — 외부 온램프)

| 위협(STRIDE) | 시나리오 | 기존 통제 | 잔여 리스크 → 조치 |
|---|---|---|---|
| Tampering | confirm에 임의 amount 주입해 무상환 캐시 발행 | "토스 승인 검증"·CHARGE_002 | 서버-투-서버 검증·인증 바인딩 미명시 → SEC-002 |
| Replay | 성공 paymentKey 재전송으로 이중 크레딧 | idempotency_key UK | 멱등 앵커가 클라 값 → SEC-001 |
| Spoofing | 타인 charge건 confirm 가로채기 | (인증 주체 바인딩 미명시) | charge 소유자 검증 필요 → SEC-002 |
| 격리 | 외부 연동 장애가 거래 오염 | 충전·거래 TX 분리(D-051·D-053) | 낮음(양호) |

## exchange (캐시↔게임머니 교환)

| 위협(STRIDE) | 시나리오 | 기존 통제 | 잔여 리스크 → 조치 |
|---|---|---|---|
| Tampering/Replay | 이중 제출·재시도로 교환 2회 처리 | (없음) | 멱등성 부재 → SEC-004 |
| Tampering | 역방향 환전 우회로 현금화 | EXC_002 역방향 미지원, 범위 절단(spec §12) | 낮음(양호) |

## bid (입찰·홀드)

| 위협(STRIDE) | 시나리오 | 기존 통제 | 잔여 리스크 → 조치 |
|---|---|---|---|
| Tampering | 가용 초과 홀드(음수 잔액) 동시 요청 | 경매 단위 직렬화·DB 정합(D-008) | 잔액 원자성 문구 부재 → SEC-008(게이트2) |
| 부정입찰 | shill·자기 가격 인상 | BID_003 자기입찰·BID_004 연속입찰 금지 | 다계정 공모는 계약 밖(이상탐지 후속) |
| Tampering | buyNow 상한 우회 입찰 | BID_002(buyNowPrice 이상 422) | 낮음(양호) |
| DoS | 마감 직전 입찰 폭주 | 직렬화·소프트클로즈 상한(maxEndAt) | 낮음(설계 반영) |

## purchase/settlement (즉시구매·고정가·정산)

| 위협(STRIDE) | 시나리오 | 기존 통제 | 잔여 리스크 → 조치 |
|---|---|---|---|
| Tampering | 판매자 자기구매로 wash trade·시세 조작 | 입찰만 BID_003, 구매는 미차단 | 자기구매 미차단 → SEC-003 |
| Tampering | 중복 구매·이중 낙찰 | 종료성 CAS 단일 승자(D-008) | 낮음(양호) |
| Repudiation | 성립 후 정산 분쟁 | sale_order 단일 TX·이력(D-053) | 낮음(양호) |

## item/inventory (IDOR·소유)

| 위협(STRIDE) | 시나리오 | 기존 통제 | 잔여 리스크 → 조치 |
|---|---|---|---|
| Elevation(IDOR) | 타인 리소스 식별자 열거·접근 | public_id ULID·소유자/당사자 검증(ITEM_002·ORDER_002) | 문서상 규정, 구현 표본 → 게이트2 |
| Info disclosure | 식별자로 생성 시각·순서 노출 | (ULID 특성) | 정보성 → SEC-010 |
| Tampering | 임시보관→슬롯 이동 소유 우회 | relocate 소유자 검증(ITEM_002) | 구현 표본 → 게이트2 |

## admin (관리자)

| 위협(STRIDE) | 시나리오 | 기존 통제 | 잔여 리스크 → 조치 |
|---|---|---|---|
| Elevation | 비관리자가 force-cancel 등 호출 | 인증 필요(관리자)·AUTH_005 | /admin/** 일괄 인가 규정·표본 → SEC-011(게이트2) |

---

## 시크릿·설정(횡단, CLAUDE.md 4절)

- JWT 시크릿·토스 시크릿 키는 환경변수 fail-fast(운영 기본값 없음). 게이트 2에서
  하드코딩 grep. 계약 대상 아님, 위협 모델 상기용.
