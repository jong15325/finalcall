# FinalCall 보안 가이던스 (압축 색인)

> **동기화 규율**: 이 파일 = 안정 색인(불변식 한 줄 + 부재 주장). 상세 정본 =
> `docs/security/threat-model-checklist.md`(항목 ID·근거 인용 전문). 어긋나면 **전문(상세)이 정본**.
> 불변식 끝의 `(ID..)`로 전문 항목을 역참조한다.

자금 경매 백엔드. 우선순위 **인가 > 동시성 > 멱등**.
정본: 계약 > erd > domain-spec > decision-log(어긋나면 계약).

**부재 주장 규율(공통)**: "없음"을 근거로 쓸 때 (a) 탐색 1구(도구·경로·패턴) + (b) 도구 병기.
목록 잘림이면 전수 아님. 근거 없는 "없음"은 통과 아님.
**심각도**: Critical(자금 탈취·인증 우회 → 즉시 차단) · Major(정합·인가 → 판정 전 수정) · Minor(정보성 비차단).

---

## 도메인 1. 입찰 동시성 (bid) — (BID-1..7)

**불변식**: 최고가·홀드·연장이 **경매 단위 동일 직렬화 안에서만** 갱신되고, 정확성은 락이 아니라 DB
조건부 UPDATE/CAS가 보증한다.

- `@DistributedLock`은 트랜잭션 경계 **바깥**(커밋 후 해제) (BID-1); self-invocation으로 무력화 없음, 진입점 외부 빈 경유 (BID-2).
- 비정규화 최고가 CAS로 손실 갱신 방지 (BID-3); 이전 최고입찰자 홀드 **즉시** 해제(bid_id UK) (BID-4).
- 소프트클로즈 연장은 입찰 수용과 같은 직렬화 + `max_end_at` 상한(무한 연장=DoS) (BID-5).
- BID_001~006 검증은 락 **안에서** 평가(밖이면 TOCTOU) (BID-6); 잔액 홀드 `WHERE available>=:amt` 원자 (BID-7).

**없어야 할 것**: 커밋 전 락 해제 · 내부 호출 누락 · RMW 최고가/잔액 · 무상한 연장 · 락 밖 검증.

## 도메인 2. 중복구매·wash trade (auction/shop/purchase) — (DUP-1..5)

**불변식**: 종료성 전이(SOLD/CANCELLED)는 `WHERE status='ACTIVE'` **CAS 단일 승자**, 출품은 location CAS로
중복 방지, 성립~정산~소유이전은 단일 TX. 판매자==구매자는 전 구매 경로 차단.

- 종료성 CAS 단일 승자, 영향 행 0이면 409 (DUP-1); 출품 CAS로 이중 리스팅 차단(AUCTION_002·SHOP_002) (DUP-2).
- 자기거래 차단 **대칭**: 입찰(BID_003)+즉시구매(AUCTION_009)+고정가(SHOP_006), 주체=SecurityContext (DUP-3).
- SOLD 확정+sale_order+잔액 증감+소유 이전 단일 TX(외부 충전 미결합) (DUP-4).
- 검증은 서비스·CAS 층 — 직접 호출 우회 없음(게이트웨이 우회 포함) (DUP-5).

**없어야 할 것**: 비CAS 종료 전이 · 이중 출품 · 자기구매 미차단 · 쪼개진 정산 TX · 컨트롤러 전용 검증.

## 도메인 3. /me 인가·IDOR (member/item/order) — (IDOR-1..5)

**불변식**: 주체는 **검증된 토큰의 SecurityContext**에서만 나오고, 모든 `/me`·주문·아이템 접근은 서버가
소유자·당사자를 대조한다. public_id 추측 곤란성은 인가가 아니다.

- 주체=SecurityContext, `X-User-Id` 등 헤더 신원 불신 (IDOR-1); 소유자/당사자 서버 대조(ORDER_002·ITEM_002 403) (IDOR-2).
- public_id(ULID) ≠ 인가, 민감 리소스는 무순서 식별자 재확인(SEC-010) (IDOR-3).
- PATCH /me는 `nickname`만 수용(mass assignment 차단), 응답 loginId·passwordHash 미노출 (IDOR-4).
- is_admin 서버 권위, `/admin/**` role 필터 일괄 인가(비관리자 force-cancel=AUTH_005) (IDOR-5).

**없어야 할 것**: 헤더·body 신원 신뢰 · 소유자 미대조 · public_id를 인가로 오용 · 권위 필드 덮어쓰기 · URL만 믿는 관리자 경로.

## 도메인 4. JWT 세션 폐기 완전성 (auth) — (JWT-1..5)

**불변식**: refresh는 **서버 저장(해시)** + 1회성 회전 + 재사용 탐지 무효화로 폐기 가능하고, logout·탈퇴가
세션을 전폐기하며, 탈퇴/재가입이 잔여 세션·이력을 승계시키지 않는다. access는 짧은 만료 무상태.

- access 무상태 · refresh 서버 해시 저장(평문 아님) (JWT-1); `/refresh` 1회성 회전+재사용 탐지 무효화(AUTH_004) (JWT-2).
- logout(204)·탈퇴 refresh **전폐기**; 탈퇴는 진행 중 거래 시 MEMBER_002(409) 선차단(DUP-1·SET-1) (JWT-3).
- 탈퇴 주체 만료 전 access → 401 `COMMON_005`(미인증·만료와 동일 코드/포맷/타이밍, 열거 방지) (JWT-4).
- 재가입 신규 회원은 과거 세션·잔액·이력 미승계(생성 컬럼 UK + 활성 필터 동반) (JWT-5).

**없어야 할 것**: refresh 평문 저장 · 회전/재사용 탐지 부재 · 폐기 후 잔존 세션 · 탈퇴 여부 코드/타이밍 노출 · UK 미분리 로그인 다건.

## 도메인 5. 정산 정합·멱등 (charge/exchange/settlement/balance) — (SET-1..7)

**불변식**: 자금 확정은 **서버·PG 권위 값**에만 걸고(클라 amount 불신), 멱등 앵커는 **DB UK**(pg_tx_id·복합
idempotency_key), 모든 잔액 증감은 `WHERE available>=:amt` 원자 갱신.

- 정산: 최고입찰 CAPTURED+나머지 RELEASED+sale_order+소유이전, 종료 전이와 단일 직렬화(DUP-4 교차) (SET-1).
- confirm은 토스 서버-투-서버 승인 재조회로 금액 확정(클라 amount 신뢰 금지, 불일치 422 CHARGE_002) (SET-2).
- confirm은 JWT vs charge.user_id 소유자 대조(불일치 403 CHARGE_003) (SET-3).
- 충전 멱등 = `charge.pg_tx_id` UK(중복 200 no-op) (SET-4); 교환 멱등 = 복합 UK, 역방향 422 EXC_002 (SET-5).
- 잔액·홀드 증감 원자 조건부(음수·손실갱신 방지, 부족 422) (SET-6); 시간 전이 서버 클럭·Instant(UTC) 검증(위반 422 AUCTION_008) (SET-7).

**없어야 할 것**: 클라 amount로 캐시 반영 · 멱등 앵커가 클라 값 · 소유자 미대조 confirm · 비원자 잔액 증감 · 클라 시간 신뢰.

**네거티브 스페이스(해당없음)**: 충전은 **pull-confirm**(서버 재조회)이라 PG push **웹훅이 없다** — "웹훅 서명
검증 부재"는 해당없음(신뢰 앵커는 SET-2·SET-4). 웹훅 서명 누락을 결함으로 오탐하지 않는다.

## 공통·횡단. 로깅 위생 (전 도메인) — (LOG-1..3)

**불변식**: 시크릿·인증 원문은 로그·MDC·트레이스·에러 응답 어디에도 남지 않는다(로깅은 관측 편의지 통제 아님).

- 절대 금지(유출 시 고심각도): refresh 원문 · PG 시크릿/키 · 비밀번호 해시 · JWT 원문. 예외 스택·요청 덤프에 토큰 헤더 통째 찍힘 없음 (LOG-1, JWT-1).
- 주의(PII성): 잔액·거래 금액 최소화·마스킹 (LOG-2).
- public_id는 **공개 식별자**(응답에 이미 노출) → 로그 잔존이 시크릿 누출 아님, 상관관계/프라이버시 등급으로 격하(SEC-010) (LOG-3, IDOR-3).

**없어야 할 것**: 토큰/시크릿/해시 로그 · 무마스킹 잔액 로그 · public_id 로그를 시크릿 결함으로 오탐.

## 경계. 레이트리밋 (범위 밖 명시) — (RL-1..4)

**경계 불변식**: rate limit은 **엣지 게이트웨이**(SCG, Redis 토큰버킷) 담당, **앱 레벨 off**가 설계.
앱 서비스에 rate limit이 없는 것은 결함이 아니라 경계다.

- 게이트웨이 소관, 초과 429(GATEWAY_429·Retry-After); 앱 레벨 부재 오탐 없음(SEC-005 FIXED·SEC-013 철회) (RL-1).
- 앱 잔여: 로그인 실패 열거 타이밍(JWT-4·IDOR-3) (RL-2); confirm/교환 멱등이 재시도 폭주 안전망(SET-4·SET-5) (RL-3).
- 앱 잔여: 게이트웨이 키가 IP 기준이라 계정 단위 잠금 정책 유무는 wallet/auth 착수 시 판단(SEC-005 잔여→SEC-014) (RL-4).

**없어야 할 것**: 앱 rate limit 부재 오탐 · 라우트 순서 회귀 오탐 · 멱등 없이 rate limit만으로 이중반영 방지 가정.

---

**신규 도메인 착수 시**: 불변식 한 줄 + 부재 주장을 이 색인에, 전문(`docs/security/threat-model-checklist.md`)에
새 ID 접두 상세 항목 등재. 근거는 계약·erd·findings(SEC-NNN) 실재 대조. 계약과 어긋나면 계약이 정본.
