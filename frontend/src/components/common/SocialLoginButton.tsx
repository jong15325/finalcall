import type { OAuthProvider } from '@/features/auth/lib/oauth'

/**
 * 소셜 로그인 버튼 (U-021 · design-system §5.11).
 *
 * ★ 외부 브랜드 규격이라 팔레트 예외다(§2.8) — kakao `#FEE500`+검정 라벨, naver `#03C75A`+흰 라벨.
 *   **재색 금지**. 로고는 브랜드 자산을 복제하지 않고 규격색 위의 중립 도형 + 텍스트 라벨로 둔다
 *   (실제 로고 리소스로 교체 가능, aria-hidden 유지).
 * ★ 규격: 높이 46px · rounded-md(6px) · 전폭 · 세로 스택 배치는 부모(SocialLoginSection)가 맡는다.
 * ★ 비활성(env 미설정 등): opacity 로만 낮추고 "준비 중" 칩을 병기한다 — 회색으로 칠하면
 *   "무슨 버튼 자리인지"가 사라져 자리 확보 목적을 잃는다(§5.11 자리 확보 원칙).
 */

interface ProviderMeta {
    label: string
    /** 브랜드 규격색(재색 금지) */
    className: string
    mark: React.ReactNode
}

const PROVIDER_META: Record<OAuthProvider, ProviderMeta> = {
    kakao: {
        label: '카카오로 계속하기',
        className: 'bg-kakao text-content-fg',
        mark: (
            <svg viewBox="0 0 18 18" aria-hidden="true">
                <path
                    d="M9 2.2C5.1 2.2 2 4.6 2 7.6c0 1.9 1.3 3.6 3.3 4.6l-.7 2.6c-.1.3.2.5.4.3l3.1-2c.3 0 .6.1.9.1 3.9 0 7-2.4 7-5.6S12.9 2.2 9 2.2z"
                    fill="currentColor"
                />
            </svg>
        ),
    },
    naver: {
        label: '네이버로 계속하기',
        className: 'bg-naver text-on-strong',
        mark: (
            <svg viewBox="0 0 18 18" aria-hidden="true">
                <path
                    d="M3.4 3.4h3.7l3.6 5.3V3.4h3.9v11.2h-3.7L7.3 9.3v5.3H3.4z"
                    fill="currentColor"
                />
            </svg>
        ),
    },
}

interface SocialLoginButtonProps {
    provider: OAuthProvider
    onClick?: () => void
    /** env 미설정 등으로 아직 이동할 수 없을 때. 규격색은 유지하고 opacity·"준비 중"으로만 낮춘다. */
    disabled?: boolean
}

export default function SocialLoginButton({
    provider,
    onClick,
    disabled = false,
}: SocialLoginButtonProps) {
    const meta = PROVIDER_META[provider]
    return (
        <button
            type="button"
            disabled={disabled}
            aria-disabled={disabled || undefined}
            className={`relative flex h-[46px] w-full items-center justify-center gap-2 rounded-md text-[15px] font-bold tracking-tight ${meta.className} disabled:cursor-not-allowed disabled:opacity-70`}
            onClick={disabled ? undefined : onClick}
        >
            <span className="h-[18px] w-[18px] shrink-0">{meta.mark}</span>
            {meta.label}
            {disabled && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-content-surface/90 px-2 py-0.5 text-[11px] font-bold tracking-wide text-content-fg">
                    준비 중
                </span>
            )}
        </button>
    )
}
