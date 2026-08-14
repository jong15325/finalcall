import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, useNavigate } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScrollToTop from './ScrollToTop'

function NavigationHarness() {
    const navigate = useNavigate()

    return (
        <>
            <ScrollToTop />
            <input aria-label="focus target" />
            <button
                type="button"
                onClick={() => navigate('/replaced', { replace: true })}
            >
                replace
            </button>
            <button type="button" onClick={() => navigate(-1)}>
                back
            </button>
            <Link to="/next">next</Link>
            <Link to="/next?sort=latest">search</Link>
            <Link to="/next#details">hash</Link>
            <Link to="/other#details">path and hash</Link>
            <Link to="/__design/sample">design</Link>
        </>
    )
}

function renderNavigation(initialEntries = ['/current']) {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <NavigationHarness />
        </MemoryRouter>,
    )
}

describe('ScrollToTop', () => {
    const scrollTo = vi.fn()

    beforeEach(() => {
        scrollTo.mockReset()
        vi.stubGlobal('scrollTo', scrollTo)
    })

    it('최초 마운트에서는 현재 스크롤 위치에 개입하지 않는다', () => {
        renderNavigation()

        expect(scrollTo).not.toHaveBeenCalled()
    })

    it.each([
        ['PUSH', 'next'],
        ['REPLACE', 'replace'],
    ])('%s로 pathname이 바뀌면 문서 상단으로 이동한다', (_type, control) => {
        renderNavigation()

        fireEvent.click(
            screen.getByRole(control === 'next' ? 'link' : 'button', {
                name: control,
            }),
        )

        expect(scrollTo).toHaveBeenCalledOnce()
        expect(scrollTo).toHaveBeenCalledWith({
            top: 0,
            left: 0,
            behavior: 'auto',
        })
    })

    it('POP 이동에서는 브라우저의 스크롤 복원에 개입하지 않는다', () => {
        renderNavigation(['/previous', '/current'])

        fireEvent.click(screen.getByRole('button', { name: 'back' }))

        expect(scrollTo).not.toHaveBeenCalled()
    })

    it('같은 pathname의 search와 hash 변경은 현재 위치를 유지한다', () => {
        renderNavigation(['/next'])

        fireEvent.click(screen.getByRole('link', { name: 'search' }))
        fireEvent.click(screen.getByRole('link', { name: 'hash' }))

        expect(scrollTo).not.toHaveBeenCalled()
    })

    it('pathname과 hash가 함께 바뀌면 pathname 전환을 우선한다', () => {
        renderNavigation(['/next'])

        fireEvent.click(screen.getByRole('link', { name: 'path and hash' }))

        expect(scrollTo).toHaveBeenCalledOnce()
    })

    it('/__design 계열로 이동할 때는 스크롤 위치를 유지한다', () => {
        renderNavigation()

        fireEvent.click(screen.getByRole('link', { name: 'design' }))

        expect(scrollTo).not.toHaveBeenCalled()
    })

    it.each([
        ['PUSH', 'next'],
        ['REPLACE', 'replace'],
    ])(
        '/__design 계열에서 %s로 나갈 때도 위치를 유지한다',
        (_type, control) => {
            renderNavigation(['/__design/sample'])

            fireEvent.click(
                screen.getByRole(control === 'next' ? 'link' : 'button', {
                    name: control,
                }),
            )

            expect(scrollTo).not.toHaveBeenCalled()
        },
    )

    it('pathname 전환 시 현재 focus를 변경하지 않는다', () => {
        renderNavigation()
        const focusTarget = screen.getByRole('textbox', {
            name: 'focus target',
        })
        focusTarget.focus()

        fireEvent.click(screen.getByRole('link', { name: 'next' }))

        expect(focusTarget).toHaveFocus()
    })
})
