import { describe, expect, it } from 'vitest';
import { itemTypeLabel, kindLabelOf, kindsOf, subGroupLabelOf } from './itemCode';

/**
 * 아이템 코드 사전(계약 v1.10 §3.3.1) 테스트.
 *
 * ★ 핵심은 **`kind` 가 `subGroup` 종속**이라는 사실이 코드로 보장되는지다.
 * 계약 §4.1 이 "다의성 해소는 클라이언트 책임"이라 못 박았으므로, 여기서 무너지면 필터가 거짓말을 한다.
 */
describe('subGroup', () => {
  it.each([
    [1, '무기'],
    [2, '방어구'],
    [3, '마법'],
  ])('%i → %s', (code, label) => {
    expect(subGroupLabelOf(code)).toBe(label);
  });

  it('미등록 코드는 코드를 노출한다(무음 실패 방지)', () => {
    expect(subGroupLabelOf(9)).toBe('대분류 9');
  });
});

describe('kind — subGroup 종속', () => {
  it('★ 같은 kind=1 이 대분류마다 다른 것을 가리킨다', () => {
    expect(kindLabelOf(1, 1)).toBe('도끼');
    expect(kindLabelOf(2, 1)).toBe('방패');
    expect(kindLabelOf(3, 1)).toBe('일반');
  });

  it('무기·방어구는 4종, 마법은 2종뿐이다', () => {
    expect(kindsOf(1)).toHaveLength(4);
    expect(kindsOf(2)).toHaveLength(4);
    expect(kindsOf(3)).toHaveLength(2);
  });

  it('마법에는 kind 3·4 가 존재하지 않는다(성립 불가 조합)', () => {
    expect(kindsOf(3).map((entry) => entry.code)).toEqual([1, 2]);
  });

  it('미등록 대분류는 선택지를 지어내지 않는다(빈 배열)', () => {
    expect(kindsOf(4)).toEqual([]);
    expect(kindLabelOf(4, 1)).toBe('종류 1');
  });
});

describe('itemTypeLabel', () => {
  it('"대분류 · 종류" 한 줄로 낸다', () => {
    expect(itemTypeLabel(1, 3)).toBe('무기 · 검');
    expect(itemTypeLabel(2, 4)).toBe('방어구 · 신발');
    expect(itemTypeLabel(3, 2)).toBe('마법 · 특수');
  });
});
