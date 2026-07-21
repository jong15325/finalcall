import { itemArt } from './itemArt'
import type { ArtSize, ItemArt } from './itemArt'
import { decodeTypeCode } from './itemCode'
import type { TypeCodeAxes } from './itemCode'
import type { ItemSummary } from '@/lib/api/inventory'

/**
 * 인벤토리 요약(`ItemSummary`) → 아트 파생 (FC-076).
 *
 * ★ **왜 필요한가** — 인벤토리 요약은 4축을 `typeCode` 하나로 싣는다(계약 §4.2). ItemFrame 은
 *   subGroup/element/kind/level 을 필요로 하므로, 요약을 받는 화면마다 `decodeTypeCode` +
 *   `itemArt` + `hasSkill` 파생을 반복하게 된다. 그 3줄을 한 곳에 모은다(드리프트 방지).
 * ★ 아트가 없는 조합(범위 밖 레벨·미등록 코드)은 `art: null` — ItemFrame 이 플레이스홀더로 폴백한다.
 */

export interface ItemSummaryArt {
    /** typeCode 분해 축(§3.3.1). 타입 라벨·필터에 쓴다. */
    axes: TypeCodeAxes
    /** 파생 아트(URL + 정수배 크기). 자산 없으면 null. */
    art: ItemArt | null
    /** 스킬 보유(코드 존재 파생). 일반 S 마크만 — 특수 SS 는 데이터 없음(§2.2). */
    hasSkill: boolean
}

export function deriveItemSummaryArt(
    summary: ItemSummary,
    size: ArtSize = 'l',
    scale = 1,
): ItemSummaryArt {
    const axes = decodeTypeCode(summary.typeCode)
    const art = itemArt(
        {
            subGroup: axes.subGroup,
            kind: axes.kind,
            element: axes.element,
            level: summary.level,
        },
        size,
        scale,
    )
    const hasSkill = summary.skill1Code !== null || summary.skill2Code !== null

    return { axes, art, hasSkill }
}
