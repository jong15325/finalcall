import { itemArt } from '@/features/item/lib/itemArt'
import { toElementKey } from '@/features/item/lib/element'
import type { CardInfoResponse } from '@/lib/api/cardInfo'
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
    cardInfo: CardInfoResponse
}

export function toItemCardViewModel(
    item: ItemCardSource,
    now: number,
    options: { price?: { amount: number | null; label?: string }; seller?: string } = {},
): ItemCardViewModel {
    const art = itemArt(item, 'l', 1)
    const cardInfo = item.cardInfo
    const skills: ItemSkillView[] = cardInfo.skills
        .filter((skill) => skill.code !== null)
        .map((skill) => ({ slot: skill.slot, label: skill.name ?? '-', percent: skill.percent }))

    return {
        name: cardInfo.shortName,
        description: item.specSnapshot,
        typeLabel: `${cardInfo.frame.label} - ${cardInfo.category.label}`,
        kindLabel: cardInfo.kind.label,
        level: cardInfo.level,
        element: toElementKey(cardInfo.element.code),
        artUrl: art?.src ?? null,
        skills,
        price: options.price,
        seller: options.seller,
        goldforceExpireAt: item.goldforceExpireAt,
        referenceNow: now,
        cardInfo,
    }
}
