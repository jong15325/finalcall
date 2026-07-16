# 보안 발견 티켓 (SEC-NNN)

공격자 관점 발견 누적. 전 역할 열람(`common/rules.md [3]` 문서 체계 · `common/templates.md`).
심각도: Critical(자금 탈취·인증 우회) / Major / Minor. 삭제 금지, 상태 라벨만 갱신.

검토 대상: docs/spec/api-contract.md DRAFT v0.1 (근거 domain-spec v0.3, erd v0.2).
  ※ 경로는 `docs/spec/`으로 이동(`management/outbox/_broadcast/001`). 버전은 게이트 1 검토 시점 기록이라 불변.
게이트: 보안 게이트 1 (D-013), 판정 security/decision-log.md S-001.

요약 표

| ID | 심각도 | 제목 | 상태 | 성격 |
|---|---|---|---|---|
| SEC-001 | Major | 충전 콜백 멱등 앵커가 클라이언트 값 | FIXED(계약 v0.2) | 계약 |
| SEC-002 | Major | 충전 confirm 인증·서버검증 미명시 | FIXED(계약 v0.2) | 계약 |
| SEC-003 | Major | 즉시구매·고정가 자기구매 미차단 | FIXED(계약 v0.2) | 계약 |
| SEC-004 | Major | 교환(exchange) 멱등성 부재 | FIXED(계약 v0.2) | 계약 |
| SEC-005 | Major | 인증 엔드포인트 rate limiting 공백 | FIXED(구현 v-게이트2선행, S-004) | 계약/구현 |
| SEC-006 | Major | 토큰 회전·무효화 전략 미확정 | FIXED(계약 v0.2) | 계약 |
| SEC-007 | Minor | 가입 응답 회원 열거 | FIXED(완화 채택) | 계약 |
| SEC-008 | Minor | 잔액 검증 TOCTOU(원자성 문구 부재) | OPEN(게이트2) | 구현 |
| SEC-009 | Minor | 경매 생성 시간 파라미터 검증 미명시 | FIXED(계약 v0.2) | 계약 |
| SEC-010 | Minor | public_id ULID 시각 성분 노출 | WONTFIX(수용) | 정보 |
| SEC-011 | Minor | /admin/** 인가 일괄 적용 규정 부재 | OPEN(게이트2) | 구현 |
| SEC-012 | Minor | 다계정 공모(collusion) 시세 조작 | WONTFIX(범위 밖 확정) | 정보 |
| SEC-013 | Major | rate limit이 라우트 순서에만 의존 — 회귀 테스트 0 | OPEN | 구현 |
| SEC-014 | Minor | X-Forwarded-For 미신뢰 — LB 뒤 전 클라이언트 단일 버킷 | OPEN(실배포 전) | 구현/운영 |

SEC-005 선행 검증 결과 (게이트 2 분리 착수, 총괄 승인 `management/outbox/_broadcast/003` [4], 2026-07-16)
- **탐색 방법**: 호스트 Glob `**/*.java`·`**/application*.yml` → `gateway/` 모듈 전수 → 호스트 Read
  원문 대조(`application.yml`·`-local`·`-dev`·`-prod` · `RateLimitConfig` · `InternalTokenGlobalFilter` ·
  `GatewayInternalProperties`×2 · `GatewayAccessFilter` · `GatewayApplicationTests`). **bash 마운트 조회 미사용**(D-090).
- **FIXED 근거(긍정·원문 인용)**: rate limit 실재 — `gateway/application.yml:20~33` 라우트
  `auth-rate-limited`(`/api/v1/auth/login,signup,refresh`) + `RequestRateLimiter`
  (Redis 토큰버킷 replenish 5·burst 10·1토큰, `#{@clientIpKeyResolver}`). 직접접근 차단 실재 —
  게이트웨이가 `X-Gateway-Token`을 `.set()`으로 **덮어쓰고**(위조 헤더 선제거), 서비스
  `GatewayAccessFilter`가 JWT 앞 관문에서 403(`GATEWAY_403`), 공통 `enforced: true`.
  시크릿 fail-fast 성립 — dev/prod가 **placeholder를 안 쓰고** relaxed binding + `@NotBlank`
  (placeholder를 쓰면 미해결 리터럴이 `@NotBlank`를 통과해 fail-fast가 무력화되는 함정까지 주석으로 방어).
- **→ SEC-005의 「공백」은 메워졌다**(D-065 롤백 부작용 소멸). 다만 **검증 과정에서 신규 2건**
  (SEC-013·014). **둘은 005의 잔여가 아니라 005 처방 자체의 결함이라 분리 등재한다.**
- 판정: `decision-log.md` **S-004**.

게이트 1 델타 재확인 결과 (api-contract v0.2·erd v0.3 원문 검증, 2026-07-14)
- FIXED(계약 반영·델타 검증): SEC-001(§4.4 pg_tx_id 멱등 + erd charge.pg_tx_id UK),
  SEC-002(§4.4 confirm 인증+charge 소유자 검증+토스 서버-투-서버 재조회, 클라 amount 미수용,
  CHARGE_003), SEC-003(AUCTION_009·SHOP_006 자기구매 금지), SEC-004(§4.4 Idempotency-Key
  헤더+캐시 차감 조건부 원자 갱신), SEC-006(§2 refresh 서버저장·회전·재사용 탐지·logout
  무효화), SEC-007(가입 실패 사유 최소화+게이트웨이 rate limit 완화 채택), SEC-009(§3.1
  시간 서버 검증·AUCTION_008).
- OPEN→게이트2: SEC-005(D-068 SCG 게이트웨이 rate limit·직접접근 차단 구현 검증),
  SEC-008(홀드·차감 원자성 코드 표본), SEC-011(/admin/** 인가 적용 표본).
- WONTFIX(수용): SEC-010(ULID 시각 성분, 정보성).
- ~~잔여 관찰(Minor, 비차단): 신규 에러코드 4종(AUCTION_008·009, SHOP_006, CHARGE_003)이
  엔드포인트엔 있으나 §5 에러코드 표 미등재~~ → **오탐, 철회(2026-07-15, outbox/004)**.
  v0.2 커밋(7d99b5c) 시점에 §5 표 275·276·288·297행에 4종 전부 등재돼 있었다. 당시 bash
  마운트가 stale한 v0.1을 서빙해 부정 결과가 나온 것(D-086·D-043). 기획 누락 아님.
  이 오탐으로 039가 기획에 지시한 "§5 표 보강"은 불요 — 철회 전파 요청(outbox/004).
- 최종 판정: 게이트 1 통과(PASS). 미해결 Critical 없음. 판정 근거 decision-log S-001 갱신.

---

## SEC-001. 충전 콜백 멱등 앵커가 클라이언트 제공 값(idempotencyKey)

심각도: Major · 상태: OPEN · 2026-07-14
관련: api-contract §4.4 POST /charges/confirm, erd charge.idempotency_key UK·pg_tx_id, D-051

공격 시나리오
- confirm 요청 body는 `{ paymentKey, chargePublicId, amount, idempotencyKey }`.
  멱등이 클라이언트가 정한 `idempotencyKey`(erd UK)에만 걸리면, 공격자가 동일한
  성공 `paymentKey`를 매번 새 `idempotencyKey`로 재전송해 캐시를 반복 크레딧한다.
- 하나의 실제 토스 승인(paymentKey)은 한 번만 캐시에 반영돼야 하나, 멱등 단위가
  paymentKey가 아니라 임의 문자열이면 이중 크레딧이 가능하다.

기대 vs 실제
- 기대: "1 토스 승인 = 최대 1 크레딧". 멱등은 PG의 권위 식별자 기준.
- 실제: 멱등 앵커가 클라이언트 통제 값 → 재전송으로 우회.

조치(권고)
- 멱등 앵커를 `pg_tx_id`(=paymentKey)로 이동하거나, `charge.pg_tx_id`에 UK를 추가해
  동일 PG 승인 재반영을 DB 제약으로 차단. idempotencyKey는 요청 재시도 편의 보조로만.
- 계약 §4.4 비고에 "멱등은 paymentKey(pg_tx_id) 기준" 문구 명시.

---

## SEC-002. 충전 confirm의 인증·서버검증 미명시 (client-trust 시 Critical 승격)

심각도: Major · 상태: OPEN · 2026-07-14
관련: api-contract §4.4 POST /charges/confirm, CHARGE_001·002, D-051·D-053

공격 시나리오
- confirm 인증이 "서버 검증(토스 승인 정보)"로만 표기되고 인증 주체(SecurityContext)
  바인딩이 없다. `amount`가 body로 들어온다.
- (a) confirm이 호출자 JWT와 `charge.user_id`를 대조하지 않으면, 타인 충전건을
  가로채거나 조작할 여지가 있다.
- (b) 서버가 클라이언트 `amount`를 신뢰해 캐시를 반영하면(토스 서버-투-서버 승인
  재조회 없이), 결제 없이 임의 금액 크레딧 → 무상환 캐시 발행 = 자금 탈취.

기대 vs 실제
- 기대: confirm은 인증 필수 + `charge.user_id == 호출자`, 금액은 토스 승인 API 응답
  (서버-투-서버, 시크릿 키) 기준으로만 확정. 클라이언트 amount는 대조용일 뿐 근거 아님.
- 실제: 계약이 검증 방식을 "토스 승인 검증"으로만 두어 구현 해석에 열려 있음.

조치(권고)
- 계약 §4.4에 "confirm: 인증 필요 + charge 소유자 검증 + 금액은 토스 서버측 승인
  응답 기준(클라이언트 amount 신뢰 금지)" 명문화.
- 승격 조건: 구현이 클라이언트 amount 신뢰 또는 서버-투-서버 미검증이면 Critical.

---

## SEC-003. 즉시구매·고정가 구매의 판매자 자기구매 미차단

심각도: Major · 상태: OPEN · 2026-07-14
관련: api-contract §3.1 POST .../purchase(buyNow)·§3.2 POST /shops/{id}/purchase,
       BID_003(대칭 부재), market-prices(§4.1), domain-spec §4

공격 시나리오
- 입찰은 BID_003(자기 경매 입찰 403)로 차단되나, buyNow·고정가 구매에는 판매자
  본인 구매 금지가 없다. 판매자가 자기 매물을 자기 계정(또는 공모 계정)으로 구매해
  wash trade를 만들 수 있다.
- sale_order가 시세 집계(market-prices) 소스이므로 자전거래로 시세를 인위 형성·조작
  하고, 향후 수수료 정책 도입 시 정산 왜곡의 발판이 된다.

기대 vs 실제
- 기대: 구매(buyNow·shop)도 입찰과 대칭으로 판매자 본인 구매 금지.
- 실제: 계약에 자기구매 금지 조항·에러코드 없음.

조치(권고)
- buyNow·고정가 구매에 판매자==구매자 차단 규칙과 에러코드 추가(BID_003 대칭).
- 다계정 공모(collusion)까지 계약으로 완전 차단은 불가 — 시세 집계에 이상탐지
  후속 과제로 등재(범위 밖 명시).

---

## SEC-004. 캐시↔게임머니 교환(exchange) 멱등성 부재

심각도: Major · 상태: OPEN · 2026-07-14
관련: api-contract §4.4 POST /exchanges, charge/confirm(멱등 있음) 대비

공격 시나리오
- `/exchanges`는 자금 이동(캐시 차감 + 게임머니 지급)인데 멱등키·재시도 안전장치가
  없다. 네트워크 재시도나 의도적 이중 제출(double-submit)로 동일 교환이 2회 처리되면
  캐시 이중 차감 또는 (경합 시) 게임머니 이중 지급 위험.

기대 vs 실제
- 기대: 자금 이동 POST는 멱등(요청 토큰 또는 서버 조건부 갱신)으로 재시도 안전.
- 실제: 충전 confirm에는 멱등키가 있으나 교환에는 없음(비대칭).

조치(권고)
- `/exchanges`에 멱등키(요청 헤더 또는 body) 도입, 또는 잔액 차감을 원자적 조건부
  갱신으로 처리해 중복 무해화. 계약 §4.4에 재시도 규약 1줄.

---

## SEC-005. 인증 엔드포인트 rate limiting 공백 (D-065 게이트웨이 제거 부작용)

심각도: Major · 상태: OPEN · 2026-07-14
관련: api-contract §2 auth, CLAUDE.md E2(INCLUDE_RATE_LIMITER=false),
       D-065(단일 서비스·게이트웨이 미도입, supersedes D-064)

공격 시나리오
- D-064(게이트웨이 도입)가 D-065로 롤백되며 게이트웨이가 없어졌는데, CLAUDE.md는
  여전히 앱 레벨 rate limiting을 off("게이트웨이 담당")로 둔다. 결과적으로 login·
  signup·refresh에 어떤 계층에서도 요청 제한이 걸리지 않는다.
- 무제한 login → credential stuffing/무차별, 무제한 signup → 회원 열거(SEC-007) 가속.

기대 vs 실제
- 기대: 인증 계열 엔드포인트에 요청 제한(계층 무관 최소 1곳).
- 실제: 게이트웨이 부재 + 앱 off = 제한 부재.

조치(권고)
- 아키텍처 변경(D-065)의 보안 부작용으로 등재. 앱 레벨 rate limit(최소 auth 계열)을
  재검토하도록 총괄에 회부 — CLAUDE.md E2 전제(게이트웨이 담당)가 D-065와 충돌.
  구현 게이트웨이 재도입 대신 앱 필터가 트레이드오프상 저비용.

---

## SEC-006. 토큰 회전·무효화 전략 미확정 (계약이 게이트 1에 위임)

심각도: Major · 상태: OPEN · 2026-07-14
관련: api-contract §2 (/login·/refresh·/logout), D-065, CLAUDE.md F1(HS256, access 30m)

공격 시나리오
- /login이 refreshToken을 발급하나 회전(rotation)·재사용 탐지 규정이 없고, /logout은
  "refreshToken 무효화(서버 보관 시)"로 조건부다. 무상태 설계면 로그아웃이 실제
  무효화를 못 하고, 탈취된 access/refresh는 만료까지 유효.
- refresh 회전·재사용 탐지가 없으면 유출된 refresh 토큰의 반복 재발급을 막지 못함.

기대 vs 실제
- 기대: refresh는 서버 저장(해시)·1회성 회전·재사용 탐지, logout은 필수 무효화.
- 실제: 계약 §2가 전략을 보안 게이트 1로 명시 위임 → 본 게이트에서 결정 필요.

조치(권고)
- 권고 전략: refresh 서버 저장(해시된 값)·회전(재발급 시 이전 토큰 폐기)·재사용
  탐지 시 세션 무효화. logout은 refresh 무효화 필수(무상태 access는 짧은 만료로 완화).
- 트레이드오프: 서버 저장은 상태 부담↑이나 폐기·탈취 대응 가능. 무상태는 단순하나
  탈취·로그아웃 대응 불가 — 자금 시스템에는 서버 저장이 적합.
- 계약 §2 비고를 "서버 저장·회전·재사용 탐지"로 확정.

---

## SEC-007. 가입 응답의 회원 열거(user enumeration)

심각도: Minor · 상태: OPEN · 2026-07-14
관련: api-contract §2 POST /auth/signup, AUTH_001·AUTH_002

공격 시나리오
- signup이 중복 loginId(AUTH_001)와 중복 nickname(AUTH_002)을 구분해 409로 응답 →
  임의 loginId 존재 여부 열거 가능. 유효 loginId 목록은 credential stuffing을 돕는다.
- login이 자격 불일치를 단일 코드(AUTH_003)로 통일한 점은 양호하나, signup이 이를
  상쇄한다.

기대 vs 실제
- 기대: 존재 여부가 무차별로 새지 않게 완화.
- 실제: 중복 사유가 구분 노출.

조치(권고)
- 트레이드오프상 UX(중복 안내)와 충돌하므로, 코드 통합보다 SEC-005 rate limit +
  ~~가입 시도 모니터링~~으로 완화하는 편을 권고. nickname 중복은 표시용이라 열거 가치가
  낮아 유지 가능, loginId 중복 응답만 일반화 검토.

**「가입 시도 모니터링」 항 폐기 — FIXED 유지 (2026-07-16, 총괄 `_broadcast/003` [4] (a) 채택)**
- **완화 채택안의 절반이 어디에도 배정되지 않은 채 FIXED 라벨이 붙어 있었다**(보안 `outbox/REFORM/001` ⓑ-3
  회수). 라벨이 절반만 참이었다.
- **폐기 사유**: rate limit이 열거 **속도**를 죽이면 모니터링은 **통제가 아니라 관측 편의**다.
  Prometheus·Grafana·Loki가 이미 서 있어 필요하면 대시보드 1개다. **Minor 하나에 두 파트를
  움직이는 것은 비례하지 않는다.**
- **완화의 실체는 SEC-005 하나다**: `/api/v1/auth/signup`이 `auth-rate-limited` 라우트에 실재한다
  (호스트 Read, `gateway/application.yml:25`). `RateLimitConfig:15`가 `SEC-007`을 명시적으로 참조한다.
- **단 SEC-014가 이 완화에 걸린다** — LB 뒤에서 버킷이 뭉치면 signup 열거 제한도 같이 무력화된다.
  **SEC-007의 FIXED는 SEC-014 해소를 전제로 한다.**

---

## SEC-008. 잔액 검증 TOCTOU — 원자 갱신 문구 부재

심각도: Minor · 상태: OPEN · 2026-07-14 (구현 게이트 2 표본)
관련: api-contract §3(bid·purchase)·§4.4, erd user_balance, BID_005·SHOP_005, D-008

공격 시나리오
- 잔액/가용(=balance−held) 검사 후 홀드·차감이 원자적이지 않으면, 동시 다중 요청이
  각각 가용 이내로 통과한 뒤 합산이 가용을 초과해 음수 가용/초과 홀드 발생.

기대 vs 실제
- 기대: `UPDATE ... SET held=held+:amt WHERE available>=:amt`류 조건부 원자 갱신
  (D-008 "정합성은 DB").
- 실제: 계약·erd에 잔액 원자성 명시 문구 없음(구현 자율).

조치(권고)
- 계약에는 불요, 위협 모델에 등재하고 게이트 2에서 홀드·차감 원자성 코드 표본 검사.

---

## SEC-009. 경매 생성 시간 파라미터 서버 검증 미명시

심각도: Minor · 상태: OPEN · 2026-07-14
관련: api-contract §3.1 POST /auctions, domain-spec §4 소프트클로즈

공격 시나리오
- 등록 body의 `startAt, endAt, softCloseWindowSec, softCloseExtendSec, maxEndAt`에
  서버 검증 규칙이 계약에 없다. endAt 과거/역전, 음수 초, 비정상 maxEndAt 등 이상
  값으로 마감 자원(지연 인덱스)을 오염시킬 여지.
- buyNowPrice > startPrice(AUCTION_003)는 있으나 시간 제약은 부재.

조치(권고)
- 계약에 서버 검증 규칙 명문화: `endAt > now`, `startAt <= endAt`(있으면),
  `maxEndAt >= endAt`, window/extend는 양수·상한. 위반 시 422.

---

## SEC-010. public_id(ULID) 시각 성분 노출

심각도: Minor(정보) · 상태: OPEN · 2026-07-14
관련: api-contract §1.1, erd public_id ULID

공격 시나리오
- ULID는 앞부분에 생성 시각(ms)을 인코딩하고 사전식 정렬이 가능 → 리소스 생성 시각·
  생성 순서가 식별자만으로 노출된다. 랜덤 성분으로 다음 ID 추측·열거는 어렵다.

기대 vs 실제
- 순번(BIGINT) 미노출은 IDOR 열거를 크게 낮춘 양호한 설계. 시각 노출은 잔여 정보.

조치(권고)
- 대부분 리소스는 수용 가능(생성 시각은 준공개). 민감 리소스(charge 등)에서 생성
  시각·순서 노출이 문제되면 UUIDv4 등 무순서 식별자 사용 여부만 확인. 현 단계 정보성.

**★ WONTFIX의 조건이 미표시였다 — 회수·등재 (2026-07-16, 보안 `outbox/REFORM/001` ⓑ-1)**
- 위 조치의 *"민감 리소스(charge 등)에서 … UUIDv4 등 무순서 식별자 사용 여부만 확인"*은
  **charge 구현 시 재확인 조건**인데 `checklist.md [게이트 2]`에 없었다. **WONTFIX 라벨만 보면
  닫힌 것처럼 보인다** — 조건부 수용이 무조건 수용으로 읽히는 형태다.
- → `checklist.md [게이트 2]`에 등재했다. **재개 트리거 = charge 도메인 착수.**

---

## SEC-011. /admin/** 인가 일괄 적용 규정 부재

심각도: Minor · 상태: OPEN · 2026-07-14 (구현 게이트 2 표본)
관련: api-contract §4.5 force-cancel, AUTH_005, erd user.is_admin

공격 시나리오
- 관리자 API가 현재 force-cancel 1건이나, 관리자 권한은 `is_admin` 플래그 단일이다.
  URL 표기만으로 인가가 보장되지 않으므로 /admin/** 전반에 SecurityContext 기반
  role 필터(@PreAuthorize 등)를 일괄 적용한다는 규정이 필요.

조치(권고)
- 계약에는 "/admin/**는 관리자 인가 필수"로 충분. 게이트 2에서 인가 적용 실태
  (@PreAuthorize, URL 패턴 필터) 표본 검사.

---

## SEC-012. 다계정 공모(collusion) 시세 조작 — 범위 밖 확정

심각도: Minor(정보) · 상태: WONTFIX · 2026-07-16
관련: SEC-003(자기구매 차단 — FIXED), api-contract §4.1 market-prices, threat-model.md:43,
       판정 = 총괄 `management/outbox/_broadcast/003` [4] (a) 채택 (보안 `outbox/REFORM/001` ⓒ-1 추천)

조건
- SEC-003으로 **판매자 본인** 구매는 차단됐다(AUCTION_009·SHOP_006). 그러나 판매자가 **공모 계정**
  으로 자기 매물을 사면 계약·구현 어느 쪽으로도 구분되지 않는다. `sale_order`가 시세 집계
  (market-prices) 소스이므로 자전거래로 시세를 인위 형성할 수 있다.

기대 vs 실제
- 기대: 시세가 실거래를 반영한다.
- 실제: 다계정 공모분이 실거래와 구분되지 않고 섞인다.

왜 WONTFIX인가 (삭제가 아니라 기록 — `[4.17]`)
- **계약으로도 구현으로도 못 막는다.** SEC-003 본문이 이미 그렇게 적었다("완전 차단은 불가").
  탐지는 **거래 데이터가 쌓여야 성립하는데 지금 0건**이다.
- 후속 과제로 등재하면 **착수할 수 없는 항목이 목록에 남아 부담만 는다.** 지금 필요한 것은
  과제가 아니라 **"안 한다는 표시"**다. 이 티켓이 그 표시다.
- **철회 조건**: 실거래 데이터가 쌓이고 시세 왜곡이 실측되면 재개한다. 그때는 이 티켓을
  근거로 이상탐지를 신규 발번한다. **재개 트리거가 데이터이지 일정이 아니다.**

관련 기록
- `findings.md` SEC-003 조치(권고)가 *"후속 과제로 등재"*라고 썼으나 **티켓·인덱스 어디에도
  등재된 적이 없다.** 범위 밖 표시는 `threat-model.md:43` 잔여 리스크 칸에만 있었다
  (호스트 Grep `collusion|공모|이상탐지` on `docs/` → 3곳, 전부 서술문). **이 티켓이 그 공백을 닫는다.**

---

## SEC-013. rate limit이 라우트 순서에만 의존한다 — 회귀 테스트 0

심각도: Major · 상태: OPEN · 2026-07-16 (SEC-005 선행 검증 산출)
관련: gateway `application.yml:20~38`, `GatewayApplicationTests`, SEC-005, D-068, B-027

조건 (공격 시나리오 — 공격자가 아니라 **우리가** 여는 구멍이다)
- `gateway/application.yml`에 라우트가 2개다. `auth-rate-limited`(`Path=/api/v1/auth/login,
  /api/v1/auth/signup,/api/v1/auth/refresh`)가 먼저, `service-proxy`(`Path=/api/v1/**`)가 뒤.
  **후자의 predicate가 전자를 완전히 포함한다.** 지금은 정의 순서 덕에 auth가 먼저 매칭돼
  rate limit이 걸린다.
- **누가 라우트를 위에 하나 추가하거나 `order:` 값을 넣으면 auth 요청이 `service-proxy`로 떨어진다.
  그 순간 rate limit이 사라진다.** 부팅은 성공하고, 컨텍스트는 로드되고, 라우팅도 정상 동작한다.
  → **실패 신호가 0이다.** login이 무제한으로 열린 것을 아무도 모른다.
- 게이트웨이 테스트는 `GatewayApplicationTests.contextLoads()` **1건뿐**이고, 주석이
  *"라우트 정의·RequestRateLimiter·KeyResolver·공유비밀 바인딩이 부팅 시점에 성립하는지 확인"*
  이라 적는다. **"설정이 존재한다"만 검증하고 "429가 실제로 난다"는 검증하지 않는다.**

기대 vs 실제
- 기대: 버스트 초과 시 auth 경로가 429를 낸다. 이 성질이 **테스트로 고정**돼 회귀 시 빌드가 깨진다.
- 실제: 성질이 **YAML 목록의 줄 순서**에만 걸려 있고, 깨져도 아무것도 실패하지 않는다.

조치(권고)
- 게이트웨이에 **행위 테스트 2건**: (1) auth 경로 버스트 초과 → 429 (2) 비auth `/api/v1/**` 경로
  동일 부하 → 429 없음(대조군). Redis는 Testcontainers.
- **SEC-005의 해소가 "설정이 존재한다"에 그치는 것이 이 티켓의 요지다.** 설정은 정확하다
  (원문 대조 완료). 문제는 **그 정확함을 지킬 것이 없다**는 것이다.
- 배정: 백엔드(게이트웨이 소유). **테스트 전략은 QA와 겹치지 않는다** — 보안 통제의 회귀 방지다.

---

## SEC-014. X-Forwarded-For 미신뢰 — LB 뒤에서 전 클라이언트가 단일 버킷

심각도: Minor(현 스켈레톤) → **실배포 시 Major** · 상태: OPEN(실배포 전 확정) · 2026-07-16
관련: `RateLimitConfig:17~19`(자인 주석), B-027 후속(*"X-Forwarded-For 신뢰(열린 질문 3·4)도
       게이트2/실배포 전"*), SEC-005, SEC-007

조건
- `clientIpKeyResolver`가 `exchange.getRequest().getRemoteAddress()` 기준이다. **LB·프록시 뒤에
  배포하면 remoteAddress가 LB IP로 수렴한다.** 그러면 토큰버킷이 출발지별로 갈리지 않고 **전
  클라이언트가 하나의 버킷**을 쓴다.
  - (a) **통제 무력화**: 공격자 1명이 초당 5개 제한을 다른 모두와 나눠 쓴다 = 제한이 안 걸린다
  - (b) **자해 DoS**: 정상 트래픽이 조금만 늘어도 **전체가 429를 맞는다.** 공격자가 의도적으로
    버킷을 비우면 **전 사용자 로그인 차단**이 된다. 이쪽이 (a)보다 나쁘다.
- `remoteAddress`가 null이면 `UNKNOWN_KEY`("unknown") 단일 키로 수렴한다 — 같은 형태의 공유 버킷.
- **코드가 자인한다**(`RateLimitConfig:17~19`): *"★ 운영 주의: 로드밸런서/프록시 뒤에서는
  remoteAddress 가 LB IP 로 수렴할 수 있다. … 이 스켈레톤은 remoteAddress 기준으로 둔다."*

기대 vs 실제
- 기대: 토큰버킷이 **실제 출발지**별로 갈린다.
- 실제: 배포 토폴로지에 따라 갈릴 수도, 전부 뭉칠 수도 있다. **어느 쪽인지 지금 확정 불가.**

조치(권고)
- **지금 고칠 수 없다 — 배포 토폴로지가 미확정이다.** `X-Forwarded-For`를 무조건 신뢰하면
  **클라이언트가 헤더를 위조해 버킷을 무한 분할**할 수 있어 지금보다 나빠진다. 신뢰 프록시 수
  (`trusted hop count`)를 아는 것이 선행이다.
- **실배포 전 조건으로 고정한다**: 배포 토폴로지 확정 → 신뢰 프록시 수 확정 → key resolver 조정
  → SEC-013 테스트로 회귀 고정.
- **이건 백엔드가 이미 열어둔 질문이다**(B-027 후속 *"게이트2/실배포 전"*). **표시가 있었고
  자리도 맞았다** — 이 티켓은 그것을 보안 레인에 받는 것이지 새로 여는 것이 아니다.

---

## 강점(양호 통제 — 균형 기록)

- 서버 단독 신원 결정(D-065): `X-User-Id` 등 헤더 신뢰 없음, SecurityContext 기준.
- 외부 식별자 public_id(ULID)·내부 id(BIGINT) 분리 → 순번 IDOR 열거 차단.
- 최고입찰자·소유자 마스킹(§3.1·§4.1) → 개인정보·상대 식별 최소화.
- 종료성 전이 CAS 단일 승자(D-008) → 중복 판매·이중 낙찰 구조적 차단.
- 충전 멱등키 존재 + 충전·거래 TX 분리(D-051·D-053) → 외부 연동 리스크 격리.
- login 자격 실패 단일 코드(AUTH_003) → 로그인 경로 열거 차단.
