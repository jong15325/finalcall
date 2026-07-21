import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
    isAdmin: false,
    createdAt: '2025-11-04T09:00:00Z',
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
                onSaveNickname={onSaveNickname}
            />
        </MemoryRouter>,
    )
    return { onSaveNickname, ...result }
}

describe('<ProfileCard>', () => {
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
