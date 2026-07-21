/**
 * ItemFrame — 아이템 카드 프레임 (FC-068).
 *
 * item-frame.css 계약을 흡수한 **순수 표시 컴포넌트**다. 아트 URL 은 밖에서 파생해 주입한다
 * (`itemArt` lib → `imageUrl`). 프레임은 골드포스/일반만 렌더하고 나머지는 STANDARD 폴백한다.
 *
 * ★ **오버레이/외부 액션은 이미지 DOM 내부를 바꾸지 않는다**(§3.1-4). `overlay` 는
 *   `.item-frame__art`(이미지 DOM) **밖**의 별도 층에 렌더한다 — 비교선택·구매가 이미지 크기를
 *   흔들지 못한다.
 * ★ `--item-sprite` 는 **prop 주입**이다(목업의 MutationObserver DOM 후처리 폐기, §6.4).
 * ★ 자산 부재(범위 밖 레벨·미등록 조합 → `imageUrl == null`)는 플레이스홀더로 폴백한다.
 */
import type { CSSProperties, ReactNode } from 'react'
import { TbPhotoOff } from 'react-icons/tb'
import {
    formatGoldforceDays,
    goldforceRemainingDays,
    resolveFrameType,
} from './frame'
import type { ItemFrameVisual } from './frame'
import './ItemFrame.css'

/** 원본 도트 대형(`l`) 픽셀 크기 — 정수배 확대의 기준(itemArt `ART_BASE_SIZE.l`). */
const DEFAULT_ART_WIDTH = 50
const DEFAULT_ART_HEIGHT = 93

interface ItemFrameProps {
    /** 파생된 아트 URL(itemArt). null/undefined 는 플레이스홀더 폴백 */
    imageUrl?: string | null
    /** 접근성 이름(아트 alt / 플레이스홀더 aria-label). 표시명 스냅샷을 넘긴다 */
    name: string
    /** 프레임 데이터 — 계약상 골드포스만 유효(나머지 STANDARD 폴백) */
    visual?: ItemFrameVisual
    /** 스킬 보유 여부(코드 존재 파생). S 마크만 — SS 렌더 금지 */
    hasSkill?: boolean
    /** 스테이지 크기: stage=카드 이미지영역 / frame=인벤토리 타일(72×134). 프레임은 불변 */
    size?: 'stage' | 'frame'
    /** 블러 배경 에코용 원본 아트 URL. 기본은 imageUrl 재사용(§6.4) */
    spriteUrl?: string | null
    /** 아트 표시 크기(정수배). 기본 50×93. CLS 방지를 위해 속성으로 싣는다 */
    artWidth?: number
    artHeight?: number
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now() */
    now?: number
    /** 외부 액션 오버레이(CompareToggle 등) — 이미지 DOM 밖 층에 렌더 */
    overlay?: ReactNode
    className?: string
}

function ItemFrame({
    imageUrl,
    name,
    visual,
    hasSkill = false,
    size = 'stage',
    spriteUrl,
    artWidth = DEFAULT_ART_WIDTH,
    artHeight = DEFAULT_ART_HEIGHT,
    now,
    overlay,
    className = '',
}: ItemFrameProps) {
    const resolvedNow = now ?? Date.now()
    const frameType = resolveFrameType(visual, resolvedNow)
    const days =
        frameType === 'GOLDFORCE'
            ? goldforceRemainingDays(visual?.goldforceExpireAt, resolvedNow)
            : null

    const sprite = spriteUrl ?? imageUrl ?? null
    const stageStyle = (
        sprite ? { '--item-sprite': `url("${sprite}")` } : undefined
    ) as CSSProperties | undefined

    return (
        <div className={`item-frame item-frame--${size} ${className}`.trim()}>
            <div className="item-frame__stage" style={stageStyle}>
                <div
                    className={`item-frame__art is-${frameType.toLowerCase()}`}
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={name}
                            width={artWidth}
                            height={artHeight}
                            className="item-frame__art-img"
                            draggable={false}
                        />
                    ) : (
                        <span
                            role="img"
                            aria-label={name}
                            className="item-frame__placeholder"
                        >
                            <TbPhotoOff aria-hidden className="size-6" />
                        </span>
                    )}

                    {days !== null && (
                        <span
                            className="item-frame__days"
                            aria-label={`골드포스 잔여 ${days}일`}
                        >
                            <span aria-hidden="true">
                                {formatGoldforceDays(days)}
                            </span>
                        </span>
                    )}

                    {hasSkill && (
                        <span
                            className="item-frame__skill"
                            role="img"
                            aria-label="스킬 보유"
                        >
                            <span aria-hidden="true">S</span>
                        </span>
                    )}
                </div>
            </div>

            {overlay ? (
                <div className="item-frame__overlay">{overlay}</div>
            ) : null}
        </div>
    )
}

export default ItemFrame
