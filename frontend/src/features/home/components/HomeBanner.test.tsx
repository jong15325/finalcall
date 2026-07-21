import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import HomeBanner from './HomeBanner'

/**
 * 홈 배너 캐러셀 (FC-070).
 *
 * 고정하는 것:
 *  1. 슬라이드 링크는 **실연동 라우트**로만 간다(404 방지, §5).
 *  2. 도트 클릭으로 활성 슬라이드가 바뀐다(`aria-current`).
 *  3. **비활성 슬라이드는 초점에서 제외**(링크 `tabIndex=-1`) — 화면 밖 초점 유출 방지.
 */

describe('<HomeBanner>', () => {
    it('첫 슬라이드는 경매 목록 링크(실연동)이고 초점 대상이다', () => {
        renderWithProviders(<HomeBanner />)
        const first = screen.getByRole('link', { name: /경매 보러 가기/ })
        expect(first).toHaveAttribute('href', '/auctions')
        expect(first).toHaveAttribute('tabindex', '0')
    })

    it('비활성 슬라이드 링크는 tabIndex=-1(초점 제외)', () => {
        renderWithProviders(<HomeBanner />)
        // 초기 비활성 슬라이드는 aria-hidden 이라 a11y 트리 밖 — hidden 포함 조회.
        const join = screen.getByRole('link', {
            name: /가입하고 시작하기/,
            hidden: true,
        })
        expect(join).toHaveAttribute('tabindex', '-1')
    })

    it('도트를 누르면 해당 슬라이드가 활성(aria-current)이 된다', () => {
        renderWithProviders(<HomeBanner />)
        const dot3 = screen.getByRole('button', { name: '3번 배너로 이동' })
        fireEvent.click(dot3)
        expect(dot3).toHaveAttribute('aria-current', 'true')
        // 3번 슬라이드(가입 CTA)가 초점 대상이 된다
        const join = screen.getByRole('link', { name: /가입하고 시작하기/ })
        expect(join).toHaveAttribute('tabindex', '0')
    })

    it('다음 버튼으로 활성 슬라이드가 넘어간다', () => {
        renderWithProviders(<HomeBanner />)
        fireEvent.click(screen.getByRole('button', { name: '다음 배너' }))
        expect(
            screen.getByRole('button', { name: '2번 배너로 이동' }),
        ).toHaveAttribute('aria-current', 'true')
    })
})
