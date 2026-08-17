import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ListFrame from './ListFrame'

describe('<ListFrame>', () => {
    it('loading과 ready가 같은 layout resolver를 사용한다', () => {
        const { rerender } = render(
            <ListFrame
                state={{ kind: 'loading', count: 2 }}
                layout="catalog"
                label="상품 목록"
                renderSkeleton={(index) => <span>로딩 {index}</span>}
            />,
        )
        const loadingGrid = screen.getByText('로딩 0').parentElement
        expect(loadingGrid).toHaveClass('grid-cols-2', 'gap-3')

        rerender(
            <ListFrame
                state={{ kind: 'ready' }}
                layout="catalog"
                label="상품 목록"
                renderSkeleton={() => null}
            >
                <article>상품</article>
            </ListFrame>,
        )
        expect(screen.getByRole('region', { name: '상품 목록' })).toHaveClass(
            'grid-cols-2',
            'gap-3',
        )
    })

    it('error retry와 empty action을 접근 가능한 이름으로 제공한다', () => {
        const retry = vi.fn()
        const { rerender } = render(
            <ListFrame
                state={{
                    kind: 'error',
                    message: '잠시 후 다시 시도',
                    onRetry: retry,
                }}
                layout="catalog"
                label="경매 목록"
                renderSkeleton={() => null}
            />,
        )
        screen.getByRole('button', { name: '다시 시도' }).click()
        expect(retry).toHaveBeenCalledOnce()

        rerender(
            <ListFrame
                state={{
                    kind: 'empty',
                    title: '결과가 없어요',
                    action: <button>초기화</button>,
                }}
                layout="catalog"
                label="경매 목록"
                renderSkeleton={() => null}
            />,
        )
        expect(
            screen.getByRole('heading', { name: '결과가 없어요' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '초기화' }),
        ).toBeInTheDocument()
    })
})
