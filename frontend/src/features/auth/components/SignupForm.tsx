import { useState } from 'react'
import { Link } from 'react-router'
import { TbId, TbLock, TbLockCheck, TbMail, TbUser } from 'react-icons/tb'
import AuthTextField from './AuthTextField'
import { signupErrorMessage } from '@/features/auth/lib/authErrors'
import { paths } from '@/app/paths'

/**
 * 회원가입 폼 (FC-078 — 목업 `signup()` `.modern-auth-form` · design-brief B-6).
 *
 * ★ 구조는 목업 1:1(브랜드는 AuthLayout), 색은 브랜드 토큰(rebuild §2.9).
 * ★ **실제 제출은 3필드만**(`loginId·password·nickname`, 계약 §2) → 201 후 토큰 미발급이라
 *   자동 로그인하지 않는다(가입 후 로그인 별도).
 * ★ 미구현 자리(백엔드 없음, 미호출): 아이디 중복확인(`/auth/ids/availability` 없음)·이메일
 *   인증(`email-verifications` 없음)·OAuth(네이버·카카오). 전부 **DOM `disabled` 준비 중 자리**로만
 *   두고 클릭해도 아무 것도 호출하지 않는다(§5 · 404 방지). PASS 본인인증은 제거됐다.
 * ★ 비밀번호 확인 불일치는 **클라 검증**(제출 차단). `<form noValidate>` 로 브라우저 말풍선을 끈다.
 */

interface SignupFormProps {
    isSubmitting: boolean
    /** 마지막 가입 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onSubmit: (credential: {
        loginId: string
        password: string
        nickname: string
    }) => void
}

/** 준비 중 자리 액션 버튼(중복확인·인증요청) — 미호출·DOM 비활성. */
function PendingAction({ label }: { label: string }) {
    return (
        <button
            disabled
            type="button"
            aria-disabled="true"
            title="준비 중입니다"
            className="flex h-11 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-gray-50 px-3 text-xs font-bold text-gray-400"
        >
            {label}
            <span className="text-[10px] font-medium">준비 중</span>
        </button>
    )
}

export default function SignupForm({
    isSubmitting,
    submitError,
    onSubmit,
}: SignupFormProps) {
    const [loginId, setLoginId] = useState('')
    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [email, setEmail] = useState('')
    const [nickname, setNickname] = useState('')

    const mismatch =
        passwordConfirm.length > 0 && password !== passwordConfirm
    const allFilled =
        loginId.trim().length > 0 &&
        password.length > 0 &&
        passwordConfirm.length > 0 &&
        nickname.trim().length > 0
    const canSubmit = allFilled && !isSubmitting

    const serverError =
        submitError != null ? signupErrorMessage(submitError) : null

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        // ★ 비밀번호 확인 불일치는 서버로 보내지 않는다(클라 선차단).
        if (password !== passwordConfirm) return
        onSubmit({
            loginId: loginId.trim(),
            password,
            nickname: nickname.trim(),
        })
    }

    return (
        <div>
            <h1 className="text-center text-2xl font-bold text-gray-900">
                회원가입
            </h1>

            <form
                noValidate
                className="mt-6 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2"
                onSubmit={handleSubmit}
            >
                <div className="sm:col-span-2">
                    <AuthTextField
                        id="signupId"
                        label="아이디"
                        icon={<TbUser />}
                        value={loginId}
                        autoComplete="username"
                        placeholder="로그인에 사용할 아이디"
                        trailing={<PendingAction label="중복 확인" />}
                        onChange={setLoginId}
                    />
                </div>

                <AuthTextField
                    id="signupPassword"
                    label="비밀번호"
                    type="password"
                    icon={<TbLock />}
                    value={password}
                    autoComplete="new-password"
                    placeholder="비밀번호"
                    onChange={setPassword}
                />
                <div>
                    <AuthTextField
                        id="signupPasswordConfirm"
                        label="비밀번호 확인"
                        type="password"
                        icon={<TbLockCheck />}
                        value={passwordConfirm}
                        autoComplete="new-password"
                        placeholder="비밀번호 확인"
                        invalid={mismatch}
                        describedById={
                            mismatch ? 'passwordConfirmError' : undefined
                        }
                        onChange={setPasswordConfirm}
                    />
                    {mismatch && (
                        <p
                            id="passwordConfirmError"
                            role="alert"
                            className="mt-1.5 text-xs text-danger"
                        >
                            비밀번호가 일치하지 않습니다.
                        </p>
                    )}
                </div>

                <div className="sm:col-span-2">
                    <AuthTextField
                        id="signupEmail"
                        label="이메일 인증"
                        type="email"
                        icon={<TbMail />}
                        value={email}
                        autoComplete="email"
                        inputMode="email"
                        placeholder="name@example.com"
                        trailing={<PendingAction label="인증 요청" />}
                        onChange={setEmail}
                    />
                    <p className="mt-1.5 text-xs text-gray-400">
                        이메일 인증은 준비 중입니다. 지금은 아이디·비밀번호·닉네임으로
                        가입합니다.
                    </p>
                </div>

                <div className="sm:col-span-2">
                    <AuthTextField
                        id="nickname"
                        label="닉네임"
                        icon={<TbId />}
                        value={nickname}
                        autoComplete="nickname"
                        placeholder="닉네임"
                        onChange={setNickname}
                    />
                </div>

                {serverError && (
                    <p
                        role="alert"
                        className="text-sm text-danger sm:col-span-2"
                    >
                        {serverError}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="mt-1 h-11 rounded-lg bg-orange px-4 text-sm font-bold text-white hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
                >
                    {isSubmitting ? '가입 중…' : '회원가입'}
                </button>
            </form>

            {/* 소셜 가입 자리(예정) — 네이버·카카오. 미호출·DOM 비활성(구글 없음). */}
            <div
                className="my-5 flex items-center gap-3 text-xs text-gray-400"
                role="separator"
            >
                <span className="h-px flex-1 bg-line" />
                또는
                <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                    disabled
                    type="button"
                    aria-disabled="true"
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-gray-50 text-sm font-bold text-gray-400"
                >
                    카카오로 가입
                    <span className="text-[10px] font-medium">준비 중</span>
                </button>
                <button
                    disabled
                    type="button"
                    aria-disabled="true"
                    className="flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-gray-50 text-sm font-bold text-gray-400"
                >
                    네이버로 가입
                    <span className="text-[10px] font-medium">준비 중</span>
                </button>
            </div>
            <p className="mt-3 text-center text-xs text-gray-400">
                소셜 인증은 아직 연결되지 않았습니다.
            </p>

            <p className="mt-6 text-center text-xs text-gray-500">
                이미 계정이 있으신가요?{' '}
                <Link
                    to={paths.login}
                    className="font-bold text-orange-deep hover:underline"
                >
                    로그인
                </Link>
            </p>
        </div>
    )
}
