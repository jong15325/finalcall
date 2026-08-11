import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_FILTERS } from '@/features/auction/lib/auctionFilters'
import AuctionFilters from './AuctionFilters'

describe('AuctionFilters responsive width', () => {
    it('allows every select column to shrink within 320px and 390px planes', () => {
        const view = render(
            <AuctionFilters
                filters={EMPTY_FILTERS}
                templates={[]}
                onChange={vi.fn()}
                onReset={vi.fn()}
            />,
        )

        screen.getAllByRole('combobox').forEach((select) => {
            expect(select).toHaveClass('w-full', 'min-w-0')
            expect(select.parentElement).toHaveClass('min-w-0')
        })
        expect(view.container.querySelector('.xs\\:grid-cols-3')).toHaveClass(
            'min-w-0',
        )
    })
})
