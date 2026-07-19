import { useState } from 'react';
import { ItemArtLightbox } from '@/features/item/components/ItemArtLightbox';
import { ItemArtSlot } from '@/features/item/components/ItemArtSlot';
import { goldforceStateOf } from '@/features/item/lib/goldforce';
import { elementLabelOf } from '@/features/item/lib/element';
import { itemTypeLabel } from '@/features/item/lib/itemCode';
import type { ItemBlock } from '@/types/schema';
import { toItemBlock } from '../lib/itemSummary';
import type { InventoryItem } from '../types';

/**
 * 인벤토리 격자 (FC-054) — 계약 §4.2 `items[]`.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **데스크톱은 격자, 모바일은 행이다. 열을 줄인 게 아니라 구조가 다르다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 이 두 구조를 가르는 것은 폭이 아니라 **아트가 정보를 담느냐**다.
 *   · 데스크톱은 `l` 아트(2배 100×186)를 쓴다. 이 원본에는 **레벨이 그림에 구워져 있고** 속성·종류가
 *     한눈에 갈린다 — 즉 격자 그 자체가 읽히므로 격자가 성립한다.
 *   · 모바일에서 같은 아트를 2열로 늘어놓으면 한 화면에 4개가 들어가고 이름은 두 줄로 잘린다.
 *     우리 아이템은 **이름·레벨·스킬로 갈리는 물건**이라(속성·종류만으로는 같은 그림이 여럿) 그림만
 *     빽빽한 화면은 "내 도끼 중 스킬 붙은 것"을 찾지 못한다. 그래서 모바일은 **행 목록**이다 —
 *     썸네일(`s` 아트) + 이름 전체 + 메타 한 줄로 한 화면에 8~9개가 들어가고 전부 읽힌다.
 *   행 언어는 홈(`ClosingRow`·`ShopRow`)과 같다 — 화면마다 다른 목록 언어를 만들지 않는다.
 *
 * ★ 아트 노드가 둘인 이유: 두 구조가 **서로 다른 아트 원본**(`l` vs `s`)을 쓰는데, 원본 전환은 CSS로
 *   되지 않는다(경로가 다르다). `matchMedia`로 분기하면 렌더가 뷰포트에 종속돼 테스트·초기 렌더가
 *   흔들리므로, 두 노드를 두고 CSS로 하나만 보인다. 둘 다 `aria-hidden`이다 —
 *   **캡션이 이름·속성·종류·레벨을 전부 문장으로 적으므로** 접근성 트리에서 아트는 장식이고,
 *   그대로 두면 같은 정보가 세 번 읽힌다(썸네일 alt + 카드 alt + 캡션).
 *
 * ★ Game-Color Containment([1.2]): element 색은 `ItemArtSlot` 안(글로우·배지)에만 있다.
 *   캡션·테두리·배경은 전부 무채색 크롬이고, 속성은 **텍스트("불 속성")로** 적는다.
 */
export function InventoryGrid({ items }: { items: InventoryItem[] }) {
  /**
   * 라이트박스는 격자에 하나만 둔다(셀마다 상태를 두면 96개 상태가 생긴다).
   * 열 때 그 셀의 `ItemBlock`을 통째로 담는다 — id로 다시 찾지 않는다.
   */
  const [zoomed, setZoomed] = useState<ItemBlock | null>(null);

  return (
    <>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((entry) => (
          <li key={entry.itemInstancePublicId}>
            <InventoryCell entry={entry} onZoom={setZoomed} />
          </li>
        ))}
      </ul>

      {zoomed ? <ItemArtLightbox item={zoomed} open onClose={() => setZoomed(null)} /> : null}
    </>
  );
}

function InventoryCell({
  entry,
  onZoom,
}: {
  entry: InventoryItem;
  onZoom: (item: ItemBlock) => void;
}) {
  const item = toItemBlock(entry.summary);
  const goldforce = goldforceStateOf(item.goldforceExpireAt);
  const hasSkill = item.skill1 != null || item.skill2 != null;

  return (
    <button
      type="button"
      onClick={() => onZoom(item)}
      className="flex w-full items-center gap-3 overflow-hidden rounded-lg border border-border bg-surface p-3 text-left transition duration-fast hover:border-border-strong hover:shadow-md md:flex-col md:items-stretch md:gap-0 md:p-0"
    >
      <span aria-hidden="true" className="md:hidden">
        <ItemArtSlot item={item} variant="thumb" />
      </span>
      <span aria-hidden="true" className="hidden md:block">
        <ItemArtSlot item={item} variant="card" />
      </span>

      <span className="min-w-0 flex-1 md:p-3">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-body font-bold text-text md:line-clamp-2 md:whitespace-normal">
            {item.nameSnapshot}
          </span>
          {/*
           * 슬롯 번호 — 원게임 격자의 좌표 개념을 숫자로만 남긴다. 정규 내 이동 API가 없어
           * 조작 대상은 아니지만, 게임 클라이언트와 대조할 때 쓰이는 실제 식별 정보다.
           */}
          <span className="flex-none font-num text-micro text-text-subtle">#{entry.slotNo}</span>
        </span>

        <span className="mt-1 block truncate text-micro text-text-muted md:whitespace-normal">
          {elementLabelOf(item.element)} 속성 · {itemTypeLabel(item.subGroup, item.kind)} ·{' '}
          <span className="font-num">Lv.{item.level}</span>
        </span>

        {hasSkill || goldforce.active ? (
          <span className="mt-1 block truncate text-micro text-text-subtle">
            {hasSkill ? (
              <span className="font-num">
                스킬 {[item.skill1, item.skill2].filter((code) => code != null).join('·')}{' '}
                {item.skillPercent}%
              </span>
            ) : null}
            {hasSkill && goldforce.active ? ' · ' : null}
            {goldforce.active ? `골드포스 ${goldforce.remainingLabel} 남음` : null}
          </span>
        ) : null}

        {/* 버튼의 동작을 이름에 싣는다 — 캡션만으로는 "누르면 무엇이 일어나는지"가 없다. */}
        <span className="sr-only">카드 아트 크게 보기</span>
      </span>
    </button>
  );
}
