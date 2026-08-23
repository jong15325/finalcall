import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ProfileCard from './ProfileCard'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import type { MeResponse } from '@/lib/api/auth'

/**
 * 프로필 카드 (FC-074) — 계약 4필드 표시 + 닉네임 인라인 수정.
 *
 * 고정하는 것:
 *  1. 프로필 표시 — nickname·가입일·관리자 배지(isAdmin 표시 제어), 드롭 장식 미렌더.
 *  2. 닉네임 수정 — 트리밍 후 onSaveNickname, 변경 없음/빈 값은 서버 미호출.
 *  3. 서버 에러 code 매핑(MEMBER_001) — 원문 미노출.
 *  4. 저장 성공(pending→idle) 시 편집기 닫힘.
 */

const profile: MeResponse = {
    userPublicId: 'U-1',
    nickname: '모험가레온',
    primaryCharacterId: 1,
    isAdmin: false,
    createdAt: '2025-11-04T09:00:00Z',
    emailVerified: false,
    emailMasked: null,
}

function renderCard(
    props: Partial<React.ComponentProps<typeof ProfileCard>> = {},
) {
    const onSaveNickname = props.onSaveNickname ?? vi.fn()
    const result = render(
        <MemoryRouter>
            <ProfileCard
                profile={props.profile ?? profile}
                savePending={props.savePending ?? false}
                saveError={props.saveError ?? null}
                characterSavePending={props.characterSavePending ?? false}
                characterSaveError={props.characterSaveError ?? null}
                onSaveCharacter={props.onSaveCharacter}
                onSaveNickname={onSaveNickname}
            />
        </MemoryRouter>,
    )
    return { onSaveNickname, ...result }
}

describe('<ProfileCard>', () => {
    it('큰 프로필 이미지 버튼으로 선택판을 열고 닫는다', () => {
        renderCard()
        const trigger = screen.getByRole('button', { name: '기본 캐릭터 변경' })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        expect(trigger).toHaveClass('rounded-2xl')
        expect(
            screen.queryByRole('region', { name: '기본 캐릭터 선택' }),
        ).not.toBeInTheDocument()

        fireEvent.click(trigger)
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(
            screen.getByRole('region', { name: '기본 캐릭터 선택' }),
        ).toHaveClass('fixed', 'character-overlay')
    })

    it('390px, 640px, 1280px에서 overlay 셀과 profile trigger 크기를 동일하게 배치한다', () => {
        renderCard()
        const trigger = screen.getByRole('button', { name: '기본 캐릭터 변경' })
        const triggerRect = vi
            .spyOn(trigger, 'getBoundingClientRect')
            .mockReturnValue({
                left: 44,
                right: 124,
                top: 100,
                bottom: 180,
                width: 80,
                height: 80,
                x: 44,
                y: 100,
                toJSON: () => ({}),
            })
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 390,
        })
        fireEvent.click(trigger)
        let overlay = screen.getByRole('region', { name: '기본 캐릭터 선택' })
        expect(overlay).toHaveStyle({ left: '44px', width: '320px' })
        expect(overlay).not.toHaveClass(
            'border',
            'bg-content-surface',
            'shadow-lg',
        )
        expect(44 + 320).toBeLessThanOrEqual(390)
        expect(320 / 4).toBe(80)
        expect(
            screen.getAllByRole('button', { name: /캐릭터 \d+ 선택/ }),
        ).toHaveLength(16)
        expect(overlay.querySelector('[data-character-roster]')).toHaveClass(
            'grid',
            'grid-cols-4',
            'gap-2',
        )
        expect(
            screen.getByRole('button', { name: '캐릭터 1 선택' }),
        ).toHaveClass('aspect-square', 'w-full')

        triggerRect.mockReturnValue({
            left: 44,
            right: 140,
            top: 100,
            bottom: 196,
            width: 96,
            height: 96,
            x: 44,
            y: 100,
            toJSON: () => ({}),
        })
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 640,
        })
        fireEvent.resize(window)
        overlay = screen.getByRole('region', { name: '기본 캐릭터 선택' })
        expect(overlay).toHaveStyle({
            left: '44px',
            top: '197px',
            width: '384px',
        })
        expect(384 / 4).toBe(96)
        expect(overlay.querySelector('[data-character-roster]')).toHaveClass(
            'gap-2',
        )

        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 1024,
        })
        fireEvent.resize(window)
        overlay = screen.getByRole('region', { name: '기본 캐릭터 선택' })
        expect(overlay).toHaveStyle({
            left: '44px',
            top: '197px',
            width: '384px',
        })
        expect(overlay.querySelector('[data-character-roster]')).toHaveClass(
            'grid-cols-4',
            'xl:grid-cols-8',
        )

        triggerRect.mockReturnValue({
            left: 168,
            right: 280,
            top: 100,
            bottom: 212,
            width: 112,
            height: 112,
            x: 168,
            y: 100,
            toJSON: () => ({}),
        })
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 1280,
        })
        fireEvent.resize(window)
        overlay = screen.getByRole('region', { name: '기본 캐릭터 선택' })
        expect(overlay).toHaveStyle({ left: '280px', width: '896px' })
        expect(280 + 896).toBeLessThanOrEqual(1280)
        expect(896 / 8).toBe(112)
        expect(
            screen.getAllByRole('button', { name: /캐릭터 \d+ 선택/ }),
        ).toHaveLength(16)
        expect(overlay.querySelector('[data-character-roster]')).toHaveClass(
            'xl:grid-cols-8',
        )
    })

    it('하단과 상단 trigger에서 overlay 세로 위치를 viewport 안으로 clamp한다', () => {
        const rectSpy = vi
            .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockImplementation(function (this: HTMLElement) {
                const height = this.hasAttribute('data-character-overlay')
                    ? 300
                    : 0
                return {
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: height,
                    width: 0,
                    height,
                    x: 0,
                    y: 0,
                    toJSON: () => ({}),
                }
            })
        renderCard()
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 390,
        })
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 844,
        })
        const trigger = screen.getByRole('button', {
            name: '기본 캐릭터 변경',
        })
        const triggerRect = vi.spyOn(trigger, 'getBoundingClientRect')
        triggerRect.mockReturnValue({
            left: 44,
            right: 124,
            top: 700,
            bottom: 780,
            width: 80,
            height: 80,
            x: 44,
            y: 700,
            toJSON: () => ({}),
        })

        fireEvent.click(trigger)
        let overlay = screen.getByRole('region', {
            name: '기본 캐릭터 선택',
        })
        expect(overlay).toHaveStyle({ top: '536px' })
        expect(overlay).toHaveClass(
            'max-h-[calc(100dvh-1rem)]',
            'overflow-y-auto',
        )

        fireEvent.keyDown(document, { key: 'Escape' })
        triggerRect.mockReturnValue({
            left: 44,
            right: 124,
            top: -20,
            bottom: 60,
            width: 80,
            height: 80,
            x: 44,
            y: -20,
            toJSON: () => ({}),
        })
        fireEvent.click(trigger)
        overlay = screen.getByRole('region', { name: '기본 캐릭터 선택' })
        expect(overlay).toHaveStyle({ top: '61px' })
        rectSpy.mockRestore()
    })

    it('overlay 높이 변화 시 ResizeObserver로 하단 위치를 다시 clamp한다', () => {
        let overlayHeight = 220
        let observerCallback: ResizeObserverCallback = () => undefined
        const disconnect = vi.fn()
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: ResizeObserverCallback) {
                    observerCallback = callback
                }
                observe() {}
                disconnect() {
                    disconnect()
                }
            },
        )
        const rectSpy = vi
            .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockImplementation(function (this: HTMLElement) {
                const height = this.hasAttribute('data-character-overlay')
                    ? overlayHeight
                    : 0
                return {
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: height,
                    width: 0,
                    height,
                    x: 0,
                    y: 0,
                    toJSON: () => ({}),
                }
            })
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 390,
        })
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 844,
        })
        const { unmount } = renderCard()
        const trigger = screen.getByRole('button', {
            name: '기본 캐릭터 변경',
        })
        vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
            left: 44,
            right: 124,
            top: 700,
            bottom: 780,
            width: 80,
            height: 80,
            x: 44,
            y: 700,
            toJSON: () => ({}),
        })
        fireEvent.click(trigger)
        const overlay = screen.getByRole('region', {
            name: '기본 캐릭터 선택',
        })
        expect(overlay).toHaveStyle({ top: '616px' })

        overlayHeight = 260
        act(() => observerCallback([], {} as ResizeObserver))
        expect(overlay).toHaveStyle({ top: '576px' })
        expect(576 + 260).toBeLessThanOrEqual(844 - 8)

        unmount()
        expect(disconnect).toHaveBeenCalled()
        rectSpy.mockRestore()
        vi.unstubAllGlobals()
    })

    it('선택 1회로 preview하고 즉시 저장한다', () => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 1280,
        })
        renderCard()
        fireEvent.click(
            screen.getByRole('button', { name: '기본 캐릭터 변경' }),
        )
        fireEvent.click(screen.getByRole('button', { name: '캐릭터 25 선택' }))
        expect(screen.getByAltText('모험가레온 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_13_avatar.png',
        )
        expect(
            screen.queryByRole('button', { name: '저장' }),
        ).not.toBeInTheDocument()
    })

    it('Escape와 외부 클릭으로 overlay를 닫고 draft를 복원한다', () => {
        renderCard()
        const trigger = screen.getByRole('button', { name: '기본 캐릭터 변경' })
        fireEvent.click(trigger)
        fireEvent.click(screen.getByRole('button', { name: '캐릭터 2 선택' }))
        screen.getByRole('button', { name: '캐릭터 2 선택' }).focus()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        expect(trigger).toHaveFocus()
        expect(screen.getByAltText('모험가레온 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_01_xyrho.png',
        )

        fireEvent.click(trigger)
        fireEvent.pointerDown(document.body)
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    it('저장 성공에는 닫고 오류에는 열린 상태를 유지한다', () => {
        const onSaveCharacter = vi.fn()
        const { rerender } = renderCard({ onSaveCharacter })
        fireEvent.click(
            screen.getByRole('button', { name: '기본 캐릭터 변경' }),
        )
        fireEvent.click(screen.getByRole('button', { name: '캐릭터 2 선택' }))
        expect(onSaveCharacter).toHaveBeenCalledWith(2)

        const view = (pending: boolean, error: unknown) =>
            rerender(
                <MemoryRouter>
                    <ProfileCard
                        profile={profile}
                        savePending={false}
                        saveError={null}
                        characterSavePending={pending}
                        characterSaveError={error}
                        onSaveCharacter={onSaveCharacter}
                        onSaveNickname={vi.fn()}
                    />
                </MemoryRouter>,
            )
        view(true, null)
        expect(
            screen.getByRole('button', { name: '캐릭터 3 선택' }),
        ).toBeDisabled()
        view(false, new Error('failed'))
        expect(
            screen.getByRole('button', { name: '기본 캐릭터 변경' }),
        ).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('alert')).toHaveFocus()
        view(true, null)
        view(false, null)
        expect(
            screen.getByRole('button', { name: '기본 캐릭터 변경' }),
        ).toHaveAttribute('aria-expanded', 'false')
        expect(
            screen.getByRole('button', { name: '기본 캐릭터 변경' }),
        ).toHaveFocus()
    })

    it('현재 선택 캐릭터 클릭은 요청 없이 선택판만 닫는다', () => {
        const onSaveCharacter = vi.fn()
        renderCard({ onSaveCharacter })
        const trigger = screen.getByRole('button', { name: '기본 캐릭터 변경' })
        fireEvent.click(trigger)
        fireEvent.click(screen.getByRole('button', { name: '캐릭터 1 선택' }))
        expect(onSaveCharacter).not.toHaveBeenCalled()
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
        expect(trigger).toHaveFocus()
    })
    it('닉네임·가입일을 표시하고 인벤토리·임시보관 링크를 건다', () => {
        renderCard()
        expect(screen.getByText('모험가레온')).toBeInTheDocument()
        expect(screen.getByText('2025년 11월 4일 가입')).toBeInTheDocument()

        const inventory = screen.getByRole('link', { name: /인벤토리/ })
        const storage = screen.getByRole('link', { name: /임시 보관함/ })
        expect(inventory).toHaveAttribute('href', '/me/inventory')
        expect(storage).toHaveAttribute('href', '/me/temp-storage')
    })

    it('isAdmin=false 면 관리자 배지를 렌더하지 않는다', () => {
        renderCard()
        expect(screen.queryByText('관리자')).toBeNull()
    })

    it('isAdmin=true 면 관리자 배지를 렌더한다(표시 제어)', () => {
        renderCard({ profile: { ...profile, isAdmin: true } })
        expect(screen.getByText('관리자')).toBeInTheDocument()
    })

    it('★ 계약에 없는 목업 장식(레벨·서버·거래건수)은 렌더하지 않는다', () => {
        renderCard()
        expect(screen.queryByText(/레벨/)).toBeNull()
        expect(screen.queryByText(/서버/)).toBeNull()
        expect(screen.queryByText(/거래 \d+건/)).toBeNull()
    })

    it('닉네임 수정 → 트리밍한 값으로 onSaveNickname 을 부른다', () => {
        const { onSaveNickname } = renderCard()
        fireEvent.click(screen.getByRole('button', { name: '닉네임 수정' }))

        const input = screen.getByLabelText('닉네임') as HTMLInputElement
        fireEvent.change(input, { target: { value: '  새닉네임  ' } })
        fireEvent.click(screen.getByRole('button', { name: '저장' }))

        expect(onSaveNickname).toHaveBeenCalledWith('새닉네임')
    })

    it('빈 닉네임 저장은 클라 검증에서 막히고 서버를 부르지 않는다', () => {
        const { onSaveNickname } = renderCard()
        fireEvent.click(screen.getByRole('button', { name: '닉네임 수정' }))

        const input = screen.getByLabelText('닉네임') as HTMLInputElement
        fireEvent.change(input, { target: { value: '   ' } })
        fireEvent.click(screen.getByRole('button', { name: '저장' }))

        expect(onSaveNickname).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent('닉네임을 입력')
        expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('변경 없는 닉네임 저장은 서버를 부르지 않고 편집기를 닫는다', () => {
        const { onSaveNickname } = renderCard()
        fireEvent.click(screen.getByRole('button', { name: '닉네임 수정' }))
        fireEvent.click(screen.getByRole('button', { name: '저장' }))

        expect(onSaveNickname).not.toHaveBeenCalled()
        // 편집기가 닫혀 표시 상태로 복귀.
        expect(
            screen.getByRole('button', { name: '닉네임 수정' }),
        ).toBeInTheDocument()
    })

    it('★ 서버 MEMBER_001(닉네임 중복)은 code 로 문구를 내고 원문을 노출하지 않는다', () => {
        const error = new ApiError({
            code: ERROR_CODES.MEMBER_001,
            message: 'raw duplicate nickname',
            status: 409,
        })
        renderCard({ saveError: error })
        // 편집기를 열어야 에러 문구가 보인다.
        fireEvent.click(screen.getByRole('button', { name: '닉네임 수정' }))
        expect(screen.getByRole('alert')).toHaveTextContent('이미 사용 중인')
        expect(screen.queryByText('raw duplicate nickname')).toBeNull()
    })

    it('저장 성공(pending→idle)에 편집기를 닫는다', () => {
        const { rerender } = renderCard()
        fireEvent.click(screen.getByRole('button', { name: '닉네임 수정' }))
        expect(screen.getByLabelText('닉네임')).toBeInTheDocument()

        const rerenderWith = (savePending: boolean) =>
            rerender(
                <MemoryRouter>
                    <ProfileCard
                        profile={profile}
                        savePending={savePending}
                        saveError={null}
                        onSaveNickname={vi.fn()}
                    />
                </MemoryRouter>,
            )

        rerenderWith(true) // 저장 진행
        rerenderWith(false) // 성공 전이

        expect(screen.queryByLabelText('닉네임')).toBeNull()
        expect(screen.getByText('모험가레온')).toBeInTheDocument()
    })
})
