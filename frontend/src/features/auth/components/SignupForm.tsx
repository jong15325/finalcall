import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { TbId, TbLock, TbLockCheck, TbMail, TbUser } from 'react-icons/tb'
import AuthTextField from './AuthTextField'
import {
    signupEmailErrorMessage,
    signupErrorMessage,
} from '@/features/auth/lib/authErrors'
import {
    checkLoginIdAvailability,
    checkNicknameAvailability,
} from '@/lib/api/auth'
import { paths } from '@/app/paths'

/**
 * 회원가입 폼 (FC-078 — 목업 `signup()` `.modern-auth-form` · design-brief B-6).
 *
 * ★ 구조는 목업 1:1(브랜드는 AuthLayout), 색은 브랜드 토큰(rebuild §2.9).
 * ★ 제출 필드 = 필수 3(`loginId·password·nickname`) + **선택 email**(계약 §2·§4.1, FC-137).
 *   email 은 값이 있을 때만 payload 에 포함하고 빈 값이면 생략한다(이메일 없는 계정). 201 후 토큰
 *   미발급이라 자동 로그인하지 않으며(가입 후 로그인 별도), **이메일 인증은 가입 후 별도 화면(F2)**.
 * ★ 아이디·닉네임 중복확인은 모두 **라이브 조회**다(FC-167·FC-162 · 계약 §2 v1.18·v1.17):
 *   입력→"중복 확인"→가용성 조회→즉시 피드백. **제출 전제(필수, FC-169)**라 둘 다 available
 *   확인돼야 제출한다 — 미확인(idle)·중복(taken)·오류(error)면 제출을 막고 미확인 필드에
 *   안내 문구를 띄운다. 엔드포인트 자체는 advisory(TOCTOU 가능)라 제출 시 `AUTH_001`(아이디)·
 *   `AUTH_002`(닉네임) 409 가 최종 방어선으로 남는다. 소셜(카카오·네이버)은 로그인·가입
 *   통합(find-or-create)이라 회원가입 화면에서는 제공하지 않는다(진입은 로그인 화면
 *   `SocialLoginSection` 한 곳, FC-158).
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

/** 라이브 중복확인 상태 — 입력 변경 시 `idle` 로 초기화(재확인 유도). */
type AvailabilityCheck = 'idle' | 'checking' | 'available' | 'taken' | 'error'

/**
 * "중복 확인" 활성 버튼(아이디·닉네임 공용, FC-167·FC-162). 값이 없거나 조회 중이면 비활성.
 * `ariaLabel` 로 두 버튼(아이디·닉네임)의 접근성 이름을 구분한다(같은 표시 문구 "중복 확인").
 */
function AvailabilityCheckButton({
    ariaLabel,
    checking,
    disabled,
    onClick,
}: {
    ariaLabel: string
    checking: boolean
    disabled: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            aria-label={ariaLabel}
            disabled={disabled || checking}
            className="auth-secondary-action flex h-12 shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClick}
        >
            {checking ? '확인 중…' : '중복 확인'}
        </button>
    )
}

export default function SignupForm({
    isSubmitting,
    submitError,
    onSubmit,
}: SignupFormProps) {
    const [loginId, setLoginId] = useState('')
    const [loginIdCheck, setLoginIdCheck] = useState<AvailabilityCheck>('idle')
    const [password, setPassword] = useState('')
    const [passwordConfirm, setPasswordConfirm] = useState('')
    const [email, setEmail] = useState('')
    const [nickname, setNickname] = useState('')
    const [nicknameCheck, setNicknameCheck] = useState<AvailabilityCheck>('idle')
    // 중복확인 없이 제출을 시도한 적이 있는지(FC-169). true 면 미확인(idle) 필드에 안내 문구를 띄운다.
    const [submitAttempted, setSubmitAttempted] = useState(false)

    const loginIdTrimmed = loginId.trim()
    const nicknameTrimmed = nickname.trim()

    // 현재 입력값의 최신 스냅샷(ref). 조회는 비동기라 응답 도착 시점의 클로저 상태는 낡았을 수
    // 있어(입력이 그새 바뀜), stale 응답 가드에서 "지금 화면의 값"을 ref 로 읽는다(FC-169 M1).
    const loginIdRef = useRef(loginId)
    const nicknameRef = useRef(nickname)

    // 아이디가 바뀌면 직전 확인 결과는 무효 → idle 로 되돌려 재확인을 유도한다.
    const handleLoginIdChange = (value: string) => {
        loginIdRef.current = value
        setLoginId(value)
        setLoginIdCheck('idle')
    }

    // 라이브 중복확인(계약 §2 v1.18). 제출과 동일하게 트림값으로 조회한다.
    // 엔드포인트는 advisory 라 제출 시 AUTH_001(409)이 최종 방어선이지만, 제출 게이트(FC-169)는
    // available 만 통과시킨다. ★ 경합 가드(M1): 조회 in-flight 중 입력이 바뀌면(=검사값 != 현재값)
    // 낡은 응답을 버려, available 이 언제나 "현재 입력값을 확인한 결과"만 의미하게 한다.
    const handleCheckLoginId = async () => {
        const checked = loginIdTrimmed
        if (checked.length === 0 || loginIdCheck === 'checking') return
        setLoginIdCheck('checking')
        try {
            const { available } = await checkLoginIdAvailability(checked)
            if (loginIdRef.current.trim() !== checked) return
            setLoginIdCheck(available ? 'available' : 'taken')
        } catch {
            // 400(형식·길이)·네트워크 모두 재시도 안내로 수렴 — 원문 미노출.
            if (loginIdRef.current.trim() !== checked) return
            setLoginIdCheck('error')
        }
    }

    // 닉네임이 바뀌면 직전 확인 결과는 무효 → idle 로 되돌려 재확인을 유도한다.
    const handleNicknameChange = (value: string) => {
        nicknameRef.current = value
        setNickname(value)
        setNicknameCheck('idle')
    }

    // 라이브 중복확인(계약 §2 v1.17). 제출과 동일하게 트림값으로 조회한다.
    // ★ 경합 가드(M1)는 아이디와 대칭 — stale 응답(검사값 != 현재값)은 반영하지 않는다.
    const handleCheckNickname = async () => {
        const checked = nicknameTrimmed
        if (checked.length === 0 || nicknameCheck === 'checking') return
        setNicknameCheck('checking')
        try {
            const { available } = await checkNicknameAvailability(checked)
            if (nicknameRef.current.trim() !== checked) return
            setNicknameCheck(available ? 'available' : 'taken')
        } catch {
            // 400(형식·길이)·네트워크 모두 재시도 안내로 수렴 — 원문 미노출.
            if (nicknameRef.current.trim() !== checked) return
            setNicknameCheck('error')
        }
    }

    // 제출 전제(FC-169): 아이디·닉네임 모두 available 확인돼야 제출 가능. 값 변경 시 idle 로
    // 초기화되므로(handle*Change), available 이면 확인된 값 == 현재 입력값이 보장된다.
    const loginIdConfirmed = loginIdCheck === 'available'
    const nicknameConfirmed = nicknameCheck === 'available'

    const loginIdFeedback =
        loginIdCheck === 'available'
            ? { text: '사용 가능한 아이디입니다.', tone: 'ok' as const }
            : loginIdCheck === 'taken'
              ? { text: '이미 사용 중인 아이디입니다.', tone: 'bad' as const }
              : loginIdCheck === 'error'
                ? {
                      text: '확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
                      tone: 'bad' as const,
                  }
                : // 미확인(idle) 상태로 제출을 시도하면 중복확인을 요구한다.
                  submitAttempted && loginIdCheck === 'idle'
                  ? {
                        text: '아이디 중복확인을 진행해 주세요.',
                        tone: 'bad' as const,
                    }
                  : null

    const nicknameFeedback =
        nicknameCheck === 'available'
            ? { text: '사용 가능한 닉네임입니다.', tone: 'ok' as const }
            : nicknameCheck === 'taken'
              ? { text: '이미 사용 중인 닉네임입니다.', tone: 'bad' as const }
              : nicknameCheck === 'error'
                ? {
                      text: '확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
                      tone: 'bad' as const,
                  }
                : // 미확인(idle) 상태로 제출을 시도하면 중복확인을 요구한다.
                  submitAttempted && nicknameCheck === 'idle'
                  ? {
                        text: '닉네임 중복확인을 진행해 주세요.',
                        tone: 'bad' as const,
                    }
                  : null

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
        // ★ 중복확인 필수(FC-169): 아이디·닉네임 모두 available 이 아니면 제출을 막고, 미확인
        //   필드에 안내 문구를 띄운 뒤 첫 미충족 필드로 포커스를 옮긴다. 서버 409(AUTH_001·
        //   AUTH_002)는 TOCTOU 대비 최종 방어선으로 그대로 유지된다.
        if (!loginIdConfirmed || !nicknameConfirmed) {
            setSubmitAttempted(true)
            const firstUnconfirmedId = !loginIdConfirmed ? 'signupId' : 'nickname'
            document.getElementById(firstUnconfirmedId)?.focus()
            return
        }
        onSubmit({
            loginId: loginId.trim(),
            password,
            nickname: nickname.trim(),
            // 값이 있을 때만 email 키를 포함한다(빈 값이면 생략 — 계약 §4.1).
            ...(emailTrimmed.length > 0 ? { email: emailTrimmed } : {}),
        })
    }

    return (
        <div className="auth-form mx-auto w-full max-w-xl">
            <p className="auth-eyebrow">CREATE ACCOUNT</p>
            <h1 className="auth-copy-strong mt-2 text-3xl font-black tracking-tight">
                회원가입
            </h1>
            <p className="auth-copy-muted mt-2 text-sm">
                거래에 사용할 기본 계정 정보를 입력해 주세요.
            </p>

            <form
                noValidate
                className="mt-8 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2"
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
                        invalid={loginIdFeedback?.tone === 'bad'}
                        describedById={
                            loginIdFeedback ? 'loginIdCheckStatus' : undefined
                        }
                        trailing={
                            <AvailabilityCheckButton
                                ariaLabel="아이디 중복 확인"
                                checking={loginIdCheck === 'checking'}
                                disabled={loginIdTrimmed.length === 0}
                                onClick={handleCheckLoginId}
                            />
                        }
                        onChange={handleLoginIdChange}
                    />
                    {/* aria-live: 조회 결과를 보조기기에 알린다(결과가 없으면 빈 영역). */}
                    <p
                        id="loginIdCheckStatus"
                        role="status"
                        aria-live="polite"
                        className={`mt-1.5 text-xs ${
                            loginIdFeedback?.tone === 'ok'
                                ? 'text-success-ink'
                                : 'text-danger-ink'
                        }`}
                    >
                        {loginIdFeedback?.text ?? ''}
                    </p>
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
                            className="mt-1.5 text-xs text-danger-ink"
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
                            className="mt-1.5 text-xs text-danger-ink"
                        >
                            {emailFieldError}
                        </p>
                    ) : (
                        <p className="mt-1.5 text-xs text-content-subtle">
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
                        invalid={nicknameFeedback?.tone === 'bad'}
                        describedById={
                            nicknameFeedback ? 'nicknameCheckStatus' : undefined
                        }
                        trailing={
                            <AvailabilityCheckButton
                                ariaLabel="닉네임 중복 확인"
                                checking={nicknameCheck === 'checking'}
                                disabled={nicknameTrimmed.length === 0}
                                onClick={handleCheckNickname}
                            />
                        }
                        onChange={handleNicknameChange}
                    />
                    {/* aria-live: 조회 결과를 보조기기에 알린다(결과가 없으면 빈 영역). */}
                    <p
                        id="nicknameCheckStatus"
                        role="status"
                        aria-live="polite"
                        className={`mt-1.5 text-xs ${
                            nicknameFeedback?.tone === 'ok'
                                ? 'text-success-ink'
                                : 'text-danger-ink'
                        }`}
                    >
                        {nicknameFeedback?.text ?? ''}
                    </p>
                </div>

                {serverError && (
                    <p
                        role="alert"
                        className="text-sm text-danger-ink sm:col-span-2"
                    >
                        {serverError}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="auth-primary-action mt-2 h-12 rounded-xl px-4 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                >
                    {isSubmitting ? '가입 중…' : '회원가입'}
                </button>
            </form>

            <p className="mt-6 text-center text-xs text-content-subtle">
                이미 계정이 있으신가요?{' '}
                <Link
                    to={paths.login}
                    className="font-bold text-control-action-hover hover:underline"
                >
                    로그인
                </Link>
            </p>
        </div>
    )
}
