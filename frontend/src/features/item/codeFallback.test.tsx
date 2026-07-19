import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { anItem } from '@/test/fixtures';
import { ElementBadge } from './components/ElementBadge';
import { ItemArtSlot } from './components/ItemArtSlot';
import { ItemSpecList } from './components/ItemSpecList';
import { ELEMENT_CODES, elementLabelOf, toElementKey } from './lib/element';

/**
 * ★ **코드 폴백 계약 고정(FC-051 — M-1 재현 방어).**
 *
 * 계약 v1.10 §3.3.1 이 클라이언트 의무를 규정했다: *"미등록 코드는 중립 표기('속성 N') 폴백 +
 * 코드 집합 크기를 가정한 하드코딩(배열 인덱싱·exhaustive switch) 금지"*.
 *
 * 이 의무는 **테스트가 없으면 조용히 무너진다.** FC-038 의 M-1 이 정확히 그랬다 — nullable 필드를
 * `=== undefined` 로 비교해 화면에 "코드 null"이 새어 나갔고, 렌더 테스트 1개면 잡혔을 것이
 * 리뷰까지 살아남았다.
 *
 * ★ 주의: 여기서 **특정 코드가 "미등록"이라고 단정하지 않는다.** `element` 는 계약 v1.10 에서 1~4 가
 * 확정됐고 시드 확장에 따라 `ELEMENT_CODES` 는 계속 자란다 — 등록 목록을 테스트에 복제하면 축이
 * 넓어질 때마다 테스트가 거짓 실패한다. 대신 **명백히 범위 밖인 코드**와 **등록 목록 자체**를 쓴다.
 */

/** 등록될 리 없는 코드. 축이 확장돼도 여기까지 오지 않는다. */
const UNREGISTERED = 99;

describe('element 코드 폴백 (계약 v1.10 §3.3.1)', () => {
  it('미등록 코드는 null 키로 떨어진다 — 인접 코드로 넘겨짚지 않는다', () => {
    expect(toElementKey(UNREGISTERED)).toBeNull();
  });

  it('미등록 코드의 라벨은 중립 표기다 — 속성명을 지어내지 않는다', () => {
    expect(elementLabelOf(UNREGISTERED)).toBe(`속성 ${UNREGISTERED}`);
  });

  it('등록된 코드는 전부 실제 속성명으로 해석된다 — 중립 표기로 새지 않는다', () => {
    for (const { code } of ELEMENT_CODES) {
      expect(toElementKey(code)).not.toBeNull();
      expect(elementLabelOf(code)).not.toMatch(/^속성 \d+$/);
    }
  });

  it('코드 집합 크기를 가정하지 않는다 — 0~120 어떤 값도 라벨을 반환하고 던지지 않는다', () => {
    // 배열 인덱싱·exhaustive switch 가 숨어 있으면 여기서 undefined 나 throw 로 드러난다.
    for (let code = 0; code <= 120; code += 1) {
      expect(() => elementLabelOf(code)).not.toThrow();
      expect(elementLabelOf(code)).toBeTruthy();
    }
  });

  it('ElementBadge — 미등록 코드는 중립 칩으로 폴백하고 크래시하지 않는다', () => {
    render(<ElementBadge element={UNREGISTERED} />);

    expect(screen.getByText(`속성 ${UNREGISTERED}`)).toBeInTheDocument();
  });

  it('ItemArtSlot — 미등록 코드에도 대체텍스트가 온전하다(속성·레벨 포함)', () => {
    render(<ItemArtSlot name="시험용 아이템" element={UNREGISTERED} level={7} />);

    const slot = screen.getByRole('img');
    expect(slot).toHaveAccessibleName(`속성 ${UNREGISTERED} 속성 레벨 7 시험용 아이템`);
  });

  it('ItemSpecList — 미등록 속성 코드가 표에 중립 표기로 나온다', () => {
    render(<ItemSpecList item={anItem({ element: UNREGISTERED })} />);

    expect(screen.getByText(`속성 ${UNREGISTERED}`)).toBeInTheDocument();
  });
});

describe('nullable 필드 폴백 (FC-038 M-1 회귀)', () => {
  /**
   * 계약 §3.3 에서 `skill1`·`skill2` 는 nullable 이고 **서버는 wire 에 `null` 을 그대로 싣는다**
   * (NON_NULL 설정 없음). `=== undefined` 로 비교하면 이 null 이 통과해 "코드 null"이 화면에 뜬다.
   * 그게 M-1 이었다. 두 부재 표현(null·undefined)을 모두 태워 느슨 비교(`== null`)를 고정한다.
   */
  it('빈 스킬 슬롯은 null 이든 undefined 든 "없음"이다 — "코드 null" 이 새지 않는다', () => {
    render(<ItemSpecList item={anItem({ skill1: null, skill2: undefined })} />);

    expect(screen.getAllByText('없음')).toHaveLength(3); // 스킬 1·2 + 골드포스
    expect(screen.queryByText(/코드 null/)).not.toBeInTheDocument();
    expect(screen.queryByText(/코드 undefined/)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument();
  });

  it('채워진 스킬 슬롯은 코드를 그대로 밝힌다 — 이름을 지어내지 않는다', () => {
    render(<ItemSpecList item={anItem({ skill1: 12, skill2: null })} />);

    expect(screen.getByText('코드 12')).toBeInTheDocument();
  });

  it('골드포스 만료시각이 null 이면 "없음" — 날짜 파싱 결과가 새지 않는다', () => {
    render(<ItemSpecList item={anItem({ goldforceExpireAt: null })} />);

    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});
