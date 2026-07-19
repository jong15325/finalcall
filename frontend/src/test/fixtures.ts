import type { AuctionDetail, AuctionSummary, ItemBlock } from '@/types/schema';

/**
 * 계약 §3.3 스키마 픽스처(FC-051).
 *
 * 기본값은 **가장 흔한 정상 응답**이다(진행 중 · 입찰 없음 — EPIC-BID 이전의 실제 서버 상태).
 * 각 테스트는 검증하려는 축만 override 로 덮어 차이를 드러낸다.
 */

export function anItem(overrides: Partial<ItemBlock> = {}): ItemBlock {
  return {
    typeCode: 11,
    mainCategory: 1,
    subGroup: 1,
    element: 1,
    kind: 1,
    level: 10,
    skill1: null,
    skill2: null,
    skillPercent: 0,
    goldforceExpireAt: null,
    nameSnapshot: '시험용 아이템',
    specSnapshot: 'Lv.10 / skill1=-/skill2=- / 0% / GF=-',
    ...overrides,
  };
}

export function anAuctionSummary(overrides: Partial<AuctionSummary> = {}): AuctionSummary {
  return {
    auctionPublicId: 'auction-0001',
    status: 'ACTIVE',
    item: anItem(),
    startPrice: 10_000,
    buyNowPrice: null,
    highestBidAmount: null,
    bidCount: 0,
    startAt: null,
    // 마감이 미래여야 종료 오버레이·폴링 정지 분기를 타지 않는다.
    endAt: new Date(Date.now() + 3_600_000).toISOString(),
    sellerNickname: '판매자',
    ...overrides,
  };
}

export function anAuctionDetail(overrides: Partial<AuctionDetail> = {}): AuctionDetail {
  return {
    ...anAuctionSummary(),
    resultType: null,
    highestBidderMasked: null,
    extensionCount: 0,
    maxEndAt: new Date(Date.now() + 7_200_000).toISOString(),
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    minNextBidAmount: null,
    ...overrides,
  };
}
