import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuctionInfoRail, AuctionTimeDisplay } from './AuctionTimeDisplay'

describe('AuctionTimeDisplay', () => {
    it('시간을 badge가 아닌 read-only tabular data로 표시한다', () => {
        render(<AuctionTimeDisplay label="남은 시간">12:48</AuctionTimeDisplay>)
        const time = screen.getByText('12:48')
        expect(time.tagName).toBe('TIME')
        expect(time).toHaveClass('auction-time-display__digits')
        expect(time.closest('[data-vuexy-badge]')).toBeNull()
    })

    it('경매 정보 rail을 별도 anatomy로 제공한다', () => {
        render(
            <AuctionInfoRail>
                <span>입찰 18</span>
                <AuctionTimeDisplay>12:48</AuctionTimeDisplay>
            </AuctionInfoRail>,
        )
        expect(
            screen.getByText('입찰 18').closest('[data-auction-info-rail]'),
        ).toBeInTheDocument()
    })
})
