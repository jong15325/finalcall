import { describe, expect, it } from 'vitest'
import { elementOptions, kindOptions, subGroupOptions } from './filterOptions'
import type { ItemTemplate } from '@/lib/api/itemTemplates'

/**
 * 필터 선택지 구성 (FC-071 — 계약 §4.1 카탈로그 + §3.3.1 사전).
 *
 * 고정하는 것:
 *  1. **카탈로그 없으면 사전 전체(폴백)** — 백엔드 부재가 필터 마비가 되면 안 된다.
 *  2. **카탈로그 있으면 존재하는 코드만** — 헛클릭(성립 불가 조합) 감축.
 *  3. **`kind` 는 `subGroup` 종속** — 미선택이면 빈 배열(UI 비활성 신호).
 */

const template = (
    subGroup: number,
    element: number,
    kind: number,
): ItemTemplate => ({
    typeCode: 1000 + subGroup * 100 + element * 10 + kind,
    mainCategory: 1,
    subGroup,
    element,
    kind,
    displayName: `t-${subGroup}-${element}-${kind}`,
})

describe('subGroupOptions', () => {
    it('카탈로그가 비면 사전 전체를 낸다(폴백)', () => {
        expect(subGroupOptions([]).map((option) => option.code)).toEqual([
            1, 2, 3,
        ])
    })

    it('카탈로그에 존재하는 대분류만 남긴다', () => {
        const templates = [template(1, 1, 1), template(1, 2, 3)]
        expect(subGroupOptions(templates).map((option) => option.code)).toEqual(
            [1],
        )
    })
})

describe('elementOptions', () => {
    it('카탈로그가 비면 4속성 전부(폴백)', () => {
        expect(elementOptions([]).map((option) => option.code)).toEqual([
            1, 2, 3, 4,
        ])
    })

    it('카탈로그에 존재하는 속성만 남긴다', () => {
        const templates = [template(1, 1, 1), template(2, 2, 1)]
        expect(elementOptions(templates).map((option) => option.code)).toEqual([
            1, 2,
        ])
    })
})

describe('kindOptions — subGroup 종속', () => {
    it('subGroup 이 null 이면 빈 배열(비활성 신호)', () => {
        expect(kindOptions(null, [])).toEqual([])
    })

    it('카탈로그가 비면 대분류 사전 전체(무기 4종)', () => {
        expect(kindOptions(1, []).map((option) => option.label)).toEqual([
            '도끼',
            '완드',
            '검',
            '활',
        ])
    })

    it('마법(3)은 사전상 2종뿐 — 성립 불가 kind 는 애초에 없다', () => {
        expect(kindOptions(3, []).map((option) => option.code)).toEqual([1, 2])
    })

    it('카탈로그에 존재하는 종류만 남긴다', () => {
        const templates = [template(1, 1, 1), template(1, 2, 1)] // 도끼만
        expect(kindOptions(1, templates).map((option) => option.label)).toEqual(
            ['도끼'],
        )
    })
})
