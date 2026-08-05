# FC-191 통합 리뷰 — EPIC-ITEM-DELIVERY

- 리뷰어: reviewer (읽기 전용, 격리 재실행 포함)
- 일자: 2026-08-05
- 판정: **changes-requested**
- 대상: FC-186·187·188·189·190·192 (working tree, 미커밋)

## 요지
프로덕션 코드의 **critical 없음** — 자금 탈취·인증 우회·이중 지급·이중 존재를 여는 결함 미발견. enqueue 원자성(SettlementRecorder MANDATORY 꼬리)·멱등(sale_order_id·item_uuid·public_id UK 3종)·동시성(reconciler/sweeper 조건부 CAS)·커밋 후 알림(AFTER_COMMIT·fallbackExecution false·예외 삼킴)·도메인 인가(/me 스코프·recipient=주체·DELIVERY_001 404 통일·claimToken 미노출) 모두 계약·불변식과 정합. 배송 테스트 격리 실행 GREEN.

## MAJOR-1 (FC-192 · QA 게이트) — 전체 백엔드 suite RED
- `DeliveryQueryApiIntegrationTest`가 전체 suite에서 실패(격리는 GREEN). 이 에픽이 SettlementRecorder에 배송 enqueue를 추가하면서, 정산을 커밋하는 통합 테스트들이 이제 배송 행도 커밋 → 조회 테스트가 `content[0]`(타 테스트 커밋 배송)에 오단언.
- recipient 스코프는 정상(IDOR 아님). 수정: `content[0]` 대신 자기 deliveryPublicId로 단언 or @BeforeEach 커밋분 청소.
- **재작업: FC-192(테스트 격리 하드닝)**.

## MAJOR-2 (FC-188 + spec · phase-2 gated) — 재판매 가드 APPLIED lag 창 미봉
- `INCOMPLETE_STATUSES={PENDING,CLAIMED,DEFERRED}`가 APPLIED 제외. 게임 apply(APPLIED)~웹 reconciler IN_GAME 전이(폴 주기) 사이, item_instance는 INVENTORY/TEMP·배송 APPLIED라 재판매 가드 통과 → 이중 존재 가능(D-F 위반).
- **phase-1(웹 전용·게임 apply 미구현)에서는 도달 불가**(APPLIED 발생원 없음)이나 phase-2 착지 전 봉쇄 필수. spec §5.4↔§6.1 내부 불일치.
- 수정: 가드를 "FAILED 아닌 배송 존재"로 확장(APPLIED 포함, IN_GAME 후엔 location CAS가 차단하므로 무해) + spec §5.4/§6.1 정합화 + lag 창 테스트.
- **재작업: FC-188(가드 확장) + architect(spec 정합)**.

## MINOR (배송 무관 · 기존/환경, 별도 추적 권고)
- `AuctionRegisterConcurrencyIntegrationTest` — V13 seed bid FK + 테스트 자체 bid 미청소(기존 순서 의존성). 배송 회귀 아님(가드 실행 이전 teardown 실패).
- `GatewayAccessIntegrationTest` — actuator health 503(기존/환경).
- 둘 다 clean full-suite green을 막으나 이 에픽과 무관 → 별도 티켓 추적 권고.

## 프론트(FC-190) 회귀
- DeliverySummary/Detail 형상이 FC-192 실출력과 1:1 일치(compact ItemSummary·itemInstancePublicId·appliedAt NON_NULL·claimToken 미노출). 기존 인벤/주문 형상 불변, 회귀 없음. (typecheck 미실행 — 백엔드 집중)

## 재작업 대상
- FC-192 (MAJOR-1): 테스트 격리 하드닝
- FC-188 (MAJOR-2): 재판매 가드 APPLIED 창 봉쇄 + lag 테스트
- architect (MAJOR-2): delivery-domain-spec §5.4/§6.1 정합
- (별도) 환경 minor 2건: 사용자 결정 대기
