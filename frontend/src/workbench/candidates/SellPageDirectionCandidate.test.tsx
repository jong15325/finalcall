import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import SellPageDirectionCandidate, { SELL_DIRECTION_VARIANTS } from './SellPageDirectionCandidate'

describe('SellPageDirectionCandidate', () => {
    it.each(SELL_DIRECTION_VARIANTS)('%s 안은 필수 판매 정보 전체를 노출한다', (variant) => {
        const { container } = render(<SellPageDirectionCandidate variant={variant} />)

        expect(container.querySelector(`[data-sell-direction="${variant}"]`)).toBeInTheDocument()
        expect(screen.getAllByText('태산의 수호자 갑옷')[0]).toBeVisible()
        expect(screen.getByText(/채널\s?제한/u)).toBeVisible()
        expect(screen.getByText('남은 골드 포스')).toBeVisible()
        expect(screen.getByText('특수 스킬')).toBeVisible()
        expect(screen.getByRole('tab', { name: '경매' })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByText('등록 즉시 시작')).toBeVisible()
        expect(screen.getAllByText('2026-08-17 14:30:00')[0]).toBeVisible()
        expect(screen.queryByText('고급 시간 설정')).not.toBeInTheDocument()
    })

    it('기간과 판매 방식을 실제로 비교할 수 있다', async () => {
        const user = userEvent.setup()
        render(<SellPageDirectionCandidate variant="document" />)

        await user.click(screen.getByRole('button', { name: '경매 기간 7일' }))
        expect(screen.getAllByText('2026-08-21 14:30:00')).not.toHaveLength(0)
        await user.click(screen.getByRole('tab', { name: '고정가' }))
        expect(screen.getByText('판매 기한은 서버가 자동 설정합니다.')).toBeVisible()
        expect(screen.getByText('고정가 판매 흐름')).toBeVisible()
        expect(screen.getByText('구매 시 바로 거래 확정')).toBeVisible()
        expect(screen.getByText('240,000 코드 · 즉시 구매')).toBeVisible()
        expect(screen.queryByText('등록 즉시 시작')).not.toBeInTheDocument()
    })

    it('카드정보 하단 버튼에서 최종 등록 모달을 연다', async () => {
        const user = userEvent.setup()
        render(<SellPageDirectionCandidate variant="canvas" />)

        await user.click(screen.getByRole('button', { name: '판매 등록 검토' }))
        const dialog = screen.getByRole('dialog', {
            name: '판매 등록 확인 FINAL REVIEW',
        })
        expect(dialog).toBeVisible()
        expect(within(dialog).getAllByText('예상 수령액')[0]).toBeVisible()
        expect(within(dialog).getByText('판매 방식')).toBeVisible()
        expect(within(dialog).getByText('특수 스킬')).toBeVisible()
        const confirm = within(dialog).getByRole('button', {
            name: '경매 등록 확정',
        })
        expect(confirm).toBeDisabled()
        const scroll = dialog.querySelector<HTMLElement>('[data-review-scroll]')!
        Object.defineProperties(scroll, {
            clientHeight: { configurable: true, value: 400 },
            scrollHeight: { configurable: true, value: 900 },
            scrollTop: { configurable: true, value: 500, writable: true },
        })
        fireEvent.scroll(scroll)
        expect(confirm).toBeEnabled()
        await user.click(screen.getByRole('button', { name: '취소' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('세 방향은 서로 다른 정보 구조를 사용한다', () => {
        const canvas = render(<SellPageDirectionCandidate variant="canvas" />)
        expect(canvas.container.querySelector('[data-direction-region="summary"]')).not.toBeInTheDocument()
        expect(canvas.container.querySelector('[data-direction-region="steps"]')).not.toBeInTheDocument()
        expect(canvas.container.querySelector('[data-direction-region="primary-settings"]')).toBeInTheDocument()
        expect(canvas.container.querySelector('[data-direction-region="sell-side"]')).toBeInTheDocument()
        expect(canvas.container.querySelector('[data-direction-region="sell-side"]')).toHaveClass('order-1', 'lg:order-2')
        expect(canvas.container.querySelector('[data-direction-region="primary-settings"]')).toHaveClass('order-2', 'lg:order-1')
        expect(screen.getByRole('region', { name: '모바일 판매 등록' })).toBeVisible()
        expect(canvas.container.querySelector('[data-direction-region="item"]')).toHaveClass('shop-cardinfo')
        expect(
            canvas.container
                .querySelector('[data-direction-region="sell-side"]')
                ?.querySelector('[data-direction-region="summary"]'),
        ).not.toBeInTheDocument()
        expect(canvas.container.querySelectorAll('.ci-row')).toHaveLength(5)
        expect(canvas.container.querySelector('.ci-panel .skill-list')).toBeInTheDocument()
        canvas.unmount()

        const guided = render(<SellPageDirectionCandidate variant="guided" />)
        expect(guided.container.querySelector('[data-direction-region="steps"]')).toBeInTheDocument()
    })
})
