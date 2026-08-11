import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import ItemDetailPage from './ItemDetailPage'

const mocks = vi.hoisted(() => ({ detail: vi.fn() }))

vi.mock('@/lib/queries/items', () => ({ useItemInstance: mocks.detail }))
vi.mock('@/features/item/components/ElementDetailBackground', () => ({
    default: ({
        element,
        children,
    }: {
        element: number
        children: React.ReactNode
    }) => (
        <section data-testid="element-background" data-element={element}>
            {children}
        </section>
    ),
}))
vi.mock('@/features/item/components/ItemInstanceDetail', () => ({
    default: ({ item }: { item: { itemInstancePublicId: string } }) => (
        <main data-testid="item-detail">{item.itemInstancePublicId}</main>
    ),
}))

const item = {
    itemInstancePublicId: 'I-1',
    template: { element: 3 },
}

function renderPage(route = '/items/I-1') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/items/:id" element={<ItemDetailPage />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('ItemDetailPage 속성 배경 계약', () => {
    beforeEach(() => mocks.detail.mockReset())

    it('로딩에는 배경이 없고 성공 응답 template.element만 전달한다', () => {
        mocks.detail.mockReturnValueOnce({ isPending: true })
        const view = renderPage()
        expect(screen.queryByTestId('element-background')).toBeNull()

        mocks.detail.mockReturnValue({
            data: item,
            isPending: false,
            isError: false,
        })
        view.rerender(
            <MemoryRouter initialEntries={['/items/I-1']}>
                <Routes>
                    <Route path="/items/:id" element={<ItemDetailPage />} />
                </Routes>
            </MemoryRouter>,
        )
        expect(screen.getByTestId('element-background')).toHaveAttribute(
            'data-element',
            '3',
        )
        expect(screen.getByTestId('item-detail')).toHaveTextContent('I-1')
    })

    it('보호 라우트의 id 전환은 새 상세 속성으로 격리한다', () => {
        mocks.detail.mockImplementation((id: string) => ({
            data: {
                itemInstancePublicId: id,
                template: { element: id === 'I-2' ? 1 : 3 },
            },
            isPending: false,
            isError: false,
        }))
        const first = renderPage('/items/I-1')
        expect(screen.getByTestId('element-background')).toHaveAttribute(
            'data-element',
            '3',
        )
        first.unmount()
        renderPage('/items/I-2')
        expect(screen.getByTestId('element-background')).toHaveAttribute(
            'data-element',
            '1',
        )
        expect(screen.getByTestId('item-detail')).toHaveTextContent('I-2')
    })

    it('404와 일반 오류에는 상세 배경이 생기지 않는다', () => {
        mocks.detail.mockReturnValue({
            error: new ApiError({
                code: ERROR_CODES.ITEM_001,
                message: '없음',
                status: 404,
            }),
            isPending: false,
            isError: true,
        })
        const missing = renderPage('/items/NOPE')
        expect(screen.queryByTestId('element-background')).toBeNull()
        missing.unmount()

        mocks.detail.mockReturnValue({
            error: new Error('network'),
            isPending: false,
            isError: true,
        })
        renderPage('/items/FAIL')
        expect(screen.queryByTestId('element-background')).toBeNull()
    })
})
