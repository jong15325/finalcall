import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import SellPage from './SellPage'
import { okEnvelope, renderWithProviders, signInForTest } from '@/test/renderWithProviders'
import type { InventoryItem } from '@/lib/api/inventory'
import type { Mock } from 'vitest'

/**
 * 판매 페이지 선점 모드 (FC-177).
 *
 * 고정하는 것:
 *  1. `?item=<유효 id>` → 그 아이템만 잠금 카드로 노출(picker 그리드 제거).
 *  2. `?item` 없음/무효 → "판매할 아이템을 선택하세요" 빈 상태(인벤토리로 유도).
 *  3. 인벤토리가 비면 기존 "출품할 아이템이 없습니다" 빈 상태 보존.
 */

let fetchMock: Mock

beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    signInForTest()
})

const sword: InventoryItem = {
    itemInstancePublicId: 'INST-1',
    slotNo: 1,
    summary: {
        typeCode: 1123, // 무기·불·검
        displayName: '불의 검',
        level: 4,
        skill1Code: 104,
        skill2Code: null,
        skillPercent: 18,
        goldforceExpireAt: null,
    },
}

/** GET /me/inventory 만 응답한다(submit 전이라 auctions/shops 는 부르지 않는다). */
function mockInventory(items: InventoryItem[]) {
    fetchMock.mockImplementation(async (url: string) => {
        const u = String(url)
        if (u.includes('/me/inventory')) {
            return okEnvelope({
                capacity: 24,
                used: items.length,
                items,
            })
        }
        return okEnvelope(null)
    })
}

describe('SellPage 선점 모드 (FC-177)', () => {
    it('?item 유효 → 그 아이템만 잠금 카드로 노출한다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        expect(await screen.findByText('1. 판매할 아이템')).toBeInTheDocument()
        expect(screen.getByText('불의 검')).toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: '인벤토리에서 다시 선택' }),
        ).toBeInTheDocument()
        // 판매 방식 등 이후 폼은 유지된다.
        expect(
            screen.getByRole('radio', { name: /경매/ }),
        ).toBeInTheDocument()
    })

    it('?item 무효(인벤토리에 없음) → 선택 유도 빈 상태를 보인다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell?item=NOPE' })

        expect(
            await screen.findByText('판매할 아이템을 선택하세요'),
        ).toBeInTheDocument()
        expect(screen.queryByText('1. 판매할 아이템')).toBeNull()
        expect(
            screen.getByRole('link', { name: '인벤토리로 가기' }),
        ).toBeInTheDocument()
    })

    it('?item 없음 → 선택 유도 빈 상태를 보인다', async () => {
        mockInventory([sword])
        renderWithProviders(<SellPage />, { route: '/sell' })

        expect(
            await screen.findByText('판매할 아이템을 선택하세요'),
        ).toBeInTheDocument()
    })

    it('인벤토리가 비면 기존 "출품할 아이템이 없습니다" 를 보인다', async () => {
        mockInventory([])
        renderWithProviders(<SellPage />, { route: '/sell?item=INST-1' })

        await waitFor(() =>
            expect(
                screen.getByText('출품할 아이템이 없습니다'),
            ).toBeInTheDocument(),
        )
        expect(screen.queryByText('판매할 아이템을 선택하세요')).toBeNull()
    })
})
