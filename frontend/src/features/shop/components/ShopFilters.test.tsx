import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_SHOP_FILTERS } from '@/features/shop/lib/shopFilters'
import ShopFilters from './ShopFilters'

describe('<ShopFilters>', () => {
    it('공통 활성 조건 바에서 기존 개별 해제와 전체 초기화를 전달한다', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        const onReset = vi.fn()
        render(
            <ShopFilters
                filters={{ ...EMPTY_SHOP_FILTERS, element: 1 }}
                templates={[]}
                onChange={onChange}
                onReset={onReset}
            />,
        )

        await user.click(
            screen.getByRole('button', { name: /물 속성.*필터 해제/ }),
        )
        await user.click(screen.getByRole('button', { name: '전체 초기화' }))
        expect(onChange).toHaveBeenCalledWith({ element: null })
        expect(onReset).toHaveBeenCalledOnce()
        expect(
            screen
                .getByRole('group', { name: '적용된 조건' })
                .closest('[data-list-filter-surface]'),
        ).not.toBeNull()
    })
})
