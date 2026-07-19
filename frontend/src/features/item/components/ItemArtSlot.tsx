import { goldforceStateOf } from '../lib/goldforce';
import { itemArt } from '../lib/itemArt';
import type { ArtSize } from '../lib/itemArt';
import { itemTypeLabel } from '../lib/itemCode';
import {
  ELEMENT_SLOT_GLOW_CLASS,
  SLOT_GLOW_NEUTRAL,
  elementLabelOf,
  toElementKey,
} from '../lib/element';
import { ElementBadge } from './ElementBadge';
import type { ItemBlock } from '@/types/schema';

/**
 * ItemArtSlot — design-system [5.3] 아트 슬롯. **FC-049에서 실아트로 교체**했다(종전 "Lv.N" 플레이스홀더).
 *
 * 공유 컴포넌트라 홈·목록·상세가 이 파일 하나로 동시에 살아난다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 이 컴포넌트가 지키는 것
 * ══════════════════════════════════════════════════════════════════════════════
 * ① **세로 슬롯**이다. 원본 아트가 l 50×93 · s 26×28 로 **둘 다 세로형**이라, 종전 `aspect-[4/3]`
 *    가로 슬롯에서는 아트가 가운데 뜬 우표가 된다.
 * ② **정수배 확대만** 한다(card 2x · detail 3x · lightbox 4x · thumb 2x). 비정수 확대는 도트를
 *    뭉개고 그게 그대로 "싸구려"로 읽힌다([5.3]).
 * ③ **바탕은 검정이 아니라 속성별 딥 글로우**다([2.7] v0.5). 아트는 알파 없는 불투명 이미지라
 *    검정 전제가 성립하지 않는다. 드러나는 건 아트 좌우의 좁은 띠다.
 *    단 **작은 썸네일(thumb)은 글로우를 쓰지 않는다** — 그 크기에서 그라데이션은 보이지 않는다.
 * ④ **레벨을 `l` 위에 겹쳐 그리지 않는다.** 원본 `l` 하단에 흰 이탤릭 "Level N"이 **구워져 있다**.
 *    반대로 **`s`에는 레벨 표기가 아예 없어** thumb 에서는 웹이 반드시 텍스트로 적는다.
 * ⑤ **골드포스 3경로**([5.12]): 금 아웃라인(보조) + 배지 + `sr-only` 보충. 본문줄은 소비처가 맡는다.
 *    아웃라인을 전부 지워도 정보 손실이 없어야 한다.
 * ⑥ **대체텍스트에 레벨·속성·종류를 싣는다** — 스크린리더는 아트에 구워진 글자를 읽지 못한다.
 * ⑦ 자산이 없는 조합(범위 밖 레벨 등)은 **플레이스홀더로 폴백**한다([5.3] "자산 부재 시 플레이스홀더").
 *    깨진 이미지 아이콘을 내보내지 않는다.
 */

type ArtVariant = 'card' | 'detail' | 'lightbox' | 'thumb';

interface VariantSpec {
  size: ArtSize;
  scale: number;
  /** 슬롯(무대) 클래스. 아트보다 넉넉하되 과하지 않게 — 남는 면이 전부 어두워지면 화면에 구멍이 뚫린다. */
  stage: string;
  frameScale: string;
  glow: boolean;
  badges: boolean;
}

const VARIANTS: Record<ArtVariant, VariantSpec> = {
  card: {
    size: 'l',
    scale: 2,
    stage: 'h-[210px] w-full',
    frameScale: '',
    glow: true,
    badges: true,
  },
  detail: {
    size: 'l',
    scale: 3,
    stage: 'h-[340px] w-full sm:h-[392px]',
    frameScale: 'art-frame-x3',
    glow: true,
    badges: true,
  },
  lightbox: {
    size: 'l',
    scale: 4,
    stage: 'h-[420px] w-full',
    frameScale: 'art-frame-x4',
    glow: true,
    badges: false,
  },
  thumb: {
    size: 's',
    scale: 2,
    stage: 'h-16 w-16 flex-none rounded-sm',
    frameScale: '',
    glow: false,
    badges: false,
  },
};

interface ItemArtSlotProps {
  item: ItemBlock;
  variant?: ArtVariant;
}

export function ItemArtSlot({ item, variant = 'card' }: ItemArtSlotProps) {
  const spec = VARIANTS[variant];
  const art = itemArt(item, spec.size, spec.scale);
  const elementKey = toElementKey(item.element);
  const goldforce = goldforceStateOf(item.goldforceExpireAt);

  // 작은 썸네일은 엣지 단색으로 채운다([2.7]) — 64px에서 방사 그라데이션은 보이지 않는다.
  const background = !spec.glow
    ? 'bg-glow-neutral-edge'
    : elementKey
      ? ELEMENT_SLOT_GLOW_CLASS[elementKey]
      : SLOT_GLOW_NEUTRAL;

  /*
   * 아트가 담는 정보(레벨·속성·종류)를 문장으로 옮긴다. 아트에 구워진 "Level N"은 이미지라
   * 스크린리더가 읽지 못하므로, 여기서 빠지면 시각 사용자만 아는 정보가 된다.
   */
  const description = `${elementLabelOf(item.element)} 속성 ${itemTypeLabel(item.subGroup, item.kind)} 레벨 ${item.level} ${item.nameSnapshot}`;

  return (
    <div className={`relative grid place-items-center overflow-hidden ${spec.stage} ${background}`}>
      {art ? (
        <span className={`art-frame ${spec.frameScale} ${goldforce.active ? 'art-frame-gf' : ''}`}>
          {goldforce.active ? (
            <span className="gf-ring" aria-hidden="true">
              <i />
            </span>
          ) : null}
          <img
            className="art-pixel"
            src={art.src}
            alt={description}
            width={art.width}
            height={art.height}
            loading="lazy"
            decoding="async"
          />
        </span>
      ) : (
        <ArtFallback item={item} description={description} compact={variant === 'thumb'} />
      )}

      {/*
       * ★ `s` 아트에는 레벨이 없다(픽셀 비교로 확인 — 텍스트 영역 자체가 존재하지 않는다).
       * 그래서 thumb 에서만 웹이 레벨을 적는다. `l` 에서는 절대 겹쳐 그리지 않는다(중복).
       */}
      {variant === 'thumb' && art ? (
        <span className="absolute inset-x-0 bottom-0 bg-black/65 text-center font-num text-label text-white">
          {item.level}
        </span>
      ) : null}

      {spec.badges ? (
        <>
          {/* 좌상단 = 골드포스 자리, 우상단 = 속성 자리. 두 배지가 겹치지 않도록 고정한다. */}
          {goldforce.active ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-0.5 text-label text-text">
              <span
                className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-gf-2 to-gf-6"
                aria-hidden="true"
              />
              골드포스
              <span className="sr-only">적용됨, 남은 기간</span>
              <span className="font-num">{goldforce.remainingLabel}</span>
            </span>
          ) : null}
          <span className="absolute right-3 top-3">
            <ElementBadge element={item.element} />
          </span>
        </>
      ) : null}
    </div>
  );
}

/**
 * 자산 부재 폴백([5.3]). 아트가 없는 조합(계약이 상한을 두지 않는 `level` 범위 밖 등)에서 뜬다.
 * 깨진 이미지 대신 **레벨을 텍스트로** 보여 정보가 사라지지 않게 한다.
 */
function ArtFallback({
  item,
  description,
  compact,
}: {
  item: ItemBlock;
  description: string;
  compact: boolean;
}) {
  return (
    <div className="grid place-items-center" role="img" aria-label={description}>
      <span
        className={`font-num text-white ${compact ? 'text-label' : 'text-value'}`}
        aria-hidden="true"
      >
        Lv.{item.level}
      </span>
    </div>
  );
}
