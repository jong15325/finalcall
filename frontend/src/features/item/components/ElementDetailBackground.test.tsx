import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '@/test/renderWithProviders'
import ElementDetailBackground from './ElementDetailBackground'

class MockImage {
    static instances: MockImage[] = []
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    src = ''

    constructor() {
        MockImage.instances.push(this)
    }
}

describe('ElementDetailBackground', () => {
    beforeEach(() => {
        MockImage.instances = []
        vi.stubGlobal('Image', MockImage)
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            null,
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('현재 속성 자산 하나만 요청하고 성공 후에만 배경을 표시한다', () => {
        document.body.className = 'existing-shell-class'
        document.body.dataset.owner = 'app'
        const { container, unmount } = render(
            <ElementDetailBackground element={2}>
                <button type="button">입찰하기</button>
            </ElementDetailBackground>,
        )

        expect(MockImage.instances).toHaveLength(1)
        expect(container.querySelector('.element-detail__scene')).toHaveClass(
            'element-detail__scene',
        )
        expect(MockImage.instances[0].src).toContain('fire-detail-v3.jpg')
        expect(container.querySelector('.element-detail__image')).toBeNull()

        act(() => MockImage.instances[0].onload?.())

        expect(container.querySelector('.element-detail__image')).not.toBeNull()
        expect(
            container.querySelectorAll('.element-detail__ambient-canvas'),
        ).toHaveLength(1)
        expect(
            container.querySelector('.element-detail__ambient-canvas'),
        ).toHaveAttribute('data-particle-limit', '48')
        expect(screen.getByRole('button', { name: '입찰하기' })).toBeVisible()
        unmount()
        expect(document.body).toHaveClass('existing-shell-class')
        expect(document.body.dataset).toEqual(
            expect.objectContaining({ owner: 'app' }),
        )
        document.body.className = ''
        delete document.body.dataset.owner
    })

    it('미등록 코드와 자산 실패는 중립 배경으로 비차단 처리한다', () => {
        const { container, rerender } = render(
            <ElementDetailBackground element={9}>
                <p>상세 정보</p>
            </ElementDetailBackground>,
        )

        expect(MockImage.instances).toHaveLength(0)
        expect(container.firstElementChild).toHaveAttribute(
            'data-element',
            'neutral',
        )

        rerender(
            <ElementDetailBackground element={3}>
                <p>상세 정보</p>
            </ElementDetailBackground>,
        )
        act(() => MockImage.instances[0].onerror?.())

        expect(container.querySelector('.element-detail__image')).toBeNull()
        expect(screen.getByText('상세 정보')).toBeVisible()
    })

    it('속성이 바뀌면 이전 요청 결과를 무시하고 새 속성만 반영한다', () => {
        const { container, rerender } = render(
            <ElementDetailBackground element={4}>내용</ElementDetailBackground>,
        )
        const staleImage = MockImage.instances[0]

        rerender(
            <ElementDetailBackground element={1}>내용</ElementDetailBackground>,
        )
        act(() => staleImage.onload?.())
        expect(container.querySelector('.element-detail__image')).toBeNull()

        act(() => MockImage.instances[1].onload?.())
        expect(container.querySelector('.element-detail__image')).toHaveStyle({
            backgroundImage:
                'url(/img/backgrounds/item-elements/water-detail-v3.jpg)',
        })
    })

    it('런타임 모션과 visibility 변경에 RAF를 중단하고 정리한다', () => {
        vi.useFakeTimers()
        const media = stubMatchMedia()
        const setTransform = vi.fn()
        const context = {
            beginPath: vi.fn(),
            clearRect: vi.fn(),
            lineTo: vi.fn(),
            moveTo: vi.fn(),
            setTransform,
            stroke: vi.fn(),
            strokeStyle: '',
            lineWidth: 0,
        } as unknown as CanvasRenderingContext2D
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            context,
        )
        const raf = vi.fn(() => 41)
        const cancel = vi.fn()
        vi.stubGlobal('requestAnimationFrame', raf)
        vi.stubGlobal('cancelAnimationFrame', cancel)
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: false,
        })

        const { unmount } = render(
            <ElementDetailBackground element={1}>내용</ElementDetailBackground>,
        )
        act(() => MockImage.instances[0].onload?.())
        expect(raf).toHaveBeenCalledTimes(1)

        media.setMatches('(prefers-reduced-motion: reduce)', true)
        expect(cancel).toHaveBeenCalledWith(41)
        expect(context.clearRect).toHaveBeenCalled()

        media.setMatches('(prefers-reduced-motion: reduce)', false)
        expect(raf).toHaveBeenCalledTimes(2)

        media.setMatches('(forced-colors: active)', true)
        expect(cancel).toHaveBeenCalledWith(41)
        media.setMatches('(forced-colors: active)', false)
        expect(raf).toHaveBeenCalledTimes(3)

        media.setMatches('(pointer: coarse)', true)
        expect(cancel).toHaveBeenCalledWith(41)
        media.setMatches('(pointer: coarse)', false)
        expect(raf).toHaveBeenCalledTimes(4)

        media.setMatches('(update: slow)', true)
        expect(cancel).toHaveBeenCalledWith(41)
        media.setMatches('(update: slow)', false)
        expect(raf).toHaveBeenCalledTimes(5)

        window.dispatchEvent(new Event('resize'))
        window.dispatchEvent(new Event('resize'))
        expect(setTransform).toHaveBeenCalledTimes(1)
        act(() => vi.advanceTimersByTime(120))
        expect(setTransform).toHaveBeenCalledTimes(2)

        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
        expect(cancel).toHaveBeenCalledWith(41)

        window.dispatchEvent(new Event('resize'))
        unmount()
        const callsAfterUnmount = raf.mock.calls.length
        const resizeCallsAfterUnmount = setTransform.mock.calls.length
        act(() => vi.advanceTimersByTime(120))
        media.setMatches('(prefers-reduced-motion: reduce)', false)
        media.setMatches('(pointer: coarse)', true)
        media.setMatches('(pointer: coarse)', false)
        media.setMatches('(update: slow)', true)
        media.setMatches('(update: slow)', false)
        document.dispatchEvent(new Event('visibilitychange'))
        expect(raf).toHaveBeenCalledTimes(callsAfterUnmount)
        expect(setTransform).toHaveBeenCalledTimes(resizeCallsAfterUnmount)
        vi.useRealTimers()
    })

    it.each([
        [4, 'wind', 'quadraticCurveTo'],
        [2, 'fire', 'createRadialGradient'],
        [3, 'earth', 'rotate'],
        [1, 'water', 'ellipse'],
    ] as const)(
        '%s 속성은 %s 고유 Canvas motif를 그린다',
        (code, _name, primitive) => {
            Object.defineProperty(document, 'hidden', {
                configurable: true,
                value: false,
            })
            const callbacks: FrameRequestCallback[] = []
            const gradient = { addColorStop: vi.fn() }
            const context = {
                arc: vi.fn(),
                beginPath: vi.fn(),
                clearRect: vi.fn(),
                closePath: vi.fn(),
                createRadialGradient: vi.fn(() => gradient),
                ellipse: vi.fn(),
                fill: vi.fn(),
                fillStyle: '',
                lineTo: vi.fn(),
                moveTo: vi.fn(),
                quadraticCurveTo: vi.fn(),
                restore: vi.fn(),
                rotate: vi.fn(),
                save: vi.fn(),
                setTransform: vi.fn(),
                stroke: vi.fn(),
                strokeStyle: '',
                translate: vi.fn(),
                lineWidth: 0,
            }
            vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
                context as unknown as CanvasRenderingContext2D,
            )
            vi.stubGlobal(
                'requestAnimationFrame',
                (callback: FrameRequestCallback) => {
                    callbacks.push(callback)
                    return callbacks.length
                },
            )
            vi.stubGlobal('cancelAnimationFrame', vi.fn())

            const view = render(
                <ElementDetailBackground element={code}>
                    효과
                </ElementDetailBackground>,
            )
            act(() => MockImage.instances.at(-1)?.onload?.())
            act(() => callbacks[0]?.(1000))

            expect(context[primitive]).toHaveBeenCalled()
            if (code === 1) {
                expect(context.ellipse.mock.calls.length).toBeGreaterThan(48)
            }
            view.unmount()
        },
    )
})
