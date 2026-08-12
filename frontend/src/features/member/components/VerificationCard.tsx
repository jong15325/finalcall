import { useEffect, useState } from 'react'
import {
    TbAlertTriangle,
    TbCircleCheck,
    TbClock,
    TbDeviceMobile,
    TbMail,
    TbShieldCheck,
} from 'react-icons/tb'
import OtpInput from './OtpInput'
import { emailErrorInfo } from '@/features/member/lib/emailVerifyErrors'
import { hasErrorCode } from '@/lib/api/errors'
import {
    useRequestEmailVerification,
    useSetEmail,
    useVerifyEmailCode,
} from '@/lib/queries/me'
import { ERROR_CODES } from '@/types/errorCodes'
import type { MeResponse } from '@/lib/api/auth'
import type { EmailErrorInfo } from '@/features/member/lib/emailVerifyErrors'

/**
 * 본인 인증 카드 — 이메일 인증 활성화(FC-138·FC-139 · 목업 `template-email-verify.html`).
 *
 * ★ **활성화**: 구 "준비 중" 자리보류를 실동작으로 교체한다. 이메일 3상태(미설정 / 설정·미인증 /
 *   인증완료)를 `GET /me` 의 `emailMasked`·`emailVerified` 로 가르고(계약 §2.5), 코드 입력·재전송
 *   쿨다운·시도초과를 다룬다. 목업 구조를 1:1 로 옮기되 색은 브랜드 토큰(SignupForm 규약).
 * ★ 휴대폰 인증은 **백엔드 없음** → "준비 중" 유지(클릭 시 404 나는 경로를 그리지 않는다, FC-048).
 * ★ **원문 미노출**: 마스킹(`emailMasked`)만 표시한다 — 설정 폼에서 사용자가 방금 입력한 값만
 *   화면에 있고, 그 외 모든 뷰는 마스킹을 쓴다(계약 §2.5·§7). 코드값은 로깅하지 않는다.
 */

/** 정책값 — spec §3 확정값(창작 아님). */
const CODE_TTL_SECONDS = 600 // 10분
const RESEND_COOLDOWN_SECONDS = 60
const MAX_ATTEMPTS = 5
const CODE_LENGTH = 6

/** 이메일 형식 최소 검증(SignupForm 과 동일 — 백엔드 `@Email` 대응). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Panel = 'form' | 'unverified' | 'code' | 'verified'

function formatTtl(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const r = seconds % 60
    return `${m}:${r < 10 ? '0' : ''}${r}`
}

/** `Retry-After`(있으면) → 초, 없으면 쿨다운 기본값. */
function retryAfterSeconds(error: unknown): number {
    const ms =
        error && typeof error === 'object' && 'retryAfterMs' in error
            ? (error as { retryAfterMs?: number }).retryAfterMs
            : undefined
    return ms ? Math.ceil(ms / 1000) : RESEND_COOLDOWN_SECONDS
}

interface VerificationCardProps {
    profile: MeResponse
}

function VerificationCard({ profile }: VerificationCardProps) {
    const setEmailMutation = useSetEmail()
    const requestMutation = useRequestEmailVerification()
    const verifyMutation = useVerifyEmailCode()

    // 서버 파생 기준(계약 §2.5). null=미설정, non-null=설정됨.
    const hasEmail = profile.emailMasked != null
    // 방금 인증 성공(EMAIL_005 포함) 즉시 반영 — 프로필 재조회 전에도 인증완료를 보인다.
    const [justVerified, setJustVerified] = useState(false)
    const isVerified = profile.emailVerified || justVerified

    // 로컬 UI 흐름 — 'view'(파생 카드) / 이메일 폼 / 코드 입력.
    const [mode, setMode] = useState<'view' | 'editEmail' | 'enterCode'>('view')

    // 이메일 설정 폼
    const [emailDraft, setEmailDraft] = useState('')
    const [emailLocalError, setEmailLocalError] = useState<string | null>(null)

    // 코드 입력
    const [code, setCode] = useState('')
    const [attempts, setAttempts] = useState(0)
    const [codeError, setCodeError] = useState<EmailErrorInfo | null>(null)
    const [ttlLeft, setTtlLeft] = useState(0)
    const [cooldownLeft, setCooldownLeft] = useState(0)
    // 이미 발송된 코드가 있는데 재요청이 쿨다운(EMAIL_004)에 걸려 코드 입력으로 진입한 경우 안내.
    const [cooldownNotice, setCooldownNotice] = useState(false)

    // 코드 입력 중에만 남은시간·쿨다운을 1초씩 감산한다(mm:ss·쿨다운 카운트다운).
    useEffect(() => {
        if (mode !== 'enterCode') return
        const id = setInterval(() => {
            setTtlLeft((t) => (t > 0 ? t - 1 : 0))
            setCooldownLeft((c) => (c > 0 ? c - 1 : 0))
        }, 1000)
        return () => clearInterval(id)
    }, [mode])

    const panel: Panel =
        mode === 'editEmail'
            ? 'form'
            : mode === 'enterCode'
              ? 'code'
              : isVerified
                ? 'verified'
                : hasEmail
                  ? 'unverified'
                  : 'form'

    const openEmailForm = () => {
        setEmailDraft('')
        setEmailLocalError(null)
        setEmailMutation.reset()
        setMode('editEmail')
    }

    const handleEmailSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const next = emailDraft.trim()
        if (next.length === 0) {
            setEmailLocalError('이메일을 입력해 주세요.')
            return
        }
        if (next.length > 255 || !EMAIL_PATTERN.test(next)) {
            setEmailLocalError('올바른 이메일 형식이 아닙니다.')
            return
        }
        setEmailLocalError(null)
        setEmailMutation.mutate(next, {
            // 성공 시 프로필 무효화가 마스킹·미인증을 흘려보낸다 → 설정·미인증 카드로 수렴.
            onSuccess: () => {
                setJustVerified(false)
                setMode('view')
            },
        })
    }

    // 새 코드 발송 성공 → 코드 입력 진입(만료·시도·쿨다운 초기화, 안내 없음).
    const startCodeEntry = () => {
        setCode('')
        setAttempts(0)
        setCodeError(null)
        setCooldownNotice(false)
        setTtlLeft(CODE_TTL_SECONDS)
        setCooldownLeft(RESEND_COOLDOWN_SECONDS)
        setMode('enterCode')
    }

    // 만료 여부(코드 입력 중 남은시간 0) — 자동제출·버튼 disabled 가드에 공통으로 쓴다.
    const expired = mode === 'enterCode' && ttlLeft === 0

    const handleRequestCode = () => {
        requestMutation.mutate(undefined, {
            onSuccess: startCodeEntry,
            onError: (error) => {
                if (hasErrorCode(error, ERROR_CODES.EMAIL_005)) {
                    setJustVerified(true)
                } else if (hasErrorCode(error, ERROR_CODES.EMAIL_006)) {
                    openEmailForm()
                } else if (hasErrorCode(error, ERROR_CODES.EMAIL_004)) {
                    // 이미 보낸 코드가 있다 — 코드 입력 화면으로 진입시켜 넣게 하고, 남은 쿨다운만
                    // 잠근다. TTL 은 서버에서 못 받으므로 근사(쿨다운<60s → 코드 신선)로 둔다.
                    setCode('')
                    setAttempts(0)
                    setCodeError(null)
                    setCooldownNotice(true)
                    setTtlLeft(CODE_TTL_SECONDS)
                    setCooldownLeft(retryAfterSeconds(error))
                    setMode('enterCode')
                }
            },
        })
    }

    const handleResend = () => {
        if (cooldownLeft > 0) return
        requestMutation.mutate(undefined, {
            onSuccess: startCodeEntry,
            onError: (error) => {
                if (hasErrorCode(error, ERROR_CODES.EMAIL_004)) {
                    setCooldownNotice(true)
                    setCooldownLeft(retryAfterSeconds(error))
                } else if (hasErrorCode(error, ERROR_CODES.EMAIL_005)) {
                    setJustVerified(true)
                    setMode('view')
                } else if (hasErrorCode(error, ERROR_CODES.EMAIL_006)) {
                    // 이메일 미설정(경합·직접호출) → 설정 폼으로 되돌린다.
                    openEmailForm()
                }
            },
        })
    }

    const handleVerify = (submitCode: string = code) => {
        if (
            submitCode.length !== CODE_LENGTH ||
            verifyMutation.isPending ||
            expired
        )
            return
        setCodeError(null)
        verifyMutation.mutate(submitCode, {
            onSuccess: () => {
                setJustVerified(true)
                setMode('view')
            },
            onError: (error) => {
                setCodeError(emailErrorInfo(error))
                if (hasErrorCode(error, ERROR_CODES.EMAIL_001)) {
                    setAttempts((a) => a + 1)
                    setCode('') // 코드는 아직 유효 — 틀린 자리만 지워 재입력 유도.
                } else if (hasErrorCode(error, ERROR_CODES.EMAIL_005)) {
                    setJustVerified(true)
                    setMode('view')
                } else {
                    setCode('') // 만료·시도초과 등은 코드 폐기 → 비운다.
                }
            },
        })
    }

    const requestErrorInfo =
        requestMutation.isError && panel === 'unverified'
            ? emailErrorInfo(requestMutation.error)
            : null

    return (
        <section className="flex h-full min-w-0 flex-col rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6">
            {/* 헤더 — 이메일 인증 상태를 요약 배지로 */}
            <div className="flex items-center gap-3">
                <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        isVerified
                            ? 'bg-success-soft text-success-ink'
                            : 'bg-brand-structure text-brand-highlight-bright'
                    }`}
                >
                    <TbShieldCheck aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-content-fg">
                        본인 인증
                    </h3>
                    <p className="text-xs text-content-subtle">
                        안전한 거래를 위한 이메일 인증
                    </p>
                </div>
                <StatusBadge verified={isVerified} hasEmail={hasEmail} />
            </div>

            <div className="mt-4 flex-1">
                {panel === 'form' && (
                    <EmailForm
                        value={emailDraft}
                        pending={setEmailMutation.isPending}
                        error={
                            emailLocalError ??
                            (setEmailMutation.isError
                                ? emailErrorInfo(setEmailMutation.error).message
                                : null)
                        }
                        canCancel={hasEmail}
                        onChange={(v) => {
                            setEmailLocalError(null)
                            setEmailDraft(v)
                        }}
                        onSubmit={handleEmailSubmit}
                        onCancel={() => {
                            setEmailMutation.reset()
                            setMode('view')
                        }}
                    />
                )}

                {panel === 'unverified' && (
                    <div className="flex flex-col gap-3">
                        <EmailRow
                            masked={profile.emailMasked}
                            verified={false}
                        />
                        {requestErrorInfo && (
                            <Banner
                                tone={
                                    requestErrorInfo.kind === 'wait'
                                        ? 'warning'
                                        : 'danger'
                                }
                                message={requestErrorInfo.message}
                            />
                        )}
                        <button
                            type="button"
                            disabled={requestMutation.isPending}
                            className="h-11 rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={handleRequestCode}
                        >
                            {requestMutation.isPending
                                ? '보내는 중…'
                                : '인증 코드 받기'}
                        </button>
                        <button
                            type="button"
                            className="self-center text-xs font-semibold text-content-subtle underline underline-offset-2 hover:text-brand-structure"
                            onClick={openEmailForm}
                        >
                            이메일 변경
                        </button>
                    </div>
                )}

                {panel === 'code' && (
                    <div className="flex flex-col gap-3">
                        <p className="text-xs text-content-subtle">
                            <b className="font-bold text-content-fg">
                                {profile.emailMasked}
                            </b>
                            로 보낸 6자리 코드를 입력해 주세요. 10분 안에
                            유효합니다.
                        </p>

                        <div className="flex flex-col gap-1.5">
                            <label
                                id="otpLabel"
                                className="text-xs font-semibold text-content-muted"
                            >
                                인증 코드 6자리
                            </label>
                            <OtpInput
                                value={code}
                                disabled={verifyMutation.isPending}
                                invalid={codeError != null || expired}
                                labelledById="otpLabel"
                                onChange={setCode}
                                onComplete={handleVerify}
                            />
                            <div className="flex items-center justify-between text-xs text-content-subtle">
                                <span>
                                    남은 시간{' '}
                                    <span className="tabular-nums">
                                        {formatTtl(ttlLeft)}
                                    </span>
                                </span>
                                <span
                                    className={
                                        attempts > 0
                                            ? 'font-bold text-warning'
                                            : ''
                                    }
                                >
                                    시도{' '}
                                    <span className="tabular-nums">
                                        {attempts}
                                    </span>
                                    /{MAX_ATTEMPTS}
                                </span>
                            </div>
                        </div>

                        {expired ? (
                            <Banner
                                tone="warning"
                                message="인증 코드가 만료됐어요. 코드를 다시 받아 주세요."
                            />
                        ) : cooldownNotice && cooldownLeft > 0 && !codeError ? (
                            <Banner
                                tone="warning"
                                message="이미 코드를 보냈어요. 메일함(스팸함 포함)을 먼저 확인해 주세요."
                            />
                        ) : codeError?.kind === 'again' ? (
                            <p role="alert" className="text-sm text-danger-ink">
                                {codeError.message} (남은 시도{' '}
                                {Math.max(MAX_ATTEMPTS - attempts, 0)}회)
                            </p>
                        ) : codeError ? (
                            <Banner
                                tone={
                                    codeError.kind === 'info'
                                        ? 'info'
                                        : 'danger'
                                }
                                message={codeError.message}
                            />
                        ) : null}

                        <button
                            type="button"
                            disabled={
                                code.length !== CODE_LENGTH ||
                                verifyMutation.isPending ||
                                expired
                            }
                            aria-busy={verifyMutation.isPending || undefined}
                            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleVerify()}
                        >
                            {verifyMutation.isPending ? '확인 중…' : '인증하기'}
                        </button>

                        <div className="flex items-center justify-center gap-1.5 text-xs text-content-subtle">
                            {cooldownLeft > 0 ? (
                                <span>
                                    <span className="font-bold tabular-nums text-content-fg">
                                        {cooldownLeft}
                                    </span>
                                    초 후 다시 받을 수 있어요
                                </span>
                            ) : (
                                <>
                                    코드가 안 왔나요?
                                    <button
                                        type="button"
                                        disabled={requestMutation.isPending}
                                        className="font-semibold text-control-action-hover underline underline-offset-2 hover:text-control-action disabled:opacity-60"
                                        onClick={handleResend}
                                    >
                                        코드 다시 받기
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {panel === 'verified' && (
                    <div className="flex flex-col gap-3">
                        <Banner
                            tone="success"
                            role="status"
                            title="이메일이 인증되었어요"
                            message="이제 이 주소로 거래 알림과 본인 확인 메일을 받습니다."
                        />
                        <EmailRow verified masked={profile.emailMasked} />
                        <button
                            type="button"
                            className="h-11 rounded-lg border border-content-line bg-content-surface px-4 text-sm font-bold text-content-fg hover:bg-content-soft"
                            onClick={openEmailForm}
                        >
                            이메일 변경
                        </button>
                        <p className="text-center text-xs text-content-subtle">
                            이메일을 바꾸면 다시 인증해야 합니다.
                        </p>
                    </div>
                )}
            </div>

            {/* 휴대폰 인증 — 백엔드 없음, "준비 중" 유지(FC-048) */}
            <div className="mt-4 flex items-center justify-between rounded-lg bg-content-soft px-3.5 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-content-muted">
                    <TbDeviceMobile
                        aria-hidden
                        className="size-4 text-content-subtle"
                    />
                    휴대폰 인증
                </span>
                <span className="text-xs font-semibold text-content-subtle">
                    준비 중
                </span>
            </div>
        </section>
    )
}

/** 헤더 상태 배지 — 인증됨 / 미인증 / 미설정. */
function StatusBadge({
    verified,
    hasEmail,
}: {
    verified: boolean
    hasEmail: boolean
}) {
    if (verified) {
        return (
            <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success-ink">
                <TbCircleCheck aria-hidden className="size-3.5" />
                인증됨
            </span>
        )
    }
    if (hasEmail) {
        return (
            <span className="ms-auto rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-bold text-warning">
                미인증
            </span>
        )
    }
    return (
        <span className="ms-auto rounded-full bg-content-soft px-2.5 py-0.5 text-xs font-bold text-content-subtle">
            미설정
        </span>
    )
}

/** 마스킹 이메일 표시 행 + 상태 배지(원문 미노출). */
function EmailRow({
    masked,
    verified,
}: {
    masked: string | null
    verified: boolean
}) {
    return (
        <div className="flex items-center gap-2 rounded-lg bg-content-soft px-3.5 py-3">
            <TbMail aria-hidden className="size-4 shrink-0 text-content-subtle" />
            <span className="min-w-0 flex-1 break-all text-sm font-bold text-content-fg">
                {masked ?? '이메일 미설정'}
            </span>
            {verified ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-success-ink">
                    <TbCircleCheck aria-hidden className="size-3.5" />
                    인증됨
                </span>
            ) : (
                <span className="text-xs font-bold text-warning">미인증</span>
            )}
        </div>
    )
}

/** 이메일 설정/변경 폼(미설정·변경 공통). */
function EmailForm({
    value,
    onChange,
    onSubmit,
    pending,
    error,
    canCancel,
    onCancel,
}: {
    value: string
    onChange: (v: string) => void
    onSubmit: (e: React.FormEvent) => void
    pending: boolean
    error: string | null
    canCancel: boolean
    onCancel: () => void
}) {
    return (
        <form noValidate className="flex flex-col gap-3" onSubmit={onSubmit}>
            <p className="text-xs text-content-subtle">
                알림·본인 확인에 쓸 이메일을 등록합니다. 등록 후 6자리 인증
                코드를 보내드립니다.
            </p>
            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor="verifyEmail"
                    className="text-xs font-semibold text-content-muted"
                >
                    이메일
                </label>
                <input
                    id="verifyEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={255}
                    placeholder="you@example.com"
                    value={value}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'verifyEmailError' : undefined}
                    className={`h-11 rounded-lg border bg-content-surface px-3.5 text-sm font-semibold text-content-fg placeholder:font-normal placeholder:text-content-subtle outline-none focus:ring-2 ${
                        error
                            ? 'border-danger focus:ring-danger/30'
                            : 'border-content-line focus:border-control-action focus:ring-control-action/30'
                    }`}
                    onChange={(e) => onChange(e.target.value)}
                />
                {error && (
                    <p
                        id="verifyEmailError"
                        role="alert"
                        className="text-sm text-danger-ink"
                    >
                        {error}
                    </p>
                )}
            </div>
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={pending}
                    className="h-11 flex-1 rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {pending ? '저장 중…' : '이메일 저장'}
                </button>
                {canCancel && (
                    <button
                        type="button"
                        className="h-11 rounded-lg border border-content-line bg-content-surface px-4 text-sm font-bold text-content-muted hover:bg-content-soft"
                        onClick={onCancel}
                    >
                        취소
                    </button>
                )}
            </div>
        </form>
    )
}

/** 알림 배너 — 목업 §11 승계(성공/경고/위험/정보). */
function Banner({
    tone,
    title,
    message,
    role = 'status',
}: {
    tone: 'success' | 'warning' | 'danger' | 'info'
    title?: string
    message: string
    role?: 'status' | 'alert'
}) {
    const toneClass = {
        success: 'bg-success-soft text-success-ink',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger-ink',
        info: 'bg-brand-structure/5 text-brand-structure',
    }[tone]
    const Icon =
        tone === 'success'
            ? TbCircleCheck
            : tone === 'warning'
              ? TbClock
              : TbAlertTriangle

    return (
        <div
            role={role}
            className={`flex items-start gap-2 rounded-lg px-3.5 py-3 ${toneClass}`}
        >
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
                {title && (
                    <strong className="block text-sm font-bold">{title}</strong>
                )}
                <p className="text-xs leading-relaxed text-content-muted">
                    {message}
                </p>
            </div>
        </div>
    )
}

export default VerificationCard
