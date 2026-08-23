import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Scenario from './CardInfoParityScenario'

describe('CardInfoParityScenario', () => {
    it('keeps shared card information before the bid panel', () => {
        window.history.replaceState({}, '', '/?view=auction&state=ready')
        render(<Scenario />)
        const root = screen.getByTestId('card-info-parity')
        expect(root).toHaveClass(
            'lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]',
            'min-w-0',
        )
        const itemSurface = screen.getByLabelText('경매 아이템 정보')
        expect(itemSurface).toHaveClass(
            'card-info-content-shell',
            'w-full',
            'min-w-0',
        )
        expect(itemSurface).not.toHaveClass('shop-cardinfo')
        expect(itemSurface.querySelector('.card-info-content')).toBeTruthy()
        expect(itemSurface.querySelector('.ci-seller')).toBeTruthy()
        expect(screen.getAllByText('특수 스킬')).toHaveLength(1)
        expect(
            screen
                .getByLabelText('경매 아이템 정보')
                .compareDocumentPosition(
                    screen.getByLabelText('경매 입찰 정보'),
                ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
        expect(
            Array.from(root.querySelectorAll('.ci-row .k')).map(
                (node) => node.textContent,
            ),
        ).toEqual(['타입', '명칭', '채널제한', '속성', '남은 골드 포스'])
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
            document.documentElement.clientWidth,
        )
        expect(screen.getByText('현재 최고가')).toBeInTheDocument()
        expect(screen.getByText('다음 최소 입찰가')).toBeInTheDocument()
        expect(screen.getByText('사용 가능 게임머니')).toBeInTheDocument()
        expect(screen.getByText('즉시구매가')).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: '입찰하기' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /즉시구매/ }),
        ).toBeInTheDocument()
    })

    it.each(['long', 'no-skill'])('supports %s fixture state', (state) => {
        window.history.replaceState({}, '', `/?view=auction&state=${state}`)
        render(<Scenario />)
        expect(screen.getByLabelText('특수 스킬')).toBeInTheDocument()
        expect(screen.getByText('입찰하기')).toBeInTheDocument()
    })
})
