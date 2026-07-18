/**
 * 계약 [3.3] 목록/상세 응답 스키마 (프론트·QA·디자인 단일 진실).
 * 등급(grade) 없음(D-073). 소유자·최고입찰자는 마스킹.
 * 계약 스키마와 1:1 — 임의 필드 추가·개명 금지.
 *
 * 공백 해소(FC-036): item 블록의 분류 축(typeCode·mainCategory·subGroup·element·kind)은
 * 계약이 타입을 적지 않아 종전 string 으로 뒀으나, erd(item_template.* INT "속성 — 십의 자리")와
 * 서버 구현(AuctionItemView: int)이 **정수 코드**로 확정돼 있다. wire 에 맞춰 number 로 정정한다.
 * 코드↔표시명 매핑은 프론트 소관이다(features/item/lib/element.ts).
 */

/** item 표시 스냅샷 블록 (계약 [3.3] 공통) */
export interface ItemBlock {
  typeCode: number;
  mainCategory: number;
  subGroup: number;
  element: number;
  kind: number;
  level: number;
  skill1?: number; // 스킬 코드(skill_definition.skill_code). 슬롯이 비면 없음
  skill2?: number;
  skillPercent: number;
  goldforceExpireAt?: string;
  nameSnapshot: string;
  specSnapshot: string;
}

/** 경매 상태 (screen-spec [3.2], 계약 [3.1] 상태 전이) */
export type AuctionStatus = 'SCHEDULED' | 'ACTIVE' | 'SOLD' | 'UNSOLD' | 'CANCELLED';

/** 고정가 상태 (screen-spec [3.4], design-system [5.8]) */
export type ShopStatus = 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'CANCELLED';

/** 낙찰 사유 (계약 [3.1] resultType, design-system [5.8]) */
export type ResultType = 'BID' | 'BUYNOW';

/** GET /auctions content 항목 (계약 [3.3]) */
export interface AuctionSummary {
  auctionPublicId: string;
  status: AuctionStatus;
  item: ItemBlock;
  startPrice: number;
  buyNowPrice?: number;
  highestBidAmount?: number;
  bidCount: number;
  startAt?: string;
  endAt: string;
  sellerNickname: string;
}

/** GET /auctions/{id} (계약 [3.3] — AuctionSummary + 추가) */
export interface AuctionDetail extends AuctionSummary {
  resultType?: ResultType;
  highestBidderMasked?: string;
  extensionCount: number;
  maxEndAt: string;
  createdAt: string;
  /**
   * 다음 입찰이 충족해야 할 최소 금액(계약 v1.8 F3 — 서버 파생).
   * 입찰이 없으면 `startPrice`, 있으면 `현재 최고가 + 구간 증분`이다. **종료 상태 경매에서는 null.**
   * 계단식 증분은 서버 설정값이므로 **클라이언트가 구간표를 복제하지 않는다** — 값이 없으면 계산하지 않고 비워 둔다.
   * (EPIC-BID 구현 전에는 서버가 아직 이 필드를 싣지 않아 undefined 로 온다.)
   */
  minNextBidAmount?: number;
}

/** GET /shops content 항목 (계약 [3.3]) */
export interface ShopSummary {
  shopPublicId: string;
  status: ShopStatus;
  item: ItemBlock;
  price: number;
  endAt?: string;
  sellerNickname: string;
}

/** GET /shops/{id} (계약 [3.3] — ShopSummary + 추가) */
export interface ShopDetail extends ShopSummary {
  createdAt: string;
}
