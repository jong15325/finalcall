import type { AuctionStatus, ResultType } from '@/types/schema';
import type { StatusTone } from '@/components/ui/StatusChip';

/**
 * 경매 목록의 정렬·필터 모델(계약 §3 공통 목록 필터 + 정렬 화이트리스트).
 * 화이트리스트 밖 값은 만들지 않는다 — 서버가 폴백하더라도 클라가 먼저 지킨다(B-006).
 */

/** 정렬 옵션. value 는 계약 `sort=<field>,<dir>` 로 그대로 나간다(필드는 화이트리스트 4종 중 3종 사용). */
export const AUCTION_SORTS = [
  { value: 'endAt,asc', label: '마감 임박순' },
  { value: 'highestBidAmount,desc', label: '최고가순' },
  { value: 'createdAt,desc', label: '최신 등록순' },
] as const;

export type AuctionSortValue = (typeof AUCTION_SORTS)[number]['value'];

export const DEFAULT_SORT: AuctionSortValue = 'endAt,asc';

export function isAuctionSort(value: string): value is AuctionSortValue {
  return AUCTION_SORTS.some((sort) => sort.value === value);
}

/** 상태 표시 메타(design-system [5.8] — 의미색 + 상태명 병기, 색 단독 금지). */
export const AUCTION_STATUS_META: Record<AuctionStatus, { label: string; tone: StatusTone }> = {
  SCHEDULED: { label: '예정', tone: 'neutral' },
  ACTIVE: { label: '진행중', tone: 'info' },
  SOLD: { label: '낙찰', tone: 'success' },
  UNSOLD: { label: '유찰', tone: 'danger' },
  CANCELLED: { label: '취소됨', tone: 'danger' },
};

/** 낙찰 사유 라벨(design-system [5.8] — resultType 은 상태 칩이 아니라 **보조 라벨**로 표기). */
export const RESULT_TYPE_LABEL: Record<ResultType, string> = {
  BID: '입찰 낙찰',
  BUYNOW: '즉시구매',
};

/** 상태 필터 선택지. 미지정(전체)은 서버가 SCHEDULED·ACTIVE 만 노출하므로 라벨을 정직하게 적는다. */
export const AUCTION_STATUS_OPTIONS: { value: '' | AuctionStatus; label: string }[] = [
  { value: '', label: '진행·예정' },
  { value: 'ACTIVE', label: '진행중' },
  { value: 'SCHEDULED', label: '예정' },
  { value: 'SOLD', label: '낙찰' },
  { value: 'UNSOLD', label: '유찰' },
  { value: 'CANCELLED', label: '취소됨' },
];

export function isAuctionStatus(value: string): value is AuctionStatus {
  return value in AUCTION_STATUS_META;
}

/**
 * 목록 필터 상태 (계약 §3 공통 목록 필터).
 *
 * FC-049에서 `subGroup`·`kind`·레벨·골드포스를 추가했다(부채 7). 시드(FC-052)가 템플릿 40종으로
 * element×kind 전수를 덮어 이 축들이 더 이상 빈 결과만 내지 않는다.
 *
 * ★ **`kind` 는 독립 축이 아니다.** 계약 §4.1: `kind=1`은 무기의 도끼·방어구의 방패·마법의 일반을
 * **모두** 반환하며 서버는 이를 400으로 막지 않는다 — "다의성 해소는 클라이언트 책임"이다.
 * 그래서 `kind`는 `subGroup`이 있을 때만 유효하며, `applyFilters` 가 그 불변식을 강제한다.
 *
 * 미구현: `mainCategory`(현재 값이 1뿐이라 축이 되지 않는다) · `skill1`/`skill2`(코드→이름 매핑 API가
 * 계약에 없어 선택지를 만들 수 없다). 둘 다 UI를 만들지 않고 자리도 두지 않는다 — 쓸 수 없는 축을
 * 그려 두면 사용자가 누르고 빈 결과를 받는다.
 */
export interface AuctionFilters {
  status?: AuctionStatus;
  minPrice?: number;
  maxPrice?: number;
  /** 속성 코드(정수, features/item/lib/element.ts 매핑). */
  element?: number;
  /** 대분류(1 무기 · 2 방어구 · 3 마법). `kind`의 부모 축이다. */
  subGroup?: number;
  /** 종류. **`subGroup` 없이 단독으로 세우지 않는다**(계약 §4.1 다의성 경고). */
  kind?: number;
  minLevel?: number;
  maxLevel?: number;
  /** 만료 시각이 남아 있는 아이템만. */
  goldforceActive?: boolean;
}

/**
 * 필터 확정 — **`kind` 종속 불변식을 여기 한 곳에서 강제**한다.
 * 대분류가 빠지거나 바뀌면 종류를 함께 떨어뜨린다(부모 없는 자식이 URL·요청에 남지 않게).
 */
export function applyFilters(next: AuctionFilters): AuctionFilters {
  if (next.subGroup === undefined) return { ...next, kind: undefined };
  return next;
}

/** 필터가 하나라도 적용됐는지 — 빈 상태 카피·초기화 CTA 분기용. */
export function hasActiveFilters(filters: AuctionFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}
