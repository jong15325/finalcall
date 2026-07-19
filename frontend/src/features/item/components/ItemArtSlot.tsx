import {
  ELEMENT_BORDER_CLASS,
  ELEMENT_SLOT_GLOW_CLASS,
  SLOT_GLOW_NEUTRAL,
  elementLabelOf,
  toElementKey,
} from '../lib/element';

/**
 * ItemArtSlot — design-system [5.3] 상단 아트 슬롯.
 *
 * **현재는 플레이스홀더다**(EPIC-FE-AUCTION 디자인 게이트 승인). 게임 아트는 `docs/game_ui` 에 있으나
 * 백엔드 시드의 typeCode 가 빈약해 매핑할 짝이 없다 — [5.3] "자산 부재 시 플레이스홀더" 조항을 쓴다.
 * 실자산 도입 시 이 컴포넌트 내부만 교체된다(screen-spec [3.5-b] P-012 경로 파생:
 * `gold_black/level{level}/{s|l}/{element}/{kind}.png`). 슬롯 비율·크기는 그때도 유지되므로 카드 레이아웃은 흔들리지 않는다.
 *
 * 슬롯 바탕은 **속성별 딥 글로우**다(v0.5 — 종전 `surface-slot` 단일 검정 폐기, [2.1]·[2.7]).
 * 검정을 유지하던 근거("아트가 검정 전제로 그려졌다")가 아트 실측으로 무너졌다 — 아트는 알파 없는
 * 불투명 이미지이고 자체 배경색을 갖는다. element 색은 글로우 위에서도 5.0~9.8:1 로 살아난다.
 * ★ 글로우는 **보조 신호**다 — 속성 판별은 ElementBadge(도트 + 속성명)가 책임진다([1.2]③).
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
  const glow = key ? ELEMENT_SLOT_GLOW_CLASS[key] : SLOT_GLOW_NEUTRAL;

  return (
    <div
      className={`flex aspect-[4/3] w-full items-center justify-center ${glow}`}
      role="img"
      aria-label={`${elementLabelOf(element)} 속성 레벨 ${level} ${name}`}
    >
      <div className="flex flex-col items-center gap-2" aria-hidden="true">
        <span className={`h-9 w-9 rotate-45 rounded-sm border-2 ${outline}`} />
        <span className="font-num text-label text-white">Lv.{level}</span>
      </div>
    </div>
  );
}
