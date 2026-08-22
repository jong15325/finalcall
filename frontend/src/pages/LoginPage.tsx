import { useLocation } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import useAuth from '@/auth/useAuth'
import LoginForm from '@/features/auth/components/LoginForm'
import type { LoginRequest } from '@/lib/api/auth'

/**
 * 로그인 `/login` (FC-078 — design-brief B-5).
 *
 * ★ 성공 후 이동은 **선언적**이다 — `signIn` 이 세션을 세우면 `authenticated` 가 true 가 되고,
 *   이 화면을 감싼 `PublicRoute` 가 `?redirectUrl`(정화됨) 또는 홈으로 되돌린다. 여기서 직접
 *   `navigate` 하지 않는다(AuthProvider 주석 — 상태와 화면 이동을 한 곳에 엉키지 않게).
 * ★ 실패는 `mutation.error`(ApiError)로 폼에 넘겨 `code` 로 문구를 낸다(SEC-007 단일 문구).
 */
interface SignupHandoffState {
    signupSuccess?: boolean
    loginId?: string
}

export default function LoginPage() {
    const { signIn } = useAuth()
    const location = useLocation()
    const handoff = (location.state as SignupHandoffState | null) ?? {}

    const mutation = useMutation<void, Error, LoginRequest>({
        mutationFn: signIn,
    })

    return (
        <div>
            {handoff.signupSuccess && (
                <p
                    role="status"
                    className="auth-status mb-5 rounded-xl border border-success/40 px-4 py-3 text-xs font-semibold text-success-ink"
                >
                    회원가입이 완료되었습니다. 로그인해 주세요.
                </p>
            )}
            <LoginForm
                isSubmitting={mutation.isPending}
                submitError={mutation.error}
                initialLoginId={handoff.loginId ?? ''}
                onSubmit={(credential) => mutation.mutate(credential)}
            />
        </div>
    )
}
