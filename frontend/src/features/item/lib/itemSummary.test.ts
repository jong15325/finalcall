import { describe, expect, it } from 'vitest'
import { deriveItemSummaryArt } from './itemSummary'
import type { ItemSummary } from '@/lib/api/inventory'

/**
 * 요약 → 아트 파생 (FC-076). typeCode 분해 + itemArt + hasSkill 을 한 곳에서 낸다.
 */

function summary(overrides: Partial<ItemSummary> = {}): ItemSummary {
    return {
        // 1(카드)·1(무기)·2(불)·3(검) = 1123, level 3 → fire/sword
        typeCode: 1123,
        displayName: '불의 검',
        level: 3,
        skill1Code: 104,
        skill2Code: null,
        skillPercent: 18,
        goldforceExpireAt: null,
        ...overrides,
    }
}

describe('deriveItemSummaryArt', () => {
    it('typeCode 를 4축으로 분해한다(§3.3.1 산식)', () => {
        const { axes } = deriveItemSummaryArt(summary())
        expect(axes).toEqual({
            mainCategory: 1,
            subGroup: 1,
            element: 2,
            kind: 3,
        })
    })

    it('아트 경로를 코드축+레벨로 파생한다(0-based 보정 없음)', () => {
        const { art } = deriveItemSummaryArt(summary())
        expect(art?.src).toBe('/art/items/level3/l/fire/sword.png')
    })

    it('스킬 코드가 하나라도 있으면 hasSkill=true', () => {
        expect(deriveItemSummaryArt(summary()).hasSkill).toBe(true)
        expect(
            deriveItemSummaryArt(summary({ skill1Code: null, skill2Code: 207 }))
                .hasSkill,
        ).toBe(true)
    })

    it('스킬 코드가 모두 null 이면 hasSkill=false', () => {
        expect(
            deriveItemSummaryArt(
                summary({ skill1Code: null, skill2Code: null }),
            ).hasSkill,
        ).toBe(false)
    })

    it('범위 밖 레벨은 art=null(플레이스홀더 폴백)', () => {
        expect(deriveItemSummaryArt(summary({ level: 99 })).art).toBeNull()
    })
})
