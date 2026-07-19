import { elementLabelOf } from '@/features/item/lib/element';
import { kindLabelOf, subGroupLabelOf } from '@/features/item/lib/itemCode';
import { formatMoney } from '@/lib/format';
import { AUCTION_STATUS_META, applyFilters } from '../types';
import type { AuctionFilters } from '../types';

/**
 * 적용된 필터 칩 — design-system [5.4] "적용된 필터는 제거 가능한 칩으로 표시(현재 상태 가시화)".
 *
 * 레일이 접혀 있는 폭에서는 **이 줄이 현재 조건을 아는 유일한 수단**이다. 칩 전체가 제거 버튼이라
 * 타깃이 넉넉하고, `aria-label` 에 무엇을 지우는지 적어 스크린리더에서도 동작이 모호하지 않다.
 *
 * ★ 대분류를 지우면 종류도 함께 지워진다 — `applyFilters` 가 종속 불변식을 강제하므로 여기서
 * 따로 분기하지 않는다(계약 §4.1 다의성 방지가 한 곳에만 산다).
 */
export function AuctionAppliedFilters({
  filters,
  onChange,
}: {
  filters: AuctionFilters;
  onChange: (next: AuctionFilters) => void;
}) {
  const chips: { key: keyof AuctionFilters; label: string }[] = [];

  if (filters.subGroup !== undefined) {
    chips.push({ key: 'subGroup', label: `대분류 · ${subGroupLabelOf(filters.subGroup)}` });
  }
  if (filters.kind !== undefined && filters.subGroup !== undefined) {
    chips.push({ key: 'kind', label: `종류 · ${kindLabelOf(filters.subGroup, filters.kind)}` });
  }
  if (filters.element !== undefined) {
    chips.push({ key: 'element', label: `속성 · ${elementLabelOf(filters.element)}` });
  }
  if (filters.minLevel !== undefined) {
    chips.push({ key: 'minLevel', label: `레벨 ${filters.minLevel} 이상` });
  }
  if (filters.maxLevel !== undefined) {
    chips.push({ key: 'maxLevel', label: `레벨 ${filters.maxLevel} 이하` });
  }
  if (filters.goldforceActive) {
    chips.push({ key: 'goldforceActive', label: '골드포스 적용' });
  }
  if (filters.minPrice !== undefined) {
    chips.push({ key: 'minPrice', label: `최소 ${formatMoney(filters.minPrice)}G` });
  }
  if (filters.maxPrice !== undefined) {
    chips.push({ key: 'maxPrice', label: `최대 ${formatMoney(filters.maxPrice)}G` });
  }
  if (filters.status) {
    chips.push({ key: 'status', label: AUCTION_STATUS_META[filters.status].label });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="text-label text-text-subtle">적용된 필터</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-label={`필터 제거: ${chip.label}`}
          onClick={() => onChange(applyFilters({ ...filters, [chip.key]: undefined }))}
          className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface pl-3 pr-2 text-micro font-medium text-text transition-colors duration-fast hover:border-border-strong"
        >
          {chip.label}
          <span aria-hidden="true" className="text-text-subtle">
            ✕
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({})}
        className="h-8 rounded-md px-2 text-micro text-primary underline underline-offset-4 transition-colors duration-fast hover:bg-primary-soft"
      >
        전체 초기화
      </button>
    </div>
  );
}
