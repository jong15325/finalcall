import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import SignupForm from './SignupForm'
import { ApiError } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'

/**
 * 회원가입 폼 (FC-078) — design-brief B-6.
 *
 * 고정하는 것:
 *  1. 3필드(아이디·비밀번호·닉네임)만 서버로 보낸다(계약 §2, 비번확인 일치 시).
 *  2. 비밀번호 확인 불일치는 클라 차단(서버 미호출) + 안내 문구.
 *  3. AUTH_001(중복 아이디)·AUTH_002(중복 닉네임)를 code 로 구분해 문구 · 원문 미노출.
 *  4. 미구현 자리(중복확인·인증요청·카카오·네이버)는 DOM disabled(미호출).
 */

function fillValid(overrides: { passwordConfirm?: string } = {}) {
    fireEvent.change(screen.getByLabelText('아이디'), {
        target: { value: 'player1' },
    })
    fireEvent.change(screen.getByLabelText('비밀번호'), {
        target: { value: 'secret123' },
    })
    fireEvent.change(screen.getByLabelText('비밀번호 확인'), {
        target: { value: overrides.passwordConfirm ?? 'secret123' },
    })
    fireEvent.change(screen.getByLabelText('닉네임'), {
        target: { value: '레온' },
    })
}

function renderForm(
    props: Partial<React.ComponentProps<typeof SignupForm>> = {},
) {
    const onSubmit = props.onSubmit ?? vi.fn()
    renderWithProviders(
        <SignupForm
            isSubmitting={props.isSubmitting ?? false}
            submitError={props.submitError ?? null}
            onSubmit={onSubmit}
        />,
    )
    return { onSubmit }
}

describe('<SignupForm>', () => {
    it('비번 일치 시 3필드만 onSubmit 으로 전달한다', () => {
        const { onSubmit } = renderForm()
        fillValid()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).toHaveBeenCalledWith({
            loginId: 'player1',
            password: 'secret123',
            nickname: '레온',
        })
    })

    it('비밀번호 확인 불일치는 서버를 부르지 않고 안내 문구를 낸다', () => {
        const { onSubmit } = renderForm()
        fillValid({ passwordConfirm: 'different' })
        expect(
            screen.getByText('비밀번호가 일치하지 않습니다.'),
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('필수 항목이 비면 제출 버튼이 비활성이다', () => {
        renderForm()
        expect(
            screen.getByRole('button', { name: '회원가입' }),
        ).toBeDisabled()
    })

    it('AUTH_001 은 중복 아이디 문구를 낸다(원문 미노출)', () => {
        renderForm({
            submitError: new ApiError({
                code: ERROR_CODES.AUTH_001,
                message: 'loginId player1 already exists',
                status: 409,
            }),
        })
        expect(
            screen.getByText(
                '이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.',
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText(/already exists/)).toBeNull()
    })

    it('AUTH_002 는 중복 닉네임 문구를 낸다', () => {
        renderForm({
            submitError: new ApiError({
                code: ERROR_CODES.AUTH_002,
                message: 'nickname taken',
                status: 409,
            }),
        })
        expect(
            screen.getByText(
                '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.',
            ),
        ).toBeInTheDocument()
    })

    it('미구현 자리(중복확인·인증요청·소셜)는 DOM 비활성이다', () => {
        renderForm()
        expect(
            screen.getByRole('button', { name: /중복 확인/ }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /인증 요청/ }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /카카오로 가입/ }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /네이버로 가입/ }),
        ).toBeDisabled()
    })

    it('로그인 링크를 제공한다', () => {
        renderForm()
        expect(
            screen.getByRole('link', { name: '로그인' }),
        ).toHaveAttribute('href', '/login')
    })
})
