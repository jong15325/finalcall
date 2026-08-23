import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import HomeBanner from './HomeBanner'

/**
 * 홈 배너 캐러셀 (FC-070 — 목업 `#home` home-carousel 3슬라이드).
 *
 * 고정하는 것:
 *  1. 목업 3슬라이드 문구·CTA·대상(`/market`·`/auctions`) 1:1.
 *  2. 도트/다음 버튼으로 활성 슬라이드가 바뀐다(`aria-current`).
 *  3. **비활성 슬라이드는 초점에서 제외**(링크 `tabIndex=-1`) — 화면 밖 초점 유출 방지.
 */

describe('<HomeBanner>', () => {
    it('슬라이드1(WEEKLY BENEFIT)은 마켓 링크이고 초점 대상이다', () => {
        renderWithProviders(<HomeBanner />)
        expect(screen.getByText('WEEKLY BENEFIT')).toBeInTheDocument()
        const first = screen.getByRole('link', { name: /할인 아이템 보기/ })
        expect(first).toHaveAttribute('href', '/market')
        expect(first).toHaveAttribute('tabindex', '0')
    })

    it('비활성 슬라이드 링크는 tabIndex=-1(초점 제외)', () => {
        renderWithProviders(<HomeBanner />)
        // 초기 비활성 슬라이드는 aria-hidden 이라 a11y 트리 밖 — hidden 포함 조회.
        const auction = screen.getByRole('link', {
            name: /경매 참여하기/,
            hidden: true,
        })
        expect(auction).toHaveAttribute('href', '/auctions')
        expect(auction).toHaveAttribute('tabindex', '-1')
    })

    it('도트를 누르면 해당 슬라이드가 활성(aria-current)이 된다', () => {
        renderWithProviders(<HomeBanner />)
        const dot3 = screen.getByRole('button', { name: '3번 배너로 이동' })
        fireEvent.click(dot3)
        expect(dot3).toHaveAttribute('aria-current', 'true')
        // 3번 슬라이드(AI 시세, 준비 중)가 초점 대상이 된다
        const insight = screen.getByRole('link', { name: /시세 확인하기/ })
        expect(insight).toHaveAttribute('href', '/market')
        expect(insight).toHaveAttribute('tabindex', '0')
    })

    it('슬라이드3에는 "준비 중" 보조 배지가 있다(AI 시세 미구현)', () => {
        renderWithProviders(<HomeBanner />)
        fireEvent.click(screen.getByRole('button', { name: '3번 배너로 이동' }))
        expect(screen.getByText('PRICE INSIGHT')).toBeInTheDocument()
        expect(screen.getByText('준비 중')).toBeInTheDocument()
    })

    it('다음 버튼으로 활성 슬라이드가 넘어간다', () => {
        renderWithProviders(<HomeBanner />)
        fireEvent.click(screen.getByRole('button', { name: '다음 배너' }))
        expect(
            screen.getByRole('button', { name: '2번 배너로 이동' }),
        ).toHaveAttribute('aria-current', 'true')
    })

    it('모바일 가로 스크롤 위치를 활성 배너와 동기화한다', () => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 390,
        })
        renderWithProviders(<HomeBanner />)
        const track = document.querySelector('.home-banner__track')
        expect(track).not.toBeNull()
        Object.defineProperty(track, 'clientWidth', {
            configurable: true,
            value: 390,
        })
        Object.defineProperty(track, 'scrollLeft', {
            configurable: true,
            value: 402,
        })
        fireEvent.scroll(track!)

        expect(
            screen.getByRole('button', { name: '2번 배너로 이동' }),
        ).toHaveAttribute('aria-current', 'true')
    })

    it('모바일 마지막 뒤의 연결 슬라이드에서 같은 방향으로 첫 배너를 이어간다', () => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 390,
        })
        renderWithProviders(<HomeBanner />)
        const track = document.querySelector('.home-banner__track')
        const scrollTo = vi.fn()
        Object.defineProperty(track, 'clientWidth', {
            configurable: true,
            value: 390,
        })
        Object.defineProperty(track, 'scrollLeft', {
            configurable: true,
            value: 3 * 402,
        })
        Object.defineProperty(track, 'scrollTo', {
            configurable: true,
            value: scrollTo,
        })

        expect(track?.querySelector('[data-loop-clone]')).not.toBeNull()
        fireEvent.scroll(track!)
        expect(
            screen.getByRole('button', { name: '1번 배너로 이동' }),
        ).toHaveAttribute('aria-current', 'true')
        fireEvent(track!, new Event('scrollend'))
        expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'auto' })
    })
})
