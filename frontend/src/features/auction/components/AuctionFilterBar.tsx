import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import {
  ELEMENT_CODES,
  ELEMENT_DOT_CLASS,
  ELEMENT_LABEL,
  ELEMENT_TINT_CLASS,
  elementLabelOf,
} from '@/features/item/lib/element';
import { formatMoney } from '@/lib/format';
import {
  AUCTION_SORTS,
  AUCTION_STATUS_META,
  AUCTION_STATUS_OPTIONS,
  isAuctionStatus,
} from '../types';
import type { AuctionFilters, AuctionSortValue } from '../types';

/**
 * SearchFilterBar — design-system [5.4] 의 경매 적용.
 *
 * **구현 범위 = 정렬 + 핵심 4종**(status · minPrice/maxPrice · element). [5.4] 의 나머지 축
 * (mainCategory·subGroup·kind·level·skill·goldforce)은 시드가 빈약해 빈 결과만 내므로 UI 를 만들지 않는다
 * (EPIC-FE-AUCTION 디자인 게이트 승인). 필터 모델(`AuctionFilters`)에 자리는 이미 있다.
 *
 * 접근성([5.4]·accessibility [3]·[4]):
 * - 컨트롤은 네이티브 시맨틱(select·input·button)만 쓴다 — 커스텀 드롭다운을 만들지 않는다.
 * - **적용된 필터는 제거 가능한 칩**으로 가시화한다(현재 상태 가시화). 칩 타깃은 44px.
 * - 속성 칩은 색 단독으로 선택을 알리지 않는다 — `aria-pressed` + 굵은 경계 + 라벨 텍스트가 1차 신호다.
 *
 * 가격은 타이핑마다 조회하지 않고 **제출 시점에만** 반영한다(입력 중 폴백 조회로 목록이 흔들리지 않게).
 */
const CONTROL_CLASS =
  'h-11 rounded-md border border-border-strong bg-surface px-3 text-value text-text transition-colors duration-fast focus:border-primary';

/** 폼 필드 라벨은 라벨 축이다([3.2]) — Field 컴포넌트의 라벨과 같은 단계를 유지한다. */
const FIELD_LABEL_CLASS = 'text-label text-text';

interface AuctionFilterBarProps {
  filters: AuctionFilters;
  sort: AuctionSortValue;
  onChange: (next: AuctionFilters) => void;
  onSortChange: (next: AuctionSortValue) => void;
}

export function AuctionFilterBar({ filters, sort, onChange, onSortChange }: AuctionFilterBarProps) {
  // 가격은 드래프트(문자열)로 들고 있다가 제출 때 커밋한다. 외부(칩 제거·초기화)에서 바뀌면 동기화한다.
  const [minDraft, setMinDraft] = useState(filters.minPrice?.toString() ?? '');
  const [maxDraft, setMaxDraft] = useState(filters.maxPrice?.toString() ?? '');

  useEffect(() => {
    setMinDraft(filters.minPrice?.toString() ?? '');
    setMaxDraft(filters.maxPrice?.toString() ?? '');
  }, [filters.minPrice, filters.maxPrice]);

  const commitPrice = (event: FormEvent): void => {
    event.preventDefault();
    onChange({ ...filters, minPrice: toPrice(minDraft), maxPrice: toPrice(maxDraft) });
  };

  const toggleElement = (code: number): void => {
    onChange({ ...filters, element: filters.element === code ? undefined : code });
  };

  return (
    <section aria-label="경매 검색 필터" className="flex flex-col gap-4">
      <form onSubmit={commitPrice} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASS}>정렬</span>
          <select
            className={CONTROL_CLASS}
            value={sort}
            onChange={(event) => onSortChange(event.target.value as AuctionSortValue)}
          >
            {AUCTION_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASS}>상태</span>
          <select
            className={CONTROL_CLASS}
            value={filters.status ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ ...filters, status: isAuctionStatus(value) ? value : undefined });
            }}
          >
            {AUCTION_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASS}>최소 시작가</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            className={`${CONTROL_CLASS} font-num w-32`}
            value={minDraft}
            onChange={(event) => setMinDraft(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={FIELD_LABEL_CLASS}>최대 시작가</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="제한 없음"
            className={`${CONTROL_CLASS} font-num w-32`}
            value={maxDraft}
            onChange={(event) => setMaxDraft(event.target.value)}
          />
        </label>

        <Button type="submit" variant="outline">
          가격 적용
        </Button>
      </form>

      {/*
       * 속성 필터 칩 — element 색이 허용된 몇 안 되는 자리다([1.2] Containment).
       * 칩은 **계약이 확정한 코드**(ELEMENT_CODES)로만 만든다 — 미확정 코드로 칩을 노출하면
       * 누를 때마다 빈 목록이 뜨고 근거 없는 분류 체계를 확정된 것처럼 제시하게 된다(계약 v1.9 §3.3).
       */}
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">속성 필터</legend>
        <span className={FIELD_LABEL_CLASS}>속성</span>
        {ELEMENT_CODES.map(({ code, key }) => {
          const selected = filters.element === code;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleElement(code)}
              className={`inline-flex h-11 items-center gap-2 rounded-md px-3 text-body transition-colors duration-fast ${
                selected
                  ? `border-2 border-ink font-semibold text-on-accent-fg ${ELEMENT_TINT_CLASS[key]}`
                  : 'border border-border-strong bg-surface text-text hover:bg-surface-sunken'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${ELEMENT_DOT_CLASS[key]}`}
                aria-hidden="true"
              />
              {ELEMENT_LABEL[key]}
            </button>
          );
        })}
      </fieldset>

      <AppliedFilterChips filters={filters} onChange={onChange} />
    </section>
  );
}

/** 적용된 필터를 제거 가능한 칩으로 가시화한다([5.4] 접근성). 칩 전체가 제거 버튼이라 타깃이 넉넉하다. */
function AppliedFilterChips({
  filters,
  onChange,
}: {
  filters: AuctionFilters;
  onChange: (next: AuctionFilters) => void;
}) {
  const chips: { key: keyof AuctionFilters; label: string }[] = [];
  if (filters.status) {
    chips.push({ key: 'status', label: `상태: ${AUCTION_STATUS_META[filters.status].label}` });
  }
  if (filters.element !== undefined) {
    chips.push({ key: 'element', label: `속성: ${elementLabelOf(filters.element)}` });
  }
  if (filters.minPrice !== undefined) {
    chips.push({ key: 'minPrice', label: `최소 ${formatMoney(filters.minPrice)}` });
  }
  if (filters.maxPrice !== undefined) {
    chips.push({ key: 'maxPrice', label: `최대 ${formatMoney(filters.maxPrice)}` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-label text-text-muted">적용된 필터</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-label={`필터 제거: ${chip.label}`}
          onClick={() => onChange({ ...filters, [chip.key]: undefined })}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface-sunken px-3 text-body text-text transition-colors duration-fast hover:border-border-strong"
        >
          {chip.label}
          <span aria-hidden="true" className="text-text-muted">
            ✕
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({})}
        className="h-11 rounded-md px-3 text-body text-primary underline transition-colors duration-fast hover:bg-primary-soft"
      >
        전체 초기화
      </button>
    </div>
  );
}

/** 빈 문자열·음수·비수치는 미적용(undefined)으로 정규화한다. */
function toPrice(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
