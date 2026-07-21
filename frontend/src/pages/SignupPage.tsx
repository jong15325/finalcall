import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import useAuth from '@/auth/useAuth'
import SignupForm from '@/features/auth/components/SignupForm'
import { paths } from '@/app/paths'
import type { SignupRequest } from '@/lib/api/auth'

/**
 * 회원가입 `/signup` (FC-078 — design-brief B-6).
 *
 * ★ 계약 §2 — 가입 응답에 **토큰이 없다**(자동 로그인 없음). 성공하면 로그인 화면으로 보내고,
 *   방금 만든 아이디를 state 로 넘겨 자동 채움한다(선택 편의).
 * ★ 실패는 `mutation.error`(ApiError)로 폼에 넘겨 `AUTH_001`(중복 아이디)·`AUTH_002`(중복 닉네임)를
 *   `code` 로 구분해 문구를 낸다.
 */
export default function SignupPage() {
    const { signUp } = useAuth()
    const navigate = useNavigate()

    const mutation = useMutation<void, Error, SignupRequest>({
        mutationFn: signUp,
        onSuccess: (_data, variables) => {
            navigate(paths.login, {
                replace: true,
                state: { signupSuccess: true, loginId: variables.loginId },
            })
        },
    })

    return (
        <SignupForm
            isSubmitting={mutation.isPending}
            submitError={mutation.error}
            onSubmit={(credential) => mutation.mutate(credential)}
        />
    )
}
