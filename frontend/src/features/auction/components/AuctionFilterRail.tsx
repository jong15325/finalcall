import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import {
  ELEMENT_CODES,
  ELEMENT_DOT_CLASS,
  ELEMENT_LABEL,
  ELEMENT_TINT_CLASS,
} from '@/features/item/lib/element';
import { SUB_GROUPS, kindsOf, subGroupLabelOf } from '@/features/item/lib/itemCode';
import { AUCTION_STATUS_OPTIONS, applyFilters, isAuctionStatus } from '../types';
import type { AuctionFilters } from '../types';

/**
 * 경매 검색 필터 — design-system [5.4] SearchFilterBar 의 경매 적용 (FC-049 부채 7·8).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 왜 상단 바가 아니라 레일/시트인가
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약 §3 공통 필터가 대분류·종류·속성·레벨·골드포스·가격·상태로 7축이고, 그중 **종류는 대분류
 * 아래 2단으로 들어가야 한다**. 한 줄 바에 접으면 그 종속 관계를 표현할 자리가 없다.
 * 데스크톱은 좌측 레일(sticky), ≤lg 는 접히는 패널이다([5.4] "모바일은 시트/드로어").
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ `kind` 는 `subGroup` 의 **자식**이다 — 나란한 두 축이 아니다
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약 §4.1이 못 박았다: `kind=1`은 무기의 **도끼**·방어구의 **방패**·마법의 **일반**을 모두 반환하고,
 * 서버는 이를 400으로 막지 않는다 — **다의성 해소는 클라이언트 책임**이다.
 * 그래서 이 UI는 **애초에 부모 없이 자식을 고를 수 없게** 만든다:
 *   · 대분류 미선택이면 종류를 **잠그고 잠금 사유를 문장으로 적는다**(사유 없는 비활성 금지, [5.2]).
 *   · 종류를 들여쓰기 + 좌측 연결선으로 **기하학적으로 종속**시킨다. 나란히 두면 "무기 AND 별개의
 *     도끼축"으로 읽힌다.
 *   · 마법을 고르면 선택지가 4개 → 2개로 줄어드는 것이 그대로 보인다(마법에 kind 3·4는 없다).
 *
 * 접근성: 컨트롤은 네이티브 시맨틱(fieldset/legend·button·input·select)만 쓴다. 칩 타깃 h34~44,
 * 선택은 색이 아니라 `aria-pressed` + near-black 채움이 1차 신호다.
 */

const FIELD_CLASS =
  'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-body text-text focus:border-primary';

interface AuctionFilterRailProps {
  filters: AuctionFilters;
  onChange: (next: AuctionFilters) => void;
}

export function AuctionFilterRail({ filters, onChange }: AuctionFilterRailProps) {
  const commit = (next: AuctionFilters): void => onChange(applyFilters(next));

  return (
    <form
      className="overflow-hidden rounded-lg border border-border bg-surface"
      onSubmit={(event) => event.preventDefault()}
      aria-label="경매 검색 필터"
    >
      <CategoryGroup filters={filters} commit={commit} />
      <ElementGroup filters={filters} commit={commit} />
      <LevelGroup filters={filters} commit={commit} />
      <GoldforceGroup filters={filters} commit={commit} />
      <PriceGroup filters={filters} commit={commit} />
      <StatusGroup filters={filters} commit={commit} />

      <div className="border-t border-border bg-surface-band p-4">
        {/*
         * 라벨이 빈 상태의 CTA("필터 초기화")와 겹치지 않게 구분한다 — 같은 이름의 버튼이 한 화면에
         * 둘이면 스크린리더 사용자가 어느 쪽인지 알 수 없다(accessibility [4] 접근가능한 이름).
         */}
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => commit({})}
          className="w-full"
        >
          필터 전체 초기화
        </Button>
      </div>
    </form>
  );
}

type GroupProps = { filters: AuctionFilters; commit: (next: AuctionFilters) => void };

function Group({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-b border-border-muted px-4 pb-5 pt-4 last:border-b-0">
      <legend className="text-label text-text">{legend}</legend>
      {hint ? <span className="mt-1 block text-micro text-text-subtle">{hint}</span> : null}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

/** 필터 칩 — 크롬이라 커머스 뉴트럴이다. 선택은 색이 아니라 near-black 채움([1.2]①). */
function Chip({
  pressed,
  onClick,
  children,
  disabled,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md px-3 text-body font-medium transition-colors duration-fast ${
        pressed
          ? 'border border-ink bg-ink text-primary-fg hover:bg-[#33333a]'
          : 'border border-border-strong bg-surface text-text hover:bg-surface-sunken disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-text-subtle'
      }`}
    >
      {children}
    </button>
  );
}

/** ★ 대분류 + 종속된 종류. 이 컴포넌트가 계약 §4.1의 경고를 UI로 옮긴 본체다. */
function CategoryGroup({ filters, commit }: GroupProps) {
  const kinds = filters.subGroup !== undefined ? kindsOf(filters.subGroup) : [];
  const locked = filters.subGroup === undefined;

  return (
    <Group legend="대분류" hint="1 무기 · 2 방어구 · 3 마법">
      <div className="flex flex-wrap gap-2" role="group" aria-label="대분류">
        <Chip pressed={locked} onClick={() => commit({ ...filters, subGroup: undefined })}>
          전체
        </Chip>
        {SUB_GROUPS.map(({ code, label }) => (
          <Chip
            key={code}
            pressed={filters.subGroup === code}
            onClick={() =>
              commit({
                ...filters,
                subGroup: filters.subGroup === code ? undefined : code,
                // 부모가 바뀌면 자식은 버린다 — 무기의 3(검)이 방어구의 3(갑옷)으로 둔갑하지 않게.
                kind: undefined,
              })
            }
          >
            {label}
          </Chip>
        ))}
      </div>

      {/* 들여쓰기 + 좌측 연결선으로 종속을 기하로 못 박는다 */}
      <div className="mt-4 border-l-2 border-border pl-4">
        <p className="flex flex-wrap items-baseline gap-2">
          <b className="text-label text-text">종류</b>
          <span className="text-micro text-text-muted">
            {locked ? '대분류 선택 필요' : `${subGroupLabelOf(filters.subGroup as number)}의 종류`}
          </span>
        </p>

        {locked ? (
          /* ★ 사유 없는 비활성은 금지다([5.2]) — 왜 잠겼는지를 문장으로 적는다. */
          <p className="mt-2 rounded-md bg-surface-sunken p-3 text-micro leading-relaxed text-text-muted">
            <b className="text-text">대분류를 먼저 고르세요.</b> 종류 코드는 대분류마다 뜻이
            다릅니다 — <span className="font-num">1</span>은 무기에서{' '}
            <b className="text-text">도끼</b>, 방어구에서 <b className="text-text">방패</b>,
            마법에서 <b className="text-text">일반</b>입니다. 대분류 없이 종류만 고르면 세 가지가
            한꺼번에 섞여 나옵니다.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="종류">
              {kinds.map(({ code, label }) => (
                <Chip
                  key={code}
                  pressed={filters.kind === code}
                  onClick={() =>
                    commit({ ...filters, kind: filters.kind === code ? undefined : code })
                  }
                >
                  {label}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-micro leading-relaxed text-text-subtle">
              무기·방어구는 4종, <b className="text-text-muted">마법은 2종</b>입니다.
            </p>
          </>
        )}
      </div>
    </Group>
  );
}

/** 속성 — element 색이 허용된 몇 안 되는 자리다([1.2]③ 아이템 필터 칩). */
function ElementGroup({ filters, commit }: GroupProps) {
  return (
    <Group legend="속성" hint="1 물 · 2 불 · 3 흙 · 4 바람 (정확히 4값)">
      <div className="flex flex-wrap gap-2" role="group" aria-label="속성">
        {ELEMENT_CODES.map(({ code, key }) => {
          const selected = filters.element === code;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => commit({ ...filters, element: selected ? undefined : code })}
              className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-body transition-colors duration-fast ${
                selected
                  ? `border-2 border-ink font-bold text-on-accent-fg ${ELEMENT_TINT_CLASS[key]}`
                  : 'border border-border-strong bg-surface font-medium text-text hover:bg-surface-sunken'
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
      </div>
    </Group>
  );
}

/** 레벨 — 아이템 레벨은 1~9다(아트 축과 동일). 범위 입력은 제출 시점에만 반영한다. */
function LevelGroup({ filters, commit }: GroupProps) {
  const [min, setMin] = useState(filters.minLevel?.toString() ?? '');
  const [max, setMax] = useState(filters.maxLevel?.toString() ?? '');

  useEffect(() => {
    setMin(filters.minLevel?.toString() ?? '');
    setMax(filters.maxLevel?.toString() ?? '');
  }, [filters.minLevel, filters.maxLevel]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    commit({ ...filters, minLevel: toNumber(min), maxLevel: toNumber(max) });
  };

  return (
    <Group legend="레벨">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">최소 레벨</span>
          <input
            type="number"
            min={1}
            max={9}
            inputMode="numeric"
            placeholder="1"
            className={`${FIELD_CLASS} font-num`}
            value={min}
            onChange={(event) => setMin(event.target.value)}
            onBlur={submit}
          />
        </label>
        <span className="pb-2 text-text-subtle" aria-hidden="true">
          –
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">최대 레벨</span>
          <input
            type="number"
            min={1}
            max={9}
            inputMode="numeric"
            placeholder="9"
            className={`${FIELD_CLASS} font-num`}
            value={max}
            onChange={(event) => setMax(event.target.value)}
            onBlur={submit}
          />
        </label>
      </div>
    </Group>
  );
}

function GoldforceGroup({ filters, commit }: GroupProps) {
  return (
    <Group legend="골드포스">
      <label className="flex min-h-11 cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 flex-none accent-[#6E2A9F]"
          checked={filters.goldforceActive === true}
          onChange={(event) =>
            commit({ ...filters, goldforceActive: event.target.checked ? true : undefined })
          }
        />
        <span className="text-body text-text">
          골드포스 적용된 매물만
          <span className="mt-0.5 block text-micro text-text-subtle">
            만료 시각이 남아 있는 아이템입니다.
          </span>
        </span>
      </label>
    </Group>
  );
}

/** 가격 — 타이핑마다 조회하지 않고 제출(blur) 시점에만 반영한다(입력 중 목록이 흔들리지 않게). */
function PriceGroup({ filters, commit }: GroupProps) {
  const [min, setMin] = useState(filters.minPrice?.toString() ?? '');
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? '');

  useEffect(() => {
    setMin(filters.minPrice?.toString() ?? '');
    setMax(filters.maxPrice?.toString() ?? '');
  }, [filters.minPrice, filters.maxPrice]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    commit({ ...filters, minPrice: toNumber(min), maxPrice: toNumber(max) });
  };

  return (
    <Group legend="가격" hint="게임머니 단위">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">최소 가격</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="0"
            className={`${FIELD_CLASS} font-num`}
            value={min}
            onChange={(event) => setMin(event.target.value)}
            onBlur={submit}
          />
        </label>
        <span className="pb-2 text-text-subtle" aria-hidden="true">
          –
        </span>
        <label className="min-w-0 flex-1">
          <span className="sr-only">최대 가격</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="제한 없음"
            className={`${FIELD_CLASS} font-num`}
            value={max}
            onChange={(event) => setMax(event.target.value)}
            onBlur={submit}
          />
        </label>
      </div>
    </Group>
  );
}

function StatusGroup({ filters, commit }: GroupProps) {
  return (
    <Group legend="진행 상태">
      <label>
        <span className="sr-only">진행 상태</span>
        <select
          className={FIELD_CLASS}
          value={filters.status ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            commit({ ...filters, status: isAuctionStatus(value) ? value : undefined });
          }}
        >
          {AUCTION_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </Group>
  );
}

/** 빈 문자열·음수·비수치는 미적용(undefined)으로 정규화한다. */
function toNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
