import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { stubApi } from '@/test/apiStub';
import { aTypeCode, anInventoryItem, anItemSummary, aTempStorageItem } from '@/test/fixtures';
import { renderWithProviders, signIn } from '@/test/testUtils';
import { InventoryPage } from './InventoryPage';

/**
 * 인벤토리 — FC-054.
 *
 * 여기서 지키는 계약은 넷이다:
 *   ① **`typeCode` 분해** — 서버가 축을 개별 필드로 주지 않는다(§4.2). 분해가 틀리면 아트가 통째로
 *      엉뚱한 그림이 되는데 **화면상으로는 그럴듯하다** — 그래서 경로를 문자열로 못 박는다.
 *   ② **빈 칸을 그리지 않는다** — 12개를 받으면 셀이 12개다. 96개가 아니다.
 *   ③ **빈 인벤토리** — 신규 회원이 처음 보는 화면이다. 초라하면 안 된다.
 *   ④ **임시보관 배너는 있을 때만** — 0건이면 자리를 차지하지 않는다.
 */

/** `/me/temp-storage` 를 `/me/inventory` 보다 **먼저** 등록한다(부분일치라 순서가 곧 우선순위다). */
function stubInventory(
  inventory: { capacity: number; used: number; items: unknown[] },
  temp: unknown[] = [],
  tempHasNext = false,
): void {
  stubApi([
    { match: '/me/temp-storage', data: { content: temp, nextCursor: null, hasNext: tempHasNext } },
    { match: '/me/inventory', data: inventory },
  ]);
}

describe('인벤토리 — 격자와 용량', () => {
  it('보유 칸만 그린다 — 96칸을 다 그리지 않는다(빈 칸 93개는 정보가 아니다)', async () => {
    signIn();
    const items = Array.from({ length: 12 }, (_, index) =>
      anInventoryItem({ itemInstancePublicId: `item-${index}`, slotNo: index + 1 }),
    );
    stubInventory({ capacity: 96, used: 12, items });

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(await screen.findAllByRole('listitem')).toHaveLength(12);
  });

  it('용량은 서버가 준 used/capacity 를 그대로 적는다(items.length 로 대체 계산하지 않는다)', async () => {
    signIn();
    stubInventory({ capacity: 96, used: 12, items: [anInventoryItem()] });

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(await screen.findByText('/ 96')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('★ typeCode 분해가 아트 경로에 그대로 실린다 — 한 자리만 틀려도 전 아이템이 다른 그림이 된다', async () => {
    signIn();
    stubInventory({
      capacity: 96,
      used: 1,
      items: [
        anInventoryItem({
          // 무기(1) · 흙(3) · 활(4) → typeCode 1134
          summary: anItemSummary({ typeCode: aTypeCode(1, 3, 4), level: 5 }),
        }),
      ],
    });

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    // 데스크톱(l)·모바일(s) 두 노드가 함께 렌더된다 — 원본이 달라 CSS 로 전환되지 않기 때문이다.
    const arts = await screen.findAllByAltText(/흙 속성 무기 · 활 레벨 5/);
    expect(arts.map((art) => art.getAttribute('src'))).toEqual([
      '/art/items/level5/s/earth/bow.png',
      '/art/items/level5/l/earth/bow.png',
    ]);
  });

  it('슬롯 번호·속성·종류·레벨이 캡션에 텍스트로 적힌다(색 단독 전달 금지)', async () => {
    signIn();
    stubInventory({
      capacity: 96,
      used: 1,
      items: [anInventoryItem({ slotNo: 42, summary: anItemSummary({ level: 7 }) })],
    });

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(await screen.findByText('#42')).toBeInTheDocument();
    expect(screen.getByText(/불 속성 · 무기 · 검/)).toBeInTheDocument();
    expect(screen.getByText('Lv.7')).toBeInTheDocument();
  });
});

describe('인벤토리 — 빈·로딩·에러', () => {
  /** ★ 신규 회원이 가입 직후 처음 보는 화면이다. 흔한 상태이지 예외가 아니다. */
  it('빈 인벤토리는 무엇이 들어오는지와 다음 행동을 준다', async () => {
    signIn();
    stubInventory({ capacity: 96, used: 0, items: [] });

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(await screen.findByText('아직 보유한 아이템이 없습니다')).toBeInTheDocument();
    expect(screen.getByText(/낙찰받거나 고정가로 구매한/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '경매 둘러보기' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '고정가 매물 보기' })).toBeInTheDocument();
  });

  it('로딩은 실제 격자와 같은 열 구조로 깐다', () => {
    signIn();
    stubInventory({ capacity: 96, used: 0, items: [] });

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('에러는 코드와 재시도 수단을 함께 노출한다', async () => {
    signIn();
    stubApi([]); // 스텁되지 않은 요청 → 실패

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});

describe('인벤토리 — 임시보관 배너(오버플로우는 평소 비어 있다)', () => {
  it('임시보관이 비면 배너가 아예 렌더되지 않는다', async () => {
    signIn();
    stubInventory({ capacity: 96, used: 1, items: [anInventoryItem()] }, []);

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    await screen.findAllByRole('listitem');
    expect(screen.queryByRole('link', { name: '임시보관 보기' })).not.toBeInTheDocument();
  });

  it('임시보관이 있으면 개수와 이동 경로를 준다', async () => {
    signIn();
    stubInventory({ capacity: 96, used: 1, items: [anInventoryItem()] }, [
      aTempStorageItem({ itemInstancePublicId: 't-1' }),
      aTempStorageItem({ itemInstancePublicId: 't-2' }),
    ]);

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(await screen.findByRole('link', { name: '임시보관 보기' })).toBeInTheDocument();
    // 총건수를 모르는 상태가 아니므로 "이상"을 붙이지 않는다.
    expect(screen.getByRole('status')).toHaveTextContent('임시보관에 아이템 2개가 있습니다');
  });

  it('★ 첫 페이지가 다 차면 "N개 이상"으로 적는다 — cursor 페이지에 총건수가 없다', async () => {
    signIn();
    stubInventory(
      { capacity: 96, used: 1, items: [anInventoryItem()] },
      [aTempStorageItem()],
      true, // hasNext
    );

    renderWithProviders(<InventoryPage />, { route: '/me/inventory' });

    expect(await screen.findByText(/개 이상/)).toBeInTheDocument();
  });
});
