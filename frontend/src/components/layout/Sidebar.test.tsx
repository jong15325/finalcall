import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import Sidebar from './Sidebar'

/**
 * 좌측 사이드바 접힘 토글·hover 확장 (FC-087 — 목업 §5.1).
 *
 * 고정하는 것:
 *  1. 토글 아이콘 = Vuexy `menu-toggle-icon` 원형 라디오 — 고정 펼침이면 바깥 원 + 가운데 점(2 path),
 *     접힘이면 바깥 원만(1 path).
 *  2. 접힘 레일(70px)에 마우스가 들어오면 확장 오버레이(260px)로 펼치고, 벗어나면 다시 접힌다
 *     (stuck 없이 확실히 닫힘 — FC-086 회귀 방지).
 *  3. 토글 클릭 → onToggleCollapse.
 *
 * ★ css:false 라 `xl:` 클래스는 적용되지 않지만 **문자열로 존재**한다 — 폭 클래스 토글로 상태를 검증한다.
 */

function renderSidebar(
    props: Partial<React.ComponentProps<typeof Sidebar>> = {},
) {
    const onToggleCollapse = props.onToggleCollapse ?? vi.fn()
    const onCloseMobile = props.onCloseMobile ?? vi.fn()
    renderWithProviders(
        <Sidebar
            collapsed={props.collapsed ?? false}
            mobileOpen={props.mobileOpen ?? false}
            onToggleCollapse={onToggleCollapse}
            onCloseMobile={onCloseMobile}
        />,
    )
    return { onToggleCollapse, onCloseMobile }
}

describe('<Sidebar> 토글·hover', () => {
    it('고정 펼침이면 라디오 아이콘에 가운데 점이 있다(2 path) + "메뉴 접기"', () => {
        renderSidebar({ collapsed: false })
        const toggle = screen.getByRole('button', { name: '메뉴 접기' })
        expect(toggle.querySelectorAll('path')).toHaveLength(2)
        // chevron 이 아니라 원형 라디오(svg) 다.
        expect(toggle.querySelector('svg')).toBeTruthy()
    })

    it('접힘이면 라디오 아이콘이 빈 원(1 path) + "메뉴 고정 펼치기"', () => {
        renderSidebar({ collapsed: true })
        const toggle = screen.getByRole('button', { name: '메뉴 고정 펼치기' })
        expect(toggle.querySelectorAll('path')).toHaveLength(1)
    })

    it('접힘 레일 hover → 260px 확장, mouseLeave → 70px 로 확실히 닫힘', () => {
        renderSidebar({ collapsed: true })
        const aside = screen.getByRole('complementary', { name: '주 메뉴' })

        // 초기: 레일 70px.
        expect(aside.className).toContain('xl:w-[70px]')
        expect(aside.className).not.toContain('xl:w-[260px]')

        // hover: 확장 오버레이 260px + 그림자.
        fireEvent.mouseEnter(aside)
        expect(aside.className).toContain('xl:w-[260px]')
        expect(aside.className).toContain('xl:shadow-2xl')

        // mouseLeave: 다시 70px 로 닫힘(stuck 없음).
        fireEvent.mouseLeave(aside)
        expect(aside.className).toContain('xl:w-[70px]')
        expect(aside.className).not.toContain('xl:shadow-2xl')
    })

    it('토글 클릭 → onToggleCollapse', () => {
        const { onToggleCollapse } = renderSidebar({ collapsed: false })
        fireEvent.click(screen.getByRole('button', { name: '메뉴 접기' }))
        expect(onToggleCollapse).toHaveBeenCalledOnce()
    })
})
