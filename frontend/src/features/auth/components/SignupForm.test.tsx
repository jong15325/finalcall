import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { okEnvelope, renderWithProviders } from '@/test/renderWithProviders'
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
 *  6. 아이디·닉네임 중복확인은 모두 **라이브 조회**(입력→버튼→가용성→피드백, FC-167·FC-162).
 *     소셜은 로그인·가입 통합이라 회원가입엔 없다(FC-158).
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

/**
 * 아이디·닉네임 중복확인을 모두 available 로 통과시킨다(FC-169 제출 전제).
 * 호출 전 `fetch` 를 available:true 로 스텁하고 두 필드에 값이 있어야 한다.
 */
async function confirmBothAvailable() {
    fireEvent.click(screen.getByRole('button', { name: '아이디 중복 확인' }))
    await screen.findByText('사용 가능한 아이디입니다.')
    fireEvent.click(screen.getByRole('button', { name: '닉네임 중복 확인' }))
    await screen.findByText('사용 가능한 닉네임입니다.')
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
    it('email 미입력 시 필수 3필드만 전달한다(email 키 생략)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        const { onSubmit } = renderForm()
        fillValid()
        await confirmBothAvailable()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        // 정확 일치 매처라 email 키가 있으면 실패한다 → 키 생략을 함께 고정한다(null·빈문자 아님).
        expect(onSubmit).toHaveBeenCalledWith({
            loginId: 'player1',
            password: 'secret123',
            nickname: '레온',
        })
    })

    it('email 입력 시 정규화 없이 트림해 email 을 포함해 전달한다', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        const { onSubmit } = renderForm()
        fillValid({ email: '  leon@example.com  ' })
        await confirmBothAvailable()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).toHaveBeenCalledWith({
            loginId: 'player1',
            password: 'secret123',
            nickname: '레온',
            email: 'leon@example.com',
        })
    })

    it('중복확인 없이 제출하면 차단하고 아이디·닉네임 안내 문구를 낸다(FC-169)', () => {
        const { onSubmit } = renderForm()
        fillValid()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).not.toHaveBeenCalled()
        expect(
            screen.getByText('아이디 중복확인을 진행해 주세요.'),
        ).toBeInTheDocument()
        expect(
            screen.getByText('닉네임 중복확인을 진행해 주세요.'),
        ).toBeInTheDocument()
    })

    it('아이디·닉네임 모두 available 확인 후에는 제출이 통과한다(FC-169)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        const { onSubmit } = renderForm()
        fillValid()
        await confirmBothAvailable()
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).toHaveBeenCalledWith({
            loginId: 'player1',
            password: 'secret123',
            nickname: '레온',
        })
    })

    it('확인 후 아이디 값을 바꾸면 다시 제출이 차단된다(재확인 강제, FC-169)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        const { onSubmit } = renderForm()
        fillValid()
        await confirmBothAvailable()
        // 확인 후 아이디를 바꾸면 상태가 idle 로 초기화된다.
        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'player2' },
        })
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).not.toHaveBeenCalled()
        expect(
            screen.getByText('아이디 중복확인을 진행해 주세요.'),
        ).toBeInTheDocument()
    })

    it('조회 in-flight 중 아이디를 바꾸면 stale 응답을 버리고 제출을 차단한다(M1 경합)', async () => {
        // 아이디 조회는 응답을 지연(deferred)시키고, 닉네임 조회는 즉시 available 로 답한다.
        let resolveLoginId!: (value: Response) => void
        const loginIdPending = new Promise<Response>((resolve) => {
            resolveLoginId = resolve
        })
        vi.stubGlobal(
            'fetch',
            vi.fn((input: RequestInfo | URL) =>
                String(input).includes('login-id')
                    ? loginIdPending
                    : Promise.resolve(okEnvelope({ available: true })),
            ),
        )
        const { onSubmit } = renderForm()
        fillValid() // 아이디 player1, 닉네임 레온

        // player1 로 조회를 시작(in-flight) → 응답 도착 전 admin 으로 변경(상태 idle).
        fireEvent.click(screen.getByRole('button', { name: '아이디 중복 확인' }))
        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'admin' },
        })

        // 이제 player1 응답(available)이 도착 — stale 이라 반영되면 안 된다.
        await act(async () => {
            resolveLoginId(okEnvelope({ available: true }))
        })

        // 닉네임은 정상 확인해 유일한 미충족이 아이디임을 못박는다.
        fireEvent.click(screen.getByRole('button', { name: '닉네임 중복 확인' }))
        await screen.findByText('사용 가능한 닉네임입니다.')

        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        // stale 응답이 무시됐다면 아이디는 여전히 미확인(idle) → 제출 차단 + 안내 문구.
        expect(onSubmit).not.toHaveBeenCalled()
        expect(
            screen.getByText('아이디 중복확인을 진행해 주세요.'),
        ).toBeInTheDocument()
        expect(screen.queryByText('사용 가능한 아이디입니다.')).toBeNull()
    })

    it('아이디가 taken 이면(닉네임 available 이어도) 제출이 차단된다(FC-169)', async () => {
        // 아이디 조회는 taken(available:false), 닉네임 조회는 available:true 로 분기한다.
        vi.stubGlobal(
            'fetch',
            vi.fn((input: RequestInfo | URL) =>
                Promise.resolve(
                    okEnvelope({
                        available: !String(input).includes('login-id'),
                    }),
                ),
            ),
        )
        const { onSubmit } = renderForm()
        fillValid()
        fireEvent.click(screen.getByRole('button', { name: '아이디 중복 확인' }))
        await screen.findByText('이미 사용 중인 아이디입니다.')
        fireEvent.click(screen.getByRole('button', { name: '닉네임 중복 확인' }))
        await screen.findByText('사용 가능한 닉네임입니다.')
        fireEvent.click(screen.getByRole('button', { name: '회원가입' }))
        expect(onSubmit).not.toHaveBeenCalled()
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

    it('아이디 미입력이면 아이디 중복 확인 버튼이 비활성이다', () => {
        renderForm()
        expect(
            screen.getByRole('button', { name: '아이디 중복 확인' }),
        ).toBeDisabled()
    })

    it('닉네임 미입력이면 닉네임 중복 확인 버튼이 비활성이다', () => {
        renderForm()
        expect(
            screen.getByRole('button', { name: '닉네임 중복 확인' }),
        ).toBeDisabled()
    })

    it('아이디 중복 확인 → 사용 가능 피드백을 낸다', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'player1' },
        })
        fireEvent.click(screen.getByRole('button', { name: '아이디 중복 확인' }))
        expect(
            await screen.findByText('사용 가능한 아이디입니다.'),
        ).toBeInTheDocument()
    })

    it('아이디 중복 확인 → 사용 중이면 중복 피드백을 낸다', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: false }))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'player1' },
        })
        fireEvent.click(screen.getByRole('button', { name: '아이디 중복 확인' }))
        expect(
            await screen.findByText('이미 사용 중인 아이디입니다.'),
        ).toBeInTheDocument()
    })

    it('아이디를 바꾸면 직전 확인 결과가 초기화된다(재확인 유도)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'player1' },
        })
        fireEvent.click(screen.getByRole('button', { name: '아이디 중복 확인' }))
        await screen.findByText('사용 가능한 아이디입니다.')

        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'player2' },
        })
        await waitFor(() =>
            expect(screen.queryByText('사용 가능한 아이디입니다.')).toBeNull(),
        )
    })

    it('아이디 중복 확인 실패(400·네트워크)는 재시도 안내로 수렴한다(원문 미노출)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.reject(new Error('boom'))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('아이디'), {
            target: { value: 'player1' },
        })
        fireEvent.click(screen.getByRole('button', { name: '아이디 중복 확인' }))
        expect(
            await screen.findByText(
                '확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText(/boom/)).toBeNull()
    })

    it('닉네임 중복 확인 → 사용 가능 피드백을 낸다', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('닉네임'), {
            target: { value: '레온' },
        })
        fireEvent.click(screen.getByRole('button', { name: '닉네임 중복 확인' }))
        expect(
            await screen.findByText('사용 가능한 닉네임입니다.'),
        ).toBeInTheDocument()
    })

    it('닉네임 중복 확인 → 사용 중이면 중복 피드백을 낸다', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: false }))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('닉네임'), {
            target: { value: '레온' },
        })
        fireEvent.click(screen.getByRole('button', { name: '닉네임 중복 확인' }))
        expect(
            await screen.findByText('이미 사용 중인 닉네임입니다.'),
        ).toBeInTheDocument()
    })

    it('닉네임을 바꾸면 직전 확인 결과가 초기화된다(재확인 유도)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.resolve(okEnvelope({ available: true }))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('닉네임'), {
            target: { value: '레온' },
        })
        fireEvent.click(screen.getByRole('button', { name: '닉네임 중복 확인' }))
        await screen.findByText('사용 가능한 닉네임입니다.')

        fireEvent.change(screen.getByLabelText('닉네임'), {
            target: { value: '레온2' },
        })
        await waitFor(() =>
            expect(screen.queryByText('사용 가능한 닉네임입니다.')).toBeNull(),
        )
    })

    it('닉네임 중복 확인 실패(400·네트워크)는 재시도 안내로 수렴한다(원문 미노출)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.reject(new Error('boom'))),
        )
        renderForm()
        fireEvent.change(screen.getByLabelText('닉네임'), {
            target: { value: '레온' },
        })
        fireEvent.click(screen.getByRole('button', { name: '닉네임 중복 확인' }))
        expect(
            await screen.findByText(
                '확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            ),
        ).toBeInTheDocument()
        expect(screen.queryByText(/boom/)).toBeNull()
    })

    it('소셜 버튼을 렌더하지 않는다(로그인·가입 통합이라 회원가입엔 잉여, FC-158)', () => {
        renderForm()
        expect(
            screen.queryByRole('button', { name: /카카오로 계속하기/ }),
        ).toBeNull()
        expect(
            screen.queryByRole('button', { name: /네이버로 계속하기/ }),
        ).toBeNull()
    })

    it('로그인 링크를 제공한다', () => {
        renderForm()
        expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
            'href',
            '/login',
        )
    })
})
