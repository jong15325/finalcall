import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useCompareStore } from '@/store/compareStore'
import CardCompareOverlay from './CardCompareOverlay'

/**
 * 카드 비교 오버레이 (FC-079).
 *
 * 고정하는 것: `pressed` 는 스토어에서 파생 / 클릭이 담고·빼고 / 가득 차면 미담김 카드는 disabled.
 */

const store = () => useCompareStore.getState()

beforeEach(() => {
    sessionStorage.clear()
    useCompareStore.setState({ items: [] })
})

describe('<CardCompareOverlay>', () => {
    it('담기 클릭이 스토어에 참조를 넣고 aria-pressed 가 true 가 된다', async () => {
        const user = userEvent.setup()
        renderWithProviders(<CardCompareOverlay listingId="a1" name="도끼" />)

        const button = screen.getByRole('button')
        expect(button).toHaveAttribute('aria-pressed', 'false')

        await user.click(button)
        expect(store().items).toEqual([{ source: 'AUCTION', listingId: 'a1' }])
        expect(screen.getByRole('button')).toHaveAttribute(
            'aria-pressed',
            'true',
        )
    })

    it('다시 클릭하면 비교에서 뺀다', async () => {
        const user = userEvent.setup()
        renderWithProviders(<CardCompareOverlay listingId="a1" name="도끼" />)

        await user.click(screen.getByRole('button'))
        await user.click(screen.getByRole('button'))
        expect(store().items).toEqual([])
    })

    it('가득 차고(3개) 미담김이면 disabled — 클릭해도 담기지 않는다', async () => {
        const user = userEvent.setup()
        useCompareStore.setState({
            items: [
                { source: 'AUCTION', listingId: 'x' },
                { source: 'AUCTION', listingId: 'y' },
                { source: 'AUCTION', listingId: 'z' },
            ],
        })
        renderWithProviders(<CardCompareOverlay listingId="a1" name="도끼" />)

        const button = screen.getByRole('button')
        expect(button).toBeDisabled()
        await user.click(button)
        expect(store().items).toHaveLength(3)
    })
})
