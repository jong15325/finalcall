import { itemArt } from '@/features/item/lib/itemArt'
import { toElementKey } from '@/features/item/lib/element'
import { kindLabelOf, subGroupLabelOf } from '@/features/item/lib/itemCode'
import { resolveFrameType } from './frame'
import { resolveSkillSlots, skillLabelOf } from './skillSlots'
import type { ItemCardViewModel, ItemSkillView } from './ItemCardView'

export interface ItemCardSource {
    subGroup: number
    kind: number
    element: number
    level: number
    skill1: number | null
    skill2: number | null
    skill1Name?: string | null
    skill2Name?: string | null
    skillPercent?: number | null
    goldforceExpireAt?: string | null
    nameSnapshot: string
    specSnapshot?: string
}

export function toItemCardViewModel(
    item: ItemCardSource,
    now: number,
    options: {
        price?: { amount: number | null; label?: string }
        seller?: string
    } = {},
): ItemCardViewModel {
    const art = itemArt(
        {
            subGroup: item.subGroup,
            kind: item.kind,
            element: item.element,
            level: item.level,
        },
        'l',
        1,
    )
    const frameLabel =
        resolveFrameType({ goldforceExpireAt: item.goldforceExpireAt }, now) ===
        'GOLDFORCE'
            ? '골드'
            : '블랙'
    const skills: ItemSkillView[] = resolveSkillSlots(
        item.skill1,
        item.skill2,
        {
            skill1Name: item.skill1Name,
            skill2Name: item.skill2Name,
        },
    ).map((skill) => ({
        slot: skill.slot,
        label: skillLabelOf(skill),
        percent:
            skill.slot === 2 && (item.skillPercent ?? 0) > 0
                ? item.skillPercent
                : undefined,
    }))

    return {
        name: item.nameSnapshot,
        description: item.specSnapshot,
        typeLabel: `${frameLabel} - ${subGroupLabelOf(item.subGroup)}`,
        kindLabel: kindLabelOf(item.subGroup, item.kind),
        level: item.level,
        element: toElementKey(item.element),
        artUrl: art?.src ?? null,
        skills,
        price: options.price,
        seller: options.seller,
        goldforceExpireAt: item.goldforceExpireAt,
        referenceNow: now,
    }
}
