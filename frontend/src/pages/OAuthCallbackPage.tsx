import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import useAuth from '@/auth/useAuth'
import { oauthErrorMessage } from '@/features/auth/lib/authErrors'
import { OAUTH_SESSION_KEY } from '@/features/auth/lib/oauth'
import type { OAuthProvider } from '@/features/auth/lib/oauth'
import { paths } from '@/app/paths'

/**
 * 소셜 로그인 provider 복귀지 `/oauth/callback` (FC-156 · 계약 §2 소셜 로그인 방식 B).
 *
 * ★ 흐름: provider 가 `?code&state`(거부 시 `?error`)로 이 화면에 되돌린다 → FC-155 가
 *   `sessionStorage`(`OAUTH_SESSION_KEY`)에 보관한 `{provider, state}` 를 읽어 **state 대조(CSRF)**
 *   → 일치할 때만 백엔드에 `code` 교환을 요청한다. state 규약은 **소비만** 한다(FC-155 소유).
 * ★ 성공 시 세션이 서면 이 화면을 감싼 `PublicRoute` 가 홈(또는 복귀 URL)으로 되돌린다 —
 *   여기서 직접 `navigate` 하지 않는다(로그인 화면과 같은 선언적 이동).
 * ★ `code` 는 1회용이라 교환을 **정확히 한 번만** 시도한다(StrictMode 이중 호출·재실행 차단).
 *   보관값도 읽는 즉시 정리한다.
 */

/** 콜백 자체가 무효(백엔드 미호출)일 때의 문구 — CSRF 등 상세는 노출하지 않는다. */
const INVALID_REQUEST_MESSAGE = '로그인 요청이 올바르지 않습니다. 다시 시도해 주세요.'
/** provider 에서 사용자가 동의를 취소한 경우. */
const CANCELLED_MESSAGE = '소셜 로그인을 취소했습니다.'

const PROVIDERS: readonly OAuthProvider[] = ['kakao', 'naver']

interface PendingOAuth {
    provider: OAuthProvider
    state: string
}

/** FC-155 가 보관한 `{provider, state}` 를 읽어 형상 검증. 없거나 파손이면 null. */
function readPending(): PendingOAuth | null {
    const raw = sessionStorage.getItem(OAUTH_SESSION_KEY)
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as Partial<PendingOAuth>
        if (
            typeof parsed.state === 'string' &&
            PROVIDERS.includes(parsed.provider as OAuthProvider)
        ) {
            return {
                provider: parsed.provider as OAuthProvider,
                state: parsed.state,
            }
        }
    } catch {
        // JSON 파손 — 무효로 처리한다.
    }
    return null
}

export default function OAuthCallbackPage() {
    const { oauthSignIn } = useAuth()
    const [searchParams] = useSearchParams()
    const [error, setError] = useState<string | null>(null)
    const ranRef = useRef(false)

    useEffect(() => {
        // 1회용 code — 교환을 정확히 한 번만 시도한다(StrictMode·리렌더 재실행 차단).
        if (ranRef.current) return
        ranRef.current = true

        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const denied = searchParams.get('error') // provider 사용자 거부(access_denied 등)

        // 보관값을 읽는 즉시 정리한다(1회용 — 재사용·잔존 방지).
        const pending = readPending()
        sessionStorage.removeItem(OAUTH_SESSION_KEY)

        if (denied) {
            setError(CANCELLED_MESSAGE)
            return
        }
        // state 대조(CSRF): 누락·불일치·보관값 부재면 백엔드를 호출하지 않고 중단한다.
        if (!code || !state || !pending || pending.state !== state) {
            setError(INVALID_REQUEST_MESSAGE)
            return
        }

        oauthSignIn(pending.provider, code).catch((err) => {
            setError(oauthErrorMessage(err))
        })
    }, [oauthSignIn, searchParams])

    if (error) {
        return (
            <div className="text-center">
                <h1 className="text-xl font-bold text-content-fg">
                    로그인하지 못했습니다
                </h1>
                <p role="alert" className="mt-3 text-sm text-danger-ink">
                    {error}
                </p>
                <Link
                    replace
                    to={paths.login}
                    className="mt-6 inline-block text-sm font-bold text-control-action-hover hover:underline"
                >
                    로그인으로 돌아가기
                </Link>
            </div>
        )
    }

    return (
        <div
            role="status"
            className="flex flex-col items-center gap-4 py-6 text-center"
        >
            <span
                aria-hidden
                className="h-8 w-8 animate-spin rounded-full border-2 border-content-line border-t-control-action"
            />
            <p className="text-sm font-semibold text-content-muted">
                소셜 로그인 처리 중…
            </p>
        </div>
    )
}
