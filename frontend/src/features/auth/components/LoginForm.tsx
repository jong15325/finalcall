import { useState } from 'react'
import { Link } from 'react-router'
import { TbLock, TbUser } from 'react-icons/tb'
import AuthTextField from './AuthTextField'
import SocialLoginSection from './SocialLoginSection'
import {
    demoLoginErrorMessage,
    loginErrorMessage,
} from '@/features/auth/lib/authErrors'
import { paths } from '@/app/paths'

/**
 * 로그인 폼 (FC-078 — 목업 `login()` `.modern-auth-card` · design-brief B-5).
 *
 * ★ 구조는 목업 1:1(브랜드는 AuthLayout 이 얹는다), 색은 브랜드 토큰(rebuild §2.9).
 * ★ 실패는 **단일 문구**만 낸다 — `AUTH_003`(401) 은 아이디/비밀번호 중 무엇이 틀렸는지
 *   구분해 주지 않는다(회원 열거 방지 SEC-007). 필드 단위로 되살리지 않는다.
 * ★ `<form noValidate>` — 브라우저 말풍선과 커스텀 검증 이중 표시 방지. 제출 버튼 비활성은
 *   **DOM `disabled`**(색만 X, WCAG 4.1.2).
 */

interface LoginFormProps {
    isSubmitting: boolean
    /** 마지막 로그인 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    /** 회원가입 직후 아이디 자동 채움(선택) */
    initialLoginId?: string
    onSubmit: (credential: { loginId: string; password: string }) => void
    isDemoSubmitting?: boolean
    demoSubmitError?: unknown
    onDemoSubmit?: () => void
}

export default function LoginForm({
    isSubmitting,
    submitError,
    initialLoginId = '',
    onSubmit,
    isDemoSubmitting = false,
    demoSubmitError = null,
    onDemoSubmit = () => undefined,
}: LoginFormProps) {
    const [loginId, setLoginId] = useState(initialLoginId)
    const [password, setPassword] = useState('')

    const canSubmit =
        loginId.trim().length > 0 && password.length > 0 && !isSubmitting
    const errorMessage =
        submitError != null ? loginErrorMessage(submitError) : null

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        onSubmit({ loginId: loginId.trim(), password })
    }

    return (
        <div className="auth-form mx-auto w-full max-w-md">
            <p className="auth-eyebrow">WELCOME BACK</p>
            <h1 className="auth-copy-strong mt-2 text-3xl font-black tracking-tight">
                로그인
            </h1>
            <p className="auth-copy-muted mt-2 text-sm">
                계정에 로그인하고 거래를 계속하세요.
            </p>

            <form
                noValidate
                className="mt-8 flex flex-col gap-4"
                onSubmit={handleSubmit}
            >
                <AuthTextField
                    id="loginId"
                    label="아이디"
                    icon={<TbUser />}
                    value={loginId}
                    autoComplete="username"
                    placeholder="아이디를 입력하세요"
                    invalid={errorMessage != null}
                    describedById={errorMessage ? 'loginError' : undefined}
                    onChange={setLoginId}
                />
                <AuthTextField
                    id="loginPassword"
                    label="비밀번호"
                    type="password"
                    icon={<TbLock />}
                    value={password}
                    autoComplete="current-password"
                    placeholder="비밀번호를 입력하세요"
                    invalid={errorMessage != null}
                    describedById={errorMessage ? 'loginError' : undefined}
                    onChange={setPassword}
                />

                {errorMessage && (
                    <p id="loginError" role="alert" className="text-sm text-danger-ink">
                        {errorMessage}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="auth-primary-action mt-2 h-12 rounded-xl px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSubmitting ? '로그인 중…' : '로그인'}
                </button>
            </form>

            {/* 소셜 로그인 — 카카오·네이버(design-system §5.11, FC-155). 목업엔 있으나 구현 누락분 보강. */}
            <SocialLoginSection />

            <div className="mt-6 border-t border-content-line pt-6">
                <button
                    type="button"
                    disabled={isSubmitting || isDemoSubmitting}
                    className="h-12 w-full rounded-xl border border-control-action px-4 text-sm font-extrabold text-control-action transition-colors hover:bg-control-action-soft disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={onDemoSubmit}
                >
                    {isDemoSubmitting
                        ? '테스트 계정 연결 중…'
                        : '테스트 계정으로 둘러보기'}
                </button>
                <p className="mt-2 text-center text-xs text-content-subtle">
                    읽기 전용 테스트 계정으로 주요 화면을 둘러볼 수 있어요.
                </p>
                {demoSubmitError != null && (
                    <p role="alert" className="mt-3 text-sm text-danger-ink">
                        {demoLoginErrorMessage(demoSubmitError)}
                    </p>
                )}
            </div>

            <p className="mt-6 text-center text-xs text-content-subtle">
                계정이 없으신가요?{' '}
                <Link
                    to={paths.signup}
                    className="font-bold text-control-action-hover hover:underline"
                >
                    회원가입
                </Link>
            </p>
        </div>
    )
}
