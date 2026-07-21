/**
 * 브랜드 로고 (FC-067 — HANDOVER §5.1).
 *
 * ★ 펼침: 워드마크(`jangteo-logo.png` = 원본 logo2). 접힘: 심볼(`jangteo-logo-mark.png` = 원본 logo).
 *   자산은 `scripts/sync-brand-assets.mjs` 가 public/brand 로 복사한다(정본 docs/game_ui/common).
 * ★ 목업 §5.1 로고 규칙: 접힘 심볼 폭 **44px**, 펼침 워드마크 폭 **~150px**(목업 164). 사이드바에서
 *   가운데 정렬(`.jangteo-brand{justify-content:center}`) — 좌측 쏠림 해소(FC-085 #6). `alt="장터"`.
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
                className={`block h-auto w-11 object-contain ${className}`.trim()}
            />
        )
    }
    return (
        <img
            src={LOGO_FULL}
            alt="장터"
            className={`block h-auto w-[150px] max-h-[46px] object-contain ${className}`.trim()}
        />
    )
}

export default BrandLogo
