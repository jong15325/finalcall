/**
 * 브랜드 로고 (FC-067 — HANDOVER §5.1).
 *
 * ★ 펼침: 워드마크(`jangteo-logo.png` = 원본 logo2). 접힘: 심볼(`jangteo-logo-mark.png` = 원본 logo).
 *   자산은 `scripts/sync-brand-assets.mjs` 가 public/brand 로 복사한다(정본 docs/game_ui/common).
 * ★ 접힘 심볼 폭 44px, 펼침 워드마크는 사이드바 폭(260px)에 맞춰 자동. `alt="장터"`로 브랜드명을
 *   보조기술에 전달한다.
 */
const LOGO_FULL = '/brand/jangteo-logo.png'
const LOGO_MARK = '/brand/jangteo-logo-mark.png'

interface BrandLogoProps {
    collapsed?: boolean
    className?: string
}

function BrandLogo({ collapsed = false, className = '' }: BrandLogoProps) {
    if (collapsed) {
        return (
            <img
                src={LOGO_MARK}
                alt="장터"
                width={44}
                className={`h-auto w-11 ${className}`}
            />
        )
    }
    return (
        <img
            src={LOGO_FULL}
            alt="장터"
            className={`h-auto w-auto max-h-9 ${className}`}
        />
    )
}

export default BrandLogo
