/**
 * 계약 [3.3] 목록/상세 응답 스키마 (프론트·QA·디자인 단일 진실).
 * 등급(grade) 없음(D-073). 소유자·최고입찰자는 마스킹.
 * 계약 스키마와 1:1 — 임의 필드 추가·개명 금지.
 *
 * 공백 주(완료 보고 기재): 계약 item 블록의 `element` enum 값(대문자 표기 [1.3])이
 * 계약 본문에 열거돼 있지 않다(design-system·erd는 water/fire/earth/wind 4종).
 * 추측(대문자 매핑)을 피해 wire 타입은 string으로 둔다. 확정 시 유니온으로 좁힌다.
 */

/** item 표시 스냅샷 블록 (계약 [3.3] 공통) */
export interface ItemBlock {
  typeCode: string;
  mainCategory: string;
  subGroup: string;
  element: string; // 공백: 계약에 enum 값 미열거 → string 유지
  kind: string;
  level: number;
  skill1?: string;
  skill2?: string;
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
