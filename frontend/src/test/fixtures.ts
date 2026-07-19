import type { InventoryItem, ItemSummary, TempStorageItem } from '@/features/inventory/types';
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
    /*
     * ★ 아트 자산이 존재하는 레벨(1~9)을 기본값으로 둔다(FC-049). 종전 기본값 10은 계약상 유효하지만
     * 아트가 없어 **모든 테스트가 플레이스홀더 분기만 태웠다** — 실아트 경로가 한 번도 검증되지 않는다.
     * 범위 밖 레벨은 그 자체를 검증하는 테스트가 명시적으로 override 한다.
     */
    level: 7,
    skill1: null,
    skill2: null,
    skillPercent: 0,
    goldforceExpireAt: null,
    nameSnapshot: '시험용 아이템',
    specSnapshot: 'Lv.7 / skill1=-/skill2=- / 0% / GF=-',
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

/* ══════════════════════════════════════════════════════════════════════════════
   인벤토리·임시보관(계약 §4.2) — FC-054
   ★ 이 스키마는 위의 `ItemBlock` 과 **다른 물건이다.** 4개 코드 축을 개별 필드로 주지 않고
     `typeCode` 하나로 접어 보낸다. 기본값 1127 = 상품군1·무기(1)·물(2)·활(4)... 이 아니라
     자리값대로 mainCategory 1 · subGroup 1 · element 2 · kind 7 이 되므로, 실제로 아트가 존재하는
     조합을 쓰려면 산식(§3.3.1)대로 조립해야 한다 — 그래서 헬퍼가 축을 받아 `typeCode` 를 굽는다.
   ══════════════════════════════════════════════════════════════════════════════ */

/** §3.3.1 산식으로 `typeCode` 조립. 픽스처가 자리값을 손으로 계산하다 틀리는 것을 막는다. */
export function aTypeCode(subGroup: number, element: number, kind: number): number {
  return 1000 + subGroup * 100 + element * 10 + kind;
}

export function anItemSummary(overrides: Partial<ItemSummary> = {}): ItemSummary {
  return {
    // 무기 · 불 · 검 → /art/items/level7/{l|s}/fire/sword.png (아트가 실재하는 조합)
    typeCode: aTypeCode(1, 2, 3),
    displayName: '시험용 아이템',
    level: 7,
    skill1Code: null,
    skill2Code: null,
    skillPercent: 0,
    goldforceExpireAt: null,
    ...overrides,
  };
}

export function anInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    itemInstancePublicId: 'item-0001',
    slotNo: 1,
    summary: anItemSummary(),
    ...overrides,
  };
}

export function aTempStorageItem(overrides: Partial<TempStorageItem> = {}): TempStorageItem {
  return {
    itemInstancePublicId: 'temp-0001',
    storedAt: '2026-07-18T00:00:00Z',
    expireAt: null,
    summary: anItemSummary(),
    ...overrides,
  };
}
