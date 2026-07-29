import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import LoginForm from './LoginForm'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 로그인 폼 (FC-078) — design-brief B-5.
 *
 * 고정하는 것:
 *  1. 아이디·비밀번호 입력 → onSubmit(자격)으로 서버 호출.
 *  2. 빈 값이면 제출 버튼 DOM disabled + 서버 미호출.
 *  3. AUTH_003 은 단일 문구(아이디/비밀번호 구분 없음, SEC-007) · 서버 원문 미노출.
 *  4. 회원가입 링크 존재.
 */

function renderForm(
    props: Partial<React.ComponentProps<typeof LoginForm>> = {},
) {
    const onSubmit = props.onSubmit ?? vi.fn()
    renderWithProviders(
        <LoginForm
            isSubmitting={props.isSubmitting ?? false}
            submitError={props.submitError ?? null}
            initialLoginId={props.initialLoginId}
            onSubmit={onSubmit}
        />,
    )
    return { onSubmit }
}

describe('<LoginForm>', () => {
    it('아이디·비밀번호 입력 시 onSubmit 으로 자격을 전달한다', () => {
        const { onSubmit } = renderForm()
        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'player1' },
        })
        fireEvent.change(screen.getByLabelText('비밀번호'), {
            target: { value: 'secret123' },
        })
        fireEvent.click(screen.getByRole('button', { name: '로그인' }))
        expect(onSubmit).toHaveBeenCalledWith({
            loginId: 'player1',
            password: 'secret123',
        })
    })

    it('빈 값이면 제출 버튼이 비활성이고 서버를 부르지 않는다', () => {
        const { onSubmit } = renderForm()
        expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: '로그인' }))
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('AUTH_003 은 아이디/비밀번호 구분 없는 단일 문구를 낸다(원문 미노출)', () => {
        renderForm({
            submitError: new ApiError({
                code: ERROR_CODES.AUTH_003,
                message: 'invalid password for user player1',
                status: 401,
            }),
        })
        expect(
            screen.getByText('아이디 또는 비밀번호가 올바르지 않습니다.'),
        ).toBeInTheDocument()
        expect(
            screen.queryByText(/invalid password for user/),
        ).toBeNull()
    })

    it('초기 아이디를 자동 채움한다(회원가입 직후)', () => {
        renderForm({ initialLoginId: 'newbie' })
        expect(screen.getByLabelText('아이디')).toHaveValue('newbie')
    })

    it('회원가입 링크를 제공한다', () => {
        renderForm()
        expect(
            screen.getByRole('link', { name: '회원가입' }),
        ).toHaveAttribute('href', '/signup')
    })

    it('소셜 로그인 버튼을 노출한다(FC-155 — 목업 누락분 보강)', () => {
        renderForm()
        expect(
            screen.getByRole('button', { name: /카카오로 계속하기/ }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /네이버로 계속하기/ }),
        ).toBeInTheDocument()
    })
})
