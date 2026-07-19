import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { stubApi } from '@/test/apiStub';
import { aTempStorageItem, anItemSummary } from '@/test/fixtures';
import { renderWithProviders, signIn } from '@/test/testUtils';
import { TempStoragePage } from './TempStoragePage';

/**
 * 임시보관 — FC-054.
 *
 * 여기서 지키는 계약은 셋이다:
 *   ① **빈 상태가 정상이다** — 오버플로우 화면이라 0건이 기본값이다. 문제처럼 그리면 사용자가 없는
 *      문제를 찾아 나선다.
 *   ② **relocate 는 목적 슬롯을 묻지 않는다** — body 에 `slotNo` 를 싣지 않고 서버가 배정한다.
 *      요청 본문을 실제로 들여다본다(계약 §4.2 "미지정 시 빈 슬롯 자동 배정").
 *   ③ **에러 코드마다 할 일이 다르다** — INV_001(만실)을 "다시 시도"로 뭉뚱그리면 안 된다.
 */

function stubTemp(content: unknown[], hasNext = false): void {
  stubApi([{ match: '/me/temp-storage', data: { content, nextCursor: null, hasNext } }]);
}

describe('임시보관 — 목록·빈 상태', () => {
  it('빈 임시보관은 "정상"이라고 말한다', async () => {
    signIn();
    stubTemp([]);

    renderWithProviders(<TempStoragePage />, { route: '/me/temp-storage' });

    expect(await screen.findByText('임시보관이 비어 있습니다')).toBeInTheDocument();
    expect(screen.getByText(/정상입니다/)).toBeInTheDocument();
  });

  it('보관 아이템은 아트·이름·보관 시각·이동 버튼을 갖는다', async () => {
    signIn();
    stubTemp([
      aTempStorageItem({
        itemInstancePublicId: 't-1',
        summary: anItemSummary({ displayName: '불의 검' }),
      }),
    ]);

    renderWithProviders(<TempStoragePage />, { route: '/me/temp-storage' });

    expect(await screen.findByText('불의 검')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인벤토리로 옮기기' })).toBeInTheDocument();
    // 행 썸네일은 `s` 아트다(홈 행 목록과 같은 언어).
    expect(screen.getByAltText(/불 속성 무기 · 검 레벨 7/)).toHaveAttribute(
      'src',
      '/art/items/level7/s/fire/sword.png',
    );
  });

  it('만료 기한이 없으면 적지 않는다 — "무기한"이라고 지어내지 않는다', async () => {
    signIn();
    stubTemp([aTempStorageItem({ expireAt: null })]);

    renderWithProviders(<TempStoragePage />, { route: '/me/temp-storage' });

    await screen.findByRole('button', { name: '인벤토리로 옮기기' });
    expect(screen.queryByText(/까지/)).not.toBeInTheDocument();
  });

  it('에러는 코드와 재시도 수단을 함께 노출한다', async () => {
    signIn();
    stubApi([]);

    renderWithProviders(<TempStoragePage />, { route: '/me/temp-storage' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
});

describe('임시보관 — relocate', () => {
  it('★ 목적 슬롯을 보내지 않는다(서버 자동 배정) + 성공 시 배정된 칸을 알린다', async () => {
    signIn();
    stubApi([
      { match: '/relocate', data: { slotNo: 7 } },
      { match: '/me/temp-storage', data: { content: [aTempStorageItem()], hasNext: false } },
    ]);

    renderWithProviders(<TempStoragePage />, { route: '/me/temp-storage' });

    fireEvent.click(await screen.findByRole('button', { name: '인벤토리로 옮기기' }));

    const banner = await screen.findByText(/번 칸으로/);
    // 서버가 배정한 칸 번호를 그대로 알린다 — "옮겼습니다"로 뭉뚱그리면 어디로 갔는지 알 수 없다.
    expect(banner.closest('[role="status"]')).toHaveTextContent(
      '시험용 아이템을(를) 인벤토리 7번 칸으로 옮겼습니다',
    );

    const call = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes('/relocate'));
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({});
  });

  it('만실(INV_001)은 "다시 시도"가 아니라 칸을 비우라고 말한다', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/relocate')
          ? {
              status: 409,
              payload: {
                success: false,
                code: 'INV_001',
                message: '인벤토리가 가득 찼습니다',
                timestamp: new Date().toISOString(),
              },
            }
          : {
              status: 200,
              payload: {
                success: true,
                data: { content: [aTempStorageItem()], nextCursor: null, hasNext: false },
                timestamp: new Date().toISOString(),
              },
            };
        return Promise.resolve(
          new Response(JSON.stringify(body.payload), {
            status: body.status,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    renderWithProviders(<TempStoragePage />, { route: '/me/temp-storage' });

    fireEvent.click(await screen.findByRole('button', { name: '인벤토리로 옮기기' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('정규 인벤토리가 가득 찼습니다'),
    );
  });
});
