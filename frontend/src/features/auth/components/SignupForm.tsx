import { useState } from 'react'
import { Link } from 'react-router'
import { TbId, TbLock, TbLockCheck, TbMail, TbUser } from 'react-icons/tb'
import AuthTextField from './AuthTextField'
import {
    signupEmailErrorMessage,
    signupErrorMessage,
} from '@/features/auth/lib/authErrors'
import { paths } from '@/app/paths'

/**
 * 회원가입 폼 (FC-078 — 목업 `signup()` `.modern-auth-form` · design-brief B-6).
 *
 * ★ 구조는 목업 1:1(브랜드는 AuthLayout), 색은 브랜드 토큰(rebuild §2.9).
 * ★ 제출 필드 = 필수 3(`loginId·password·nickname`) + **선택 email**(계약 §2·§4.1, FC-137).
 *   email 은 값이 있을 때만 payload 에 포함하고 빈 값이면 생략한다(이메일 없는 계정). 201 후 토큰
 *   미발급이라 자동 로그인하지 않으며(가입 후 로그인 별도), **이메일 인증은 가입 후 별도 화면(F2)**.
 * ★ 미구현 자리(백엔드 없음, 미호출): 아이디 중복확인(`/auth/ids/availability` 없음)·OAuth(네이버·카카오).
 *   전부 **DOM `disabled` 준비 중 자리**로만 두고 클릭해도 아무 것도 호출하지 않는다(§5 · 404 방지).
 * ★ 클라 검증(제출 차단): 비밀번호 확인 불일치 · email 형식(값이 있을 때 `@Email`·≤255).
 *   `<form noValidate>` 로 브라우저 말풍선을 끈다.
 */

interface SignupFormProps {
    isSubmitting: boolean
    /** 마지막 가입 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onSubmit: (credential: {
        loginId: string
        password: string
        nickname: string
        /** 선택 — 값이 있을 때만 포함(빈 값이면 키 생략). */
        email?: string
    }) => void
}

/**
 * 이메일 형식 최소 검증(백엔드 `@Email` 대응). 공백 없는 `x@y.z` 형태만 통과 — 명백한 오입력만
 * 막고 서버가 받아들일 값을 과도하게 거르지 않는다(255자 상한은 입력 `maxLength` + 별도 검사).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 준비 중 자리 액션 버튼(아이디 중복확인) — 미호출·DOM 비활성. */
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

    const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm
    // ★ email 은 선택 — 값이 있을 때만 형식(≤255·`@Email`)을 따진다. 빈 값은 유효(생략 전송).
    const emailTrimmed = email.trim()
    const emailFormatInvalid =
        emailTrimmed.length > 0 &&
        (emailTrimmed.length > 255 || !EMAIL_PATTERN.test(emailTrimmed))
    const allFilled =
        loginId.trim().length > 0 &&
        password.length > 0 &&
        passwordConfirm.length > 0 &&
        nickname.trim().length > 0
    const canSubmit = allFilled && !emailFormatInvalid && !isSubmitting

    // EMAIL_007(중복 이메일)은 email 필드 옆에, 나머지는 공통 배너에. 둘은 겹쳐 뜨지 않는다.
    const emailServerError = signupEmailErrorMessage(submitError)
    const serverError =
        submitError != null && emailServerError == null
            ? signupErrorMessage(submitError)
            : null
    const emailFieldError = emailFormatInvalid
        ? '올바른 이메일 형식이 아닙니다.'
        : emailServerError

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (!canSubmit) return
        // ★ 비밀번호 확인 불일치·이메일 형식 오류는 서버로 보내지 않는다(클라 선차단).
        if (password !== passwordConfirm) return
        if (emailFormatInvalid) return
        onSubmit({
            loginId: loginId.trim(),
            password,
            nickname: nickname.trim(),
            // 값이 있을 때만 email 키를 포함한다(빈 값이면 생략 — 계약 §4.1).
            ...(emailTrimmed.length > 0 ? { email: emailTrimmed } : {}),
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
                        label="이메일 (선택)"
                        type="email"
                        icon={<TbMail />}
                        value={email}
                        autoComplete="email"
                        inputMode="email"
                        maxLength={255}
                        placeholder="name@example.com"
                        invalid={emailFormatInvalid || emailServerError != null}
                        describedById={
                            emailFieldError ? 'signupEmailError' : undefined
                        }
                        onChange={setEmail}
                    />
                    {emailFieldError ? (
                        <p
                            id="signupEmailError"
                            role="alert"
                            className="mt-1.5 text-xs text-danger"
                        >
                            {emailFieldError}
                        </p>
                    ) : (
                        <p className="mt-1.5 text-xs text-gray-400">
                            선택 항목입니다. 입력하면 가입 후 이메일 인증에 쓸
                            수 있어요.
                        </p>
                    )}
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
