import { ELEMENT_BORDER_CLASS, elementLabelOf, toElementKey } from '../lib/element';

/**
 * ItemArtSlot — design-system [5.3] 상단 검정 아트 슬롯.
 *
 * **현재는 플레이스홀더다**(EPIC-FE-AUCTION 디자인 게이트 승인). 게임 아트는 `docs/game_ui` 에 있으나
 * 백엔드 시드의 typeCode 가 빈약해 매핑할 짝이 없다 — [5.3] "자산 부재 시 플레이스홀더" 조항을 쓴다.
 * 실자산 도입 시 이 컴포넌트 내부만 교체된다(screen-spec [3.5-b] P-012 경로 파생:
 * `gold_black/level{level}/{s|l}/{element}/{kind}.png`). 슬롯 비율·크기는 그때도 유지되므로 카드 레이아웃은 흔들리지 않는다.
 *
 * 슬롯은 `surface-slot`(#000) 고정이다 — element 색은 검정 위에서 6.5~11:1 로 살아난다([2.7]).
 * 대체텍스트에 **레벨을 반드시 포함**한다(아트의 구운 배지는 스크린리더가 읽지 못한다, screen-spec [3.5-b]).
 */
interface ItemArtSlotProps {
  name: string;
  element: number;
  level: number;
}

export function ItemArtSlot({ name, element, level }: ItemArtSlotProps) {
  const key = toElementKey(element);
  const outline = key ? ELEMENT_BORDER_CLASS[key] : 'border-white/40';

  return (
    <div
      className="flex aspect-[4/3] w-full items-center justify-center bg-surface-slot"
      role="img"
      aria-label={`${elementLabelOf(element)} 속성 레벨 ${level} ${name}`}
    >
      <div className="flex flex-col items-center gap-2" aria-hidden="true">
        <span className={`h-9 w-9 rotate-45 rounded-sm border-2 ${outline}`} />
        <span className="font-num text-sm font-semibold text-white">Lv.{level}</span>
      </div>
    </div>
  );
}
