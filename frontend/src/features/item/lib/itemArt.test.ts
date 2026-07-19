import { describe, expect, it } from 'vitest';
import { ART_BASE_SIZE, ART_LEVEL_MAX, ART_LEVEL_MIN, itemArt, itemArtSrc } from './itemArt';
import type { ItemArtInput } from './itemArt';
import { kindsOf } from './itemCode';

/**
 * ★ 아트 경로 파생 테스트 — **눈으로 못 잡는 오류의 유일한 방어선**이다(FC-049).
 *
 * 레벨이 한 단계 어긋나거나 element/kind 가 뒤바뀌어도 화면에는 "그럴듯한 카드 그림"이 그대로 뜬다.
 * 사람은 9레벨 검과 8레벨 검을 나란히 놓고도 구분하지 못한다. 그래서 조합을 코드로 못 박는다.
 */

function input(overrides: Partial<ItemArtInput> = {}): ItemArtInput {
  return { subGroup: 1, kind: 3, element: 2, level: 7, ...overrides };
}

describe('itemArtSrc — 레벨 축', () => {
  /**
   * ★★ 이 테스트가 이 파일의 존재 이유다.
   * 원게임 `itm_level` 은 0-based 지만 **우리 `level` 은 표시 레벨이고 아트 디렉터리도 표시 레벨**이다.
   * `level-1`(0-based 보정)이나 `level+1` 이 들어가면 여기서 죽는다.
   */
  it('level N 은 디렉터리 levelN 으로 그대로 간다(0-based 보정 금지)', () => {
    for (let level = ART_LEVEL_MIN; level <= ART_LEVEL_MAX; level += 1) {
      expect(itemArtSrc(input({ level }), 'l')).toBe(`/art/items/level${level}/l/fire/sword.png`);
    }
  });

  it('경계 레벨 1·9 는 자산이 있다', () => {
    expect(itemArtSrc(input({ level: 1 }), 'l')).toContain('/level1/');
    expect(itemArtSrc(input({ level: 9 }), 'l')).toContain('/level9/');
  });

  it('아트가 없는 레벨(0·10·음수·비정수)은 null 로 폴백한다', () => {
    for (const level of [0, 10, 11, -1, 1.5, Number.NaN]) {
      expect(itemArtSrc(input({ level }), 'l')).toBeNull();
    }
  });
});

describe('itemArtSrc — 속성 축', () => {
  it.each([
    [1, 'water'],
    [2, 'fire'],
    [3, 'earth'],
    [4, 'wind'],
  ])('element %i → %s (계약 v1.10 §3.3.1)', (element, slug) => {
    expect(itemArtSrc(input({ element }), 'l')).toBe(`/art/items/level7/l/${slug}/sword.png`);
  });

  it('미등록 element 는 null(색·경로를 지어내지 않는다)', () => {
    expect(itemArtSrc(input({ element: 5 }), 'l')).toBeNull();
    expect(itemArtSrc(input({ element: 0 }), 'l')).toBeNull();
  });
});

describe('itemArtSrc — 종류 축(kind 는 subGroup 종속)', () => {
  /** ★ 같은 kind 숫자가 대분류마다 다른 그림이다. 이게 어긋나면 도끼 자리에 방패가 뜬다. */
  it.each([
    [1, 1, 'axe'],
    [1, 2, 'wand'],
    [1, 3, 'sword'],
    [1, 4, 'bow'],
    [2, 1, 'shield'],
    [2, 2, 'pendant'],
    [2, 3, 'armor'],
    [2, 4, 'boots'],
  ])('subGroup %i · kind %i → %s', (subGroup, kind, slug) => {
    expect(itemArtSrc(input({ subGroup, kind }), 'l')).toBe(`/art/items/level7/l/fire/${slug}.png`);
  });

  it('마법(subGroup 3)의 kind 1·2 는 magic.png 한 장을 공유한다(2:1)', () => {
    const normal = itemArtSrc(input({ subGroup: 3, kind: 1 }), 'l');
    const special = itemArtSrc(input({ subGroup: 3, kind: 2 }), 'l');
    expect(normal).toBe('/art/items/level7/l/fire/magic.png');
    expect(special).toBe(normal);
  });

  it('성립 불가 조합(마법 kind 3·4)은 null — 없는 자산을 요청하지 않는다', () => {
    expect(itemArtSrc(input({ subGroup: 3, kind: 3 }), 'l')).toBeNull();
    expect(itemArtSrc(input({ subGroup: 3, kind: 4 }), 'l')).toBeNull();
  });

  it('미등록 subGroup·kind 는 null', () => {
    expect(itemArtSrc(input({ subGroup: 4, kind: 1 }), 'l')).toBeNull();
    expect(itemArtSrc(input({ subGroup: 1, kind: 9 }), 'l')).toBeNull();
  });
});

describe('itemArtSrc — 전 조합 전수', () => {
  /**
   * 레벨 9 × 속성 4 × (무기 4 + 방어구 4 + 마법 2) = 360 조합이 전부 경로를 낸다.
   * 시드(FC-052) 템플릿 40종이 element×kind 전수를 덮으므로 이 집합이 곧 실사용 집합이다.
   */
  it('아트가 존재해야 하는 360 조합 전건이 경로를 낸다', () => {
    const paths = new Set<string>();
    for (let level = ART_LEVEL_MIN; level <= ART_LEVEL_MAX; level += 1) {
      for (const element of [1, 2, 3, 4]) {
        for (const subGroup of [1, 2, 3]) {
          for (const { code: kind } of kindsOf(subGroup)) {
            const src = itemArtSrc({ subGroup, kind, element, level }, 'l');
            expect(src).not.toBeNull();
            paths.add(src as string);
          }
        }
      }
    }
    // 마법 2종이 한 장을 공유하므로 고유 파일은 9 × 4 × 9 = 324 장이다.
    expect(paths.size).toBe(324);
  });
});

describe('itemArt — 크기', () => {
  it('l 원본은 50×93 세로형, s 원본은 26×28 세로형이다', () => {
    expect(ART_BASE_SIZE.l).toEqual({ width: 50, height: 93 });
    expect(ART_BASE_SIZE.s).toEqual({ width: 26, height: 28 });
    expect(ART_BASE_SIZE.l.height).toBeGreaterThan(ART_BASE_SIZE.l.width);
    expect(ART_BASE_SIZE.s.height).toBeGreaterThan(ART_BASE_SIZE.s.width);
  });

  it('정수배로만 확대한다(2x 카드 · 3x 상세 · 4x 라이트박스)', () => {
    expect(itemArt(input(), 'l', 2)).toMatchObject({ width: 100, height: 186 });
    expect(itemArt(input(), 'l', 3)).toMatchObject({ width: 150, height: 279 });
    expect(itemArt(input(), 'l', 4)).toMatchObject({ width: 200, height: 372 });
    expect(itemArt(input(), 's', 2)).toMatchObject({ width: 52, height: 56 });
  });

  it('비정수 배율은 내림해 정수배를 지킨다(뭉개짐 방지)', () => {
    expect(itemArt(input(), 'l', 2.7)).toMatchObject({ width: 100, height: 186 });
    expect(itemArt(input(), 'l', 0.5)).toMatchObject({ width: 50, height: 93 });
  });

  it('자산 없는 조합은 크기도 내지 않는다', () => {
    expect(itemArt(input({ level: 12 }), 'l', 2)).toBeNull();
  });
});
