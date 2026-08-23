/**
 * ItemFrame — 아이템 카드 프레임 (FC-068 재작업: 목업 방식 이식).
 *
 * 목업 `market.js itemFrame()` + `item-frame.css` 를 그대로 옮긴 **순수 표시 컴포넌트**다. 아트 URL 은
 * 밖에서 파생해 주입한다(`itemArt` lib → `imageUrl`). DOM·클래스(`card-art`·`card-gold-frame`·
 * `card-number-slot`·`card-rank`·`card-bevel`·`item-art`)는 목업과 1:1 이다.
 *
 * ★ **골드포스·STANDARD(블랙)·스킬 마크만 실제 렌더**한다. 프레임 종류와 잔여일은 서버
 *   `cardInfo.frame`을 그대로 사용한다. 골드포스는 `gold-Photoroom.png` 프레임
 *   오버레이 + `gold-number-transparent.png` 스프라이트 글리프 잔여일(3자리, 좌상단 #592400 인셋) +
 *   광택. STANDARD 는 `black-frame-transparent.png`. 실버포스·펫·아바타·이벤트는 계약 데이터가 없어
 *   렌더러를 두지 않는다(도달 불가 = 죽은 코드 금지).
 * ★ 스킬 마크는 존재 여부(`hasSkill`)만으로 일반 S(`skill-gold`/`skill-black`). 특수 SS 는 계약
 *   데이터가 없어 렌더하지 않는다(§2.2 specialSkill 드롭).
 * ★ **오버레이/외부 액션은 이미지 DOM(.card-art) 밖 별도 층**에 렌더한다(§3.1-4) — 이미지 크기 불변.
 * ★ `--item-sprite` 는 prop 주입(목업 MutationObserver DOM 후처리 폐기, §6.4).
 * ★ 자산 부재(범위 밖 레벨·미등록 조합 → `imageUrl == null`)는 플레이스홀더로 폴백한다.
 */
import type { CSSProperties, ReactNode } from 'react'
import { TbPhotoOff } from 'react-icons/tb'
import { formatGoldforceDays } from './frame'
import type { CardInfoResponse } from '@/lib/api/cardInfo'
import './ItemFrame.css'

/** 스프라이트 시트 글리프 폭(px) — gold-number-transparent.png 는 90×15(10자 × 9px). */
const GLYPH_WIDTH = 9

interface ItemFrameProps {
    /** 파생된 아트 URL(itemArt). null/undefined 는 플레이스홀더 폴백 */
    imageUrl?: string | null
    /** 접근성 이름(아트 alt / 플레이스홀더 aria-label). 표시명 스냅샷을 넘긴다 */
    name: string
    /** 프레임 데이터 — 계약상 골드포스만 유효(나머지 STANDARD 폴백) */
    frame?: CardInfoResponse['frame']
    /** 스킬 보유 여부(코드 존재 파생). 일반 S 마크만 — 특수 SS 렌더 금지 */
    hasSkill?: boolean
    /** 스테이지 크기: stage=카드 이미지영역 / frame=인벤토리 타일(72×134). 프레임은 불변 */
    size?: 'stage' | 'frame'
    /** 스테이지를 부모 크기로 채운다(그리드 셀 아트 영역 전체에 스프라이트, §3·§4) */
    fill?: boolean
    /** 프레임 정수배 확대(1·2·3…). 비율·좌표 불변(§6.1). 큰 스테이지(상세·히어로)에서 2 */
    scale?: number
    /** 블러 배경 에코용 원본 아트 URL. 기본은 imageUrl 재사용(§6.4) */
    spriteUrl?: string | null
    /** 기존 호출 계약과 테스트 시계 주입 형상을 유지하며 프레임 값은 재계산하지 않는다. */
    now?: number
    /** 골드포스 프레임은 유지하고 잔여일 숫자 슬롯만 숨길 수 있다. */
    showGoldforceDays?: boolean
    /** 외부 액션 오버레이(CompareToggle 등) — 이미지 DOM 밖 층에 렌더 */
    overlay?: ReactNode
    className?: string
}

function ItemFrame({
    imageUrl,
    name,
    frame,
    hasSkill = false,
    size = 'stage',
    fill = false,
    scale,
    spriteUrl,
    showGoldforceDays = true,
    overlay,
    className = '',
}: ItemFrameProps) {
    const isGoldforce = frame?.type === 'GOLD'
    const days = isGoldforce ? frame.remainingGoldforceDays : null
    const dayLabel = days !== null ? formatGoldforceDays(days) : null

    const sprite = spriteUrl ?? imageUrl ?? null
    const rootStyle = {
        ...(sprite ? { '--item-sprite': `url("${sprite}")` } : {}),
        ...(scale && scale !== 1 ? { '--art-scale': String(scale) } : {}),
    } as CSSProperties

    return (
        <div
            className={`item-frame item-frame--${size} ${fill ? 'item-frame--fill' : ''} ${className}`.trim()}
            style={rootStyle}
        >
            <div className="item-frame__stage">
                <span
                    className={`card-art ${isGoldforce ? 'is-goldforce' : 'is-standard'} ${!showGoldforceDays ? 'hide-goldforce-days' : ''}`.trim()}
                >
                    {isGoldforce && (
                        <img
                            className="card-gold-frame"
                            src="/art/frames/gold-Photoroom.png"
                            alt=""
                            aria-hidden="true"
                        />
                    )}

                    {showGoldforceDays && dayLabel !== null && (
                        <span className="card-number-slot">
                            <span
                                className="card-number"
                                role="img"
                                aria-label={`골드포스 잔여 ${days}일`}
                            >
                                {[...dayLabel].map((digit, index) => (
                                    <i
                                        key={index}
                                        aria-hidden="true"
                                        style={
                                            {
                                                '--offset': `${Number(digit) * -GLYPH_WIDTH}px`,
                                            } as CSSProperties
                                        }
                                    />
                                ))}
                            </span>
                        </span>
                    )}

                    {hasSkill && (
                        <span
                            className="card-rank"
                            role="img"
                            aria-label="아이템 스킬 적용"
                        />
                    )}

                    <span className="card-bevel">
                        {imageUrl ? (
                            <img
                                className="item-art"
                                src={imageUrl}
                                alt={name}
                                draggable={false}
                            />
                        ) : (
                            <span
                                className="item-art item-frame__placeholder"
                                role="img"
                                aria-label={name}
                            >
                                <TbPhotoOff aria-hidden className="size-6" />
                            </span>
                        )}
                    </span>
                </span>
            </div>

            {overlay ? (
                <div className="item-frame__overlay">{overlay}</div>
            ) : null}
        </div>
    )
}

export default ItemFrame
