import { cardInfoFixture } from '@/test/cardInfoFixture'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { Route, Routes, useSearchParams } from 'react-router'
import InventoryPage from './InventoryPage'
import {
    okEnvelope,
    renderWithProviders,
    signInForTest,
} from '@/test/renderWithProviders'
import type { InventoryItem } from '@/lib/api/inventory'
import type { Mock } from 'vitest'

/**
 * 인벤토리 개편 + 판매 이동 (FC-177).
 *
 * 고정하는 것:
 *  1. 전체폭 그리드에 채운 슬롯 렌더 + 용량 배지.
 *  2. 슬롯 클릭 → 상세 다이얼로그(판매하기).
 *  3. 판매하기 → `/sell?item=<itemInstancePublicId>` 로 이동(URL 쿼리 정본).
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
        level: 3,
        skill1Code: 104,
        skill2Code: null,
        skillPercent: 18,
        goldforceExpireAt: null,
        cardInfo: cardInfoFixture({
            shortName: 'Lv.3 불검',
            formalName: '3레벨 칼',
            kind: { code: 3, label: '칼', abbreviation: '검' },
            skills: [
                { slot: 1, code: 104, name: '공격력 증가', percent: null },
                { slot: 2, code: null, name: null, percent: null },
            ],
        }),
    },
}

function mockInventory(items: InventoryItem[], capacity = 24) {
    fetchMock.mockImplementation(async (url: string) => {
        const u = String(url)
        if (u.includes('/me/inventory')) {
            return okEnvelope({ capacity, used: items.length, items })
        }
        return okEnvelope(null)
    })
}

/** `/sell` 이동 대상을 대신해 `?item` 쿼리를 노출하는 프로브. */
function SellProbe() {
    const [params] = useSearchParams()
    return <div>SELL item={params.get('item')}</div>
}

function renderInventory() {
    return renderWithProviders(
        <Routes>
            <Route path="/me/inventory" element={<InventoryPage />} />
            <Route path="/sell" element={<SellProbe />} />
        </Routes>,
        { route: '/me/inventory' },
    )
}

describe('InventoryPage (FC-177)', () => {
    it('용량 배지와 채운 슬롯을 보인다', async () => {
        mockInventory([sword])
        renderInventory()

        expect(await screen.findByText('1 / 24 사용')).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: 'Lv.3 불검 카드정보 보기' }),
        ).toBeInTheDocument()
    })

    it('슬롯 클릭 → 상세 다이얼로그 → 판매하기 → /sell?item=<id> 로 이동', async () => {
        mockInventory([sword])
        renderInventory()

        const slot = await screen.findByRole('button', {
            name: 'Lv.3 불검 카드정보 보기',
        })
        fireEvent.click(slot)

        // 상세 다이얼로그가 열린다.
        const dialog = await screen.findByRole('dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')

        // 판매 등록 → 선점 쿼리로 이동.
        fireEvent.click(screen.getByRole('button', { name: '판매 등록' }))
        expect(await screen.findByText('SELL item=INST-1')).toBeInTheDocument()
    })

    it('96칸을 24칸씩 네 개 탭으로 나누고 선택한 슬롯 범위만 표시한다', async () => {
        mockInventory([], 96)
        renderInventory()

        expect(
            await screen.findByRole('navigation', {
                name: '인벤토리 슬롯 페이지',
            }),
        ).toBeInTheDocument()
        expect(screen.getByLabelText('빈 슬롯 24')).toBeInTheDocument()
        expect(screen.queryByLabelText('빈 슬롯 25')).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: '인벤토리 탭 2' }))
        expect(screen.getByLabelText('빈 슬롯 25')).toBeInTheDocument()
        expect(screen.getByLabelText('빈 슬롯 48')).toBeInTheDocument()
        expect(screen.queryByLabelText('빈 슬롯 24')).toBeNull()
    })
})
