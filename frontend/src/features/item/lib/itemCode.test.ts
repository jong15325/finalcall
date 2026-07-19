import { describe, expect, it } from 'vitest'
import { elementBadgeLabelOf, elementLabelOf, toElementKey } from './element'
import {
    decodeTypeCode,
    itemTypeLabel,
    kindLabelOf,
    kindsOf,
    subGroupLabelOf,
} from './itemCode'

/**
 * 코드 사전 테스트 (FC-058) — 계약 v1.10 §3.3.1.
 *
 * ★ 고정하는 것은 **"코드가 무엇을 가리키는가"(정확성)** 이지 표시 문구의 취향이 아니다.
 *   특히 `kind` 의 `subGroup` 종속과 **미등록 코드 폴백**은 계약이 클라이언트에 지운 의무다.
 */

describe('decodeTypeCode — 자리값 분해', () => {
    /** 계약 §3.3.1 원저자 열거(물 속성 발췌) + 실측 예. */
    it.each([
        [1113, { mainCategory: 1, subGroup: 1, element: 1, kind: 3 }], // 물 검
        [1111, { mainCategory: 1, subGroup: 1, element: 1, kind: 1 }], // 물 도끼
        [1224, { mainCategory: 1, subGroup: 2, element: 2, kind: 4 }], // 불 신발
        [1312, { mainCategory: 1, subGroup: 3, element: 1, kind: 2 }], // 물 ss필
        [1244, { mainCategory: 1, subGroup: 2, element: 4, kind: 4 }], // 바람 신발
    ])('%i 를 4축으로 나눈다', (typeCode, axes) => {
        expect(decodeTypeCode(typeCode)).toEqual(axes)
    })

    it('분해 결과를 다시 합치면 원래 코드다', () => {
        for (const typeCode of [1111, 1234, 1342, 1214]) {
            const { mainCategory, subGroup, element, kind } =
                decodeTypeCode(typeCode)
            expect(
                mainCategory * 1000 + subGroup * 100 + element * 10 + kind,
            ).toBe(typeCode)
        }
    })

    it('비정상 입력에도 예외를 던지지 않는다 (화면을 막지 않는다)', () => {
        expect(() => decodeTypeCode(Number.NaN)).not.toThrow()
        expect(decodeTypeCode(Number.NaN).subGroup).toBe(0)
    })
})

describe('kind 는 subGroup 종속 — 단독 해석 금지', () => {
    it('같은 kind=1 이 대분류마다 다른 이름이다', () => {
        expect(kindLabelOf(1, 1)).toBe('도끼')
        expect(kindLabelOf(2, 1)).toBe('방패')
        expect(kindLabelOf(3, 1)).toBe('일반')
    })

    it('마법은 종류가 2개뿐이다 (kind 3·4 성립 불가)', () => {
        expect(kindsOf(3)).toHaveLength(2)
        expect(kindLabelOf(3, 3)).toBe('종류 3')
    })

    it('타입 한 줄은 대분류와 종류를 함께 낸다', () => {
        expect(itemTypeLabel(1, 3)).toBe('무기 · 검')
        expect(itemTypeLabel(2, 3)).toBe('방어구 · 갑옷')
    })
})

describe('미등록 코드 폴백 (계약 §3.3 클라이언트 의무)', () => {
    it('미등록 대분류는 코드를 노출한다 — 무음 실패가 아니다', () => {
        expect(subGroupLabelOf(7)).toBe('대분류 7')
        expect(kindsOf(7)).toEqual([])
    })

    it('미등록 속성은 중립 표기로 흐른다', () => {
        expect(toElementKey(9)).toBeNull()
        expect(elementLabelOf(9)).toBe('속성 9')
        expect(elementBadgeLabelOf(9)).toBe('속성 9')
    })

    it('★ 집합 크기를 하드코딩하지 않는다 — 신규 코드가 먼저 내려와도 던지지 않는다', () => {
        expect(() => kindLabelOf(5, 5)).not.toThrow()
        expect(() => elementLabelOf(99)).not.toThrow()
    })
})

describe('속성 라벨 — 색이 사라진 뒤의 유일한 판별 채널', () => {
    it.each([
        [1, '물'],
        [2, '불'],
        [3, '흙'],
        [4, '바람'],
    ])('element %i → %s', (code, label) => {
        expect(elementLabelOf(code)).toBe(label)
    })

    it('배지 라벨은 축 이름("속성")을 함께 낸다 — 같은 회색 알약끼리 구분되게', () => {
        expect(elementBadgeLabelOf(1)).toBe('물 속성')
        expect(elementBadgeLabelOf(4)).toBe('바람 속성')
    })

    it('★ 배지 라벨이 속성명 단독으로 퇴화하지 않는다 (회귀 가드)', () => {
        // "물"만 적히면 종류 배지("도끼")와 축을 구분할 수 없다 — 색이 없으므로 글자가 전부다.
        for (const code of [1, 2, 3, 4]) {
            expect(elementBadgeLabelOf(code)).not.toBe(elementLabelOf(code))
            expect(elementBadgeLabelOf(code)).toContain('속성')
        }
    })
})
