import { toElementKey } from './element'
import { kindArtSlugOf } from './itemCode'

/**
 * 게임 카드 아트 경로 파생 (FC-049 → FC-058 이식).
 *
 * ```
 * /art/items/level{level}/{l|s}/{water|fire|earth|wind}/{axe|…|magic}.png
 * ```
 * 원본 정본은 `docs/game_ui/item_info/card_image/gold_black/**` 이고,
 * `scripts/sync-game-art.mjs` 가 `public/art/items` 로 복사한다(dev·build 의 pre 스크립트).
 * 복사본은 `.gitignore` 대상이라 바이너리가 레포에 이중 등재되지 않는다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **레벨 축 — 이 파일에서 가장 틀리기 쉬운 지점이다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 원게임 `itm_level` 은 **0-based**(0 = 실제 1레벨)이지만, **우리 `item_instance.level` 은
 * 표시 레벨(1~9)을 저장**하고 **아트 디렉터리도 표시 레벨**이다(`level1` = 1레벨 아트).
 * → **우리 데이터에 보정을 넣지 않는다.** `level{level}` 을 그대로 쓴다.
 * 보정이 필요한 건 원게임 데이터를 이식할 때뿐이며 이 코드의 책임이 아니다.
 * 근거: `docs/spec/references/game-item-skill-format.md §2`.
 *
 * **틀려도 눈에 거의 안 보인다** — 전 아이템이 한 단계씩 어긋난 그림으로 나가는데 화면상으로는
 * 그럴듯하다. 그래서 이 모듈의 **단위 테스트가 유일한 방어선**이다(`itemArt.test.ts` 가
 * 레벨 1~9 전수를 고정한다).
 *
 * 그 밖의 규칙:
 * - **레벨 범위는 1~9뿐이다.** 아트가 그만큼만 존재한다. 계약은 `level` 에 상한을 두지 않으므로
 *   범위 밖 값이 올 수 있고, 그때는 **null 을 반환해 플레이스홀더로 폴백**한다(404 이미지 금지).
 * - **마법(subGroup 3)의 kind 1·2 는 `magic.png` 한 장을 공유한다**(2:1).
 * - 미등록 element·kind 조합도 null 이다(계약 §3.3 폴백 의무 — 코드 집합 확장을 가정하지 않는다).
 */

/** 복사 대상 base. `scripts/sync-game-art.mjs` 의 TARGET 과 짝을 맞춘다. */
const ART_BASE = '/art/items'

/** 아트가 존재하는 레벨 구간(원본 디렉터리 `level1`~`level9`). */
export const ART_LEVEL_MIN = 1
export const ART_LEVEL_MAX = 9

/**
 * 원본 픽셀 크기(24bpp 실측).
 * **둘 다 세로형**이다 — 슬롯을 가로 비율(`aspect-[4/3]`)로 잡으면 아트가 가운데 뜬 우표가 된다.
 */
export const ART_BASE_SIZE = {
    l: { width: 50, height: 93 },
    s: { width: 26, height: 28 },
} as const

export type ArtSize = keyof typeof ART_BASE_SIZE

export interface ItemArt {
    src: string
    /** 표시 크기(정수배). 비정수 확대는 픽셀아트를 뭉갠다 — 확대는 정수배만이다. */
    width: number
    height: number
}

/** 아트 파생에 필요한 최소 입력. item 블록 전체를 요구하지 않아 테스트가 가볍다. */
export interface ItemArtInput {
    subGroup: number
    kind: number
    element: number
    level: number
}

/**
 * 아트 URL. 자산이 없는 조합(범위 밖 레벨 · 미등록 element/kind)은 **null**이다.
 * ★ 레벨은 그대로 쓴다(위 ★★ — 0-based 보정 금지).
 */
export function itemArtSrc(input: ItemArtInput, size: ArtSize): string | null {
    const { subGroup, kind, element, level } = input

    if (
        !Number.isInteger(level) ||
        level < ART_LEVEL_MIN ||
        level > ART_LEVEL_MAX
    ) {
        return null
    }

    const elementKey = toElementKey(element)
    if (!elementKey) return null

    const kindSlug = kindArtSlugOf(subGroup, kind)
    if (!kindSlug) return null

    return `${ART_BASE}/level${level}/${size}/${elementKey}/${kindSlug}.png`
}

/**
 * URL + 표시 크기를 함께 낸다. `scale` 은 **정수배만** 받는다(1·2·3·4).
 * 소비처가 `width`/`height` 를 속성으로 실어야 이미지 도착 전에도 슬롯이 흔들리지 않는다(CLS).
 */
export function itemArt(
    input: ItemArtInput,
    size: ArtSize,
    scale: number,
): ItemArt | null {
    const src = itemArtSrc(input, size)
    if (!src) return null

    const base = ART_BASE_SIZE[size]
    const factor = Math.max(1, Math.trunc(scale))
    return {
        src,
        width: base.width * factor,
        height: base.height * factor,
    }
}
