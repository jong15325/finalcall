import type { AuctionStatus } from '@/types/schema';
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
 * 목록 필터 상태.
 *
 * **구현 범위 = 핵심 4종**(status · minPrice/maxPrice · element) — EPIC-FE-AUCTION 디자인 게이트 승인.
 * 계약 §3 공통 필터의 나머지(`mainCategory`·`subGroup`·`kind`·`minLevel`/`maxLevel`·`skill1`/`skill2`·
 * `goldforceActive`)는 **구조만 남기고 UI 를 만들지 않는다** — 현 시드가 빈약해 대부분 빈 결과를 내기 때문이다.
 * 추가 시 이 타입에 필드를 얹고 `toListQuery` 의 통과 목록에 넣으면 API 층은 무변경이다.
 */
export interface AuctionFilters {
  status?: AuctionStatus;
  minPrice?: number;
  maxPrice?: number;
  /** 속성 코드(정수, features/item/lib/element.ts 매핑). */
  element?: number;
}

/** 필터가 하나라도 적용됐는지 — 빈 상태 카피·초기화 CTA 분기용. */
export function hasActiveFilters(filters: AuctionFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}
