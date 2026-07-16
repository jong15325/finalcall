/**
 * 계약 [5] 에러코드 표 + [1.6] 게이트웨이 엣지 코드.
 * 백엔드 도메인 ErrorCode enum과 1:1 (GATEWAY_*는 엣지 발생 — 1:1 규칙 예외, [5] 주석).
 * 에러 분기는 이 상수로 한다(try-catch 산발 금지 — 프론트 CLAUDE.md [5]).
 */
export const ERROR_CODES = {
  // 공통
  COMMON_004: 'COMMON_004', // 분산락 획득 실패 (409)

  // 인증·회원
  AUTH_001: 'AUTH_001', // 중복 loginId (409)
  AUTH_002: 'AUTH_002', // 중복 nickname (409)
  AUTH_003: 'AUTH_003', // 로그인 자격 불일치 (401)
  AUTH_004: 'AUTH_004', // refresh 만료·무효·재사용 (401)
  AUTH_005: 'AUTH_005', // 권한 없음(관리자 등) (403)
  MEMBER_001: 'MEMBER_001', // 닉네임 중복(프로필 수정, [2.5]) (409)
  MEMBER_002: 'MEMBER_002', // 진행 중 거래 보유로 탈퇴 불가([2.5]) (409)

  // 경매
  AUCTION_001: 'AUCTION_001', // 아이템 미소유·미보유 (403/409)
  AUCTION_002: 'AUCTION_002', // 이미 출품중 (409)
  AUCTION_003: 'AUCTION_003', // buyNowPrice <= startPrice (422)
  AUCTION_004: 'AUCTION_004', // 경매 없음 (404)
  AUCTION_005: 'AUCTION_005', // 즉시구매 미설정 (422)
  AUCTION_006: 'AUCTION_006', // 이미 종료 (409)
  AUCTION_007: 'AUCTION_007', // 입찰 존재로 취소 불가 (409)
  AUCTION_008: 'AUCTION_008', // 경매 시간 파라미터 위반 (422)
  AUCTION_009: 'AUCTION_009', // 판매자 자기구매 (403)

  // 입찰
  BID_001: 'BID_001', // 최소 증분 미달 (422)
  BID_002: 'BID_002', // buyNowPrice 이상 (422)
  BID_003: 'BID_003', // 자기 경매 입찰 (403)
  BID_004: 'BID_004', // 연속(최고가 보유자) 입찰 (409)
  BID_005: 'BID_005', // 게임머니 잔액 부족 (422)
  BID_006: 'BID_006', // 마감/종료됨 (409)

  // 고정가
  SHOP_001: 'SHOP_001', // 아이템 미소유·미보유 (403/409)
  SHOP_002: 'SHOP_002', // 이미 출품중 (409)
  SHOP_003: 'SHOP_003', // 고정가 없음 (404)
  SHOP_004: 'SHOP_004', // 이미 판매/종료 (409)
  SHOP_005: 'SHOP_005', // 게임머니 잔액 부족 (422)
  SHOP_006: 'SHOP_006', // 판매자 자기구매 (403)

  // 아이템·인벤토리
  ITEM_001: 'ITEM_001', // 아이템 없음 (404)
  ITEM_002: 'ITEM_002', // 소유자 아님 (403)
  INV_001: 'INV_001', // 인벤토리 만실 (409)
  INV_002: 'INV_002', // 슬롯 점유 (409)

  // 주문
  ORDER_001: 'ORDER_001', // 주문 없음 (404)
  ORDER_002: 'ORDER_002', // 당사자 아님 (403)

  // 화폐
  CHARGE_001: 'CHARGE_001', // 승인 검증 실패 (422)
  CHARGE_002: 'CHARGE_002', // 금액 불일치 (422)
  CHARGE_003: 'CHARGE_003', // 충전 소유자 불일치 (403)
  EXC_001: 'EXC_001', // 캐시 잔액 부족 (422)
  EXC_002: 'EXC_002', // 역방향 교환 미지원 (422)

  // 게이트웨이 엣지 ([1.6] — 도메인 enum 미등재)
  GATEWAY_429: 'GATEWAY_429', // rate limit 초과 (429)
  GATEWAY_403: 'GATEWAY_403', // 게이트웨이 미경유 직접접근 차단 (403)
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
