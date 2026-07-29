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
 *  1. 필수 3필드(아이디·비밀번호·닉네임)만 서버로 보낸다(email 미입력 시 email 키 생략, 계약 §2·§4.1).
 *  2. email 은 **선택** — 값이 있으면 payload 에 포함하고, @Email 형식 위반은 클라 차단 + 안내(FC-137).
 *  3. 비밀번호 확인 불일치는 클라 차단(서버 미호출) + 안내 문구.
 *  4. AUTH_001(중복 아이디)·AUTH_002(중복 닉네임)를 code 로 구분해 문구 · 원문 미노출.
 *  5. EMAIL_007(중복 이메일, 409)은 **email 필드**에 문구를 표면화한다(FC-136 메시지).
 *  6. 미구현 자리(중복확인·카카오·네이버)는 DOM disabled(미호출).
 */

function fillValid(
    overrides: { passwordConfirm?: string; email?: string } = {},
) {
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
    if (overrides.email !== undefined) {
        fireEvent.change(screen.getByLabelText('이메일 (선택)'), {
            target: { value: overrides.email },
        })
    }
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
    it('email 미입력 시 필수 3필드만 전달한다(email 키 생략)', () => {
        const { onSubmit } = renderForm()
        fillValid()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        // 정확 일치 매처라 email 키가 있으면 실패한다 → 키 생략을 함께 고정한다(null·빈문자 아님).
        expect(onSubmit).toHaveBeenCalledWith({
            loginId: 'player1',
            password: 'secret123',
            nickname: '레온',
        })
    })

    it('email 입력 시 정규화 없이 트림해 email 을 포함해 전달한다', () => {
        const { onSubmit } = renderForm()
        fillValid({ email: '  leon@example.com  ' })
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).toHaveBeenCalledWith({
            loginId: 'player1',
            password: 'secret123',
            nickname: '레온',
            email: 'leon@example.com',
        })
    })

    it('잘못된 이메일 형식은 제출을 차단하고 안내를 낸다', () => {
        const { onSubmit } = renderForm()
        fillValid({ email: 'not-an-email' })
        expect(
            screen.getByText('올바른 이메일 형식이 아닙니다.'),
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('EMAIL_007 은 이메일 필드에 중복 문구를 낸다(원문 미노출)', () => {
        renderForm({
            submitError: new ApiError({
                code: ERROR_CODES.EMAIL_007,
                message: 'email already in use',
                status: 409,
            }),
        })
        expect(
            screen.getByText(
                '이미 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.',
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText(/already in use/)).toBeNull()
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
        expect(screen.getByRole('button', { name: '회원가입' })).toBeDisabled()
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

    it('중복확인 자리는 DOM 비활성이고, 소셜 버튼은 env 미설정 시 비활성이다', () => {
        renderForm()
        expect(screen.getByRole('button', { name: /중복 확인/ })).toBeDisabled()
        // 소셜은 FC-155 로 활성화되나 테스트 env 엔 client_id 가 없어 준비 중(비활성)이다.
        expect(
            screen.getByRole('button', { name: /카카오로 계속하기/ }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /네이버로 계속하기/ }),
        ).toBeDisabled()
    })

    it('로그인 링크를 제공한다', () => {
        renderForm()
        expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
            'href',
            '/login',
        )
    })
})
