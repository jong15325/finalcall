import { describe, expect, it } from 'vitest'
import {
    ART_BASE_SIZE,
    ART_LEVEL_MAX,
    ART_LEVEL_MIN,
    itemArt,
    itemArtSrc,
} from './itemArt'

/**
 * 아트 경로 생성 테스트 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **이 파일이 레벨 축의 유일한 방어선이다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 원게임 `itm_level` 은 0-based 지만 우리 `level` 과 아트 디렉터리는 **둘 다 표시 레벨**이다.
 * 보정(`level - 1` / `level + 1`)을 넣으면 **전 아이템이 한 단계씩 어긋난 그림**으로 나가는데
 * 아트가 레벨마다 비슷해서 **브라우저로 봐도 거의 안 보인다.**
 * → 그래서 레벨 1~9 **전수를 문자열로 고정**한다. 눈이 못 잡는 것을 테스트가 잡는다.
 * 근거: `docs/spec/references/game-item-skill-format.md §2`.
 */

const SWORD_WATER = { subGroup: 1, kind: 3, element: 1 }

describe('itemArtSrc — 레벨 축(보정 금지)', () => {
    /**
     * ★ 전수 고정. 표를 루프로 만들지 않고 **레벨과 경로를 나란히 적는다** —
     *   기대값을 `level${level}` 로 계산하면 구현과 같은 실수를 그대로 복제해 통과해버린다.
     */
    it.each([
        [1, '/art/items/level1/l/water/sword.png'],
        [2, '/art/items/level2/l/water/sword.png'],
        [3, '/art/items/level3/l/water/sword.png'],
        [4, '/art/items/level4/l/water/sword.png'],
        [5, '/art/items/level5/l/water/sword.png'],
        [6, '/art/items/level6/l/water/sword.png'],
        [7, '/art/items/level7/l/water/sword.png'],
        [8, '/art/items/level8/l/water/sword.png'],
        [9, '/art/items/level9/l/water/sword.png'],
    ])('level %i → %s (±1 보정 없음)', (level, expected) => {
        expect(itemArtSrc({ ...SWORD_WATER, level }, 'l')).toBe(expected)
    })

    it('1레벨이 level0 이 아니다 (0-based 보정을 넣었을 때 나오는 값)', () => {
        expect(itemArtSrc({ ...SWORD_WATER, level: 1 }, 'l')).not.toContain(
            '/level0/',
        )
    })

    it('9레벨이 level10 이 아니다 (반대 방향 보정)', () => {
        expect(itemArtSrc({ ...SWORD_WATER, level: 9 }, 'l')).not.toContain(
            '/level10/',
        )
    })

    it.each([0, -1, 10, 25])('아트 없는 레벨 %i 는 null', (level) => {
        expect(itemArtSrc({ ...SWORD_WATER, level }, 'l')).toBeNull()
    })

    it('정수가 아닌 레벨은 null (경로에 소수점이 새지 않는다)', () => {
        expect(itemArtSrc({ ...SWORD_WATER, level: 3.5 }, 'l')).toBeNull()
        expect(
            itemArtSrc({ ...SWORD_WATER, level: Number.NaN }, 'l'),
        ).toBeNull()
    })

    it('경계 상수가 아트 디렉터리(level1~level9)와 맞는다', () => {
        expect([ART_LEVEL_MIN, ART_LEVEL_MAX]).toEqual([1, 9])
    })
})

describe('itemArtSrc — 속성 축', () => {
    it.each([
        [1, 'water'],
        [2, 'fire'],
        [3, 'earth'],
        [4, 'wind'],
    ])('element %i → %s 디렉터리', (element, dir) => {
        expect(
            itemArtSrc({ subGroup: 1, kind: 3, element, level: 5 }, 'l'),
        ).toBe(`/art/items/level5/l/${dir}/sword.png`)
    })

    it.each([0, 5, 9])('미등록 element %i 는 null (중립 폴백)', (element) => {
        expect(
            itemArtSrc({ subGroup: 1, kind: 3, element, level: 5 }, 'l'),
        ).toBeNull()
    })
})

describe('itemArtSrc — kind 는 subGroup 종속', () => {
    /** ★ 같은 `kind=1` 이 무기에선 도끼, 방어구에선 방패, 마법에선 일반이다(계약 §3.3.1). */
    it.each([
        [1, 1, 'axe'],
        [1, 2, 'wand'],
        [1, 3, 'sword'],
        [1, 4, 'bow'],
        [2, 1, 'shield'],
        [2, 2, 'pendant'],
        [2, 3, 'armor'],
        [2, 4, 'boots'],
    ])('subGroup %i · kind %i → %s.png', (subGroup, kind, slug) => {
        expect(itemArtSrc({ subGroup, kind, element: 2, level: 7 }, 'l')).toBe(
            `/art/items/level7/l/fire/${slug}.png`,
        )
    })

    it('kind=1 이 subGroup 에 따라 다른 파일을 가리킨다 (다의성 해소)', () => {
        const weapon = itemArtSrc(
            { subGroup: 1, kind: 1, element: 1, level: 1 },
            'l',
        )
        const armor = itemArtSrc(
            { subGroup: 2, kind: 1, element: 1, level: 1 },
            'l',
        )
        expect(weapon).toContain('axe.png')
        expect(armor).toContain('shield.png')
        expect(weapon).not.toBe(armor)
    })

    it('마법 kind 1·2 는 magic.png 한 장을 공유한다 (2:1)', () => {
        const nomal = itemArtSrc(
            { subGroup: 3, kind: 1, element: 4, level: 6 },
            'l',
        )
        const special = itemArtSrc(
            { subGroup: 3, kind: 2, element: 4, level: 6 },
            'l',
        )
        expect(nomal).toBe('/art/items/level6/l/wind/magic.png')
        expect(special).toBe(nomal)
    })

    it('마법의 kind 3·4 는 성립 불가 조합 → null', () => {
        expect(
            itemArtSrc({ subGroup: 3, kind: 3, element: 1, level: 1 }, 'l'),
        ).toBeNull()
        expect(
            itemArtSrc({ subGroup: 3, kind: 4, element: 1, level: 1 }, 'l'),
        ).toBeNull()
    })

    it.each([0, 4, 9])('미등록 subGroup %i 는 null', (subGroup) => {
        expect(
            itemArtSrc({ subGroup, kind: 1, element: 1, level: 1 }, 'l'),
        ).toBeNull()
    })
})

describe('itemArtSrc — 크기 디렉터리', () => {
    it('l · s 가 경로 세그먼트로 들어간다', () => {
        const input = { subGroup: 2, kind: 4, element: 3, level: 8 }
        expect(itemArtSrc(input, 'l')).toBe(
            '/art/items/level8/l/earth/boots.png',
        )
        expect(itemArtSrc(input, 's')).toBe(
            '/art/items/level8/s/earth/boots.png',
        )
    })
})

describe('itemArt — 표시 크기', () => {
    it('원본 픽셀 크기는 둘 다 세로형이다 (가로 비율로 잡으면 우표가 된다)', () => {
        expect(ART_BASE_SIZE.l.height).toBeGreaterThan(ART_BASE_SIZE.l.width)
        expect(ART_BASE_SIZE.s.height).toBeGreaterThan(ART_BASE_SIZE.s.width)
    })

    it('정수배로 확대한다', () => {
        const art = itemArt(
            { subGroup: 1, kind: 3, element: 1, level: 5 },
            'l',
            2,
        )
        expect(art).toEqual({
            src: '/art/items/level5/l/water/sword.png',
            width: 100,
            height: 186,
        })
    })

    it('비정수 scale 은 잘라내고, 1 미만은 1로 올린다 (픽셀아트 뭉갬 방지)', () => {
        const input = { subGroup: 1, kind: 3, element: 1, level: 5 }
        expect(itemArt(input, 'l', 2.7)?.width).toBe(100)
        expect(itemArt(input, 'l', 0)?.width).toBe(50)
        expect(itemArt(input, 'l', -3)?.width).toBe(50)
    })

    it('자산 없는 조합은 null — 크기만 내지 않는다 (404 이미지 금지)', () => {
        expect(
            itemArt({ subGroup: 1, kind: 3, element: 1, level: 99 }, 'l', 2),
        ).toBeNull()
    })
})
