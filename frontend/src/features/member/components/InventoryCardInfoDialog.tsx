import { useEffect, useRef } from 'react'
import { TbId, TbX } from 'react-icons/tb'
import ItemFrame from '@/features/item/components/ItemFrame'
import {
    goldforceRemainingDays,
    resolveFrameType,
} from '@/features/item/components/frame'
import {
    resolveSkillSlots,
    skillLabelOf,
} from '@/features/item/components/skillSlots'
import { itemArt } from '@/features/item/lib/itemArt'
import { toElementKey, elementLabelOf } from '@/features/item/lib/element'
import { subGroupLabelOf, decodeTypeCode } from '@/features/item/lib/itemCode'
import { channelLimitOf } from '@/features/shop/lib/channelLimit'
import type { InventoryItem } from '@/lib/api/inventory'
import '@/features/shop/components/ShopCardInfoDialog.css'

/**
 * 인벤토리 카드정보 모달 — **아이템 마켓 `ShopCardInfoDialog` 와 동일 구조**(FC-178 · 승인 목업
 * `sell-flow-mockup.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **마켓 카드정보 모달의 구조·스타일을 그대로 계승**한다 — 헤더(카드정보 CARD INFO) → 썸네일 +
 *   속성표(타입·명칭·채널제한·속성·남은 골드 포스) → 특수 스킬. **CSS(`ShopCardInfoDialog.css`)를
 *   공유**해 클래스(`.shop-cardinfo*`)를 재사용하므로 마켓과 픽셀 단위로 같은 톤이다.
 * ★ 마켓과 다른 점: **판매자 행·판매가·구매확인 서브뷰가 없고**, 하단 CTA 가 **'판매 등록'** 이다
 *   (내 보유 아이템 → 마켓에 올린다). 클릭 시 부모가 `/sell?item=<itemInstancePublicId>` 로 이동한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **왜 공유가 아니라 CSS 재사용 파생인가**: 마켓 모달은 구매 뮤테이션·잔액·판매자·확인 서브뷰가
 *   본체와 얽혀 있어, 공통 컴포넌트로 추출하면 그 모든 props 를 인벤토리로 흘려야 하고 마켓 회귀
 *   위험이 커진다. 반대로 이 모달은 **읽기 전용 카드정보 + 단일 CTA** 라 훨씬 얇다. 그래서 구조·CSS
 *   만 계승한 **인벤토리 전용** 컴포넌트로 두고, 시각 정합은 CSS 공유로 보장한다(중복 최소).
 * ★ **모달 배선(초점 트랩·스크롤 잠금·Esc·backdrop mousedown·role=dialog)은 마켓 모달에서
 *   이식**했다. 열릴 때만 마운트되므로 초기화 effect 의존은 마운트(`[]`)뿐이다.
 * ★ **데이터 매핑**: 요약(`summary`)은 4축을 `typeCode` 로 싣는다(계약 §4.2) → `decodeTypeCode` 로
 *   분해한다. 채널제한은 계약에 없어 `level` 로부터 표시 파생한다(`channelLimitOf` — 표시 전용, 마켓
 *   모달과 동일 파생). 스킬명은 요약에 없어(코드만) 중립 표기(`스킬 #코드`)로 폴백한다.
 */

interface InventoryCardInfoDialogProps {
    item: InventoryItem
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
    /** 판매 등록 — 부모가 `/sell?item=<itemInstancePublicId>` 로 이동한다. */
    onSell: (item: InventoryItem) => void
    onClose: () => void
}

function InventoryCardInfoDialog({
    item,
    now,
    onSell,
    onClose,
}: InventoryCardInfoDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    /** 최신 onClose — effect 의존에서 빼기 위한 콜백 ref */
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    // ── 초점 트랩 · 스크롤 잠금 · Esc(ShopCardInfoDialog 이식) ────────────────
    useEffect(() => {
        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusRaf = requestAnimationFrame(() => closeRef.current?.focus())

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCloseRef.current()
                return
            }
            if (event.key !== 'Tab') return

            const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            )
            if (!focusables || focusables.length === 0) return

            const list = Array.from(focusables).filter(
                (el) => !el.hasAttribute('disabled') && !el.closest('[inert]'),
            )
            const first = list[0]
            const last = list[list.length - 1]
            const active = document.activeElement

            if (event.shiftKey && active === first) {
                event.preventDefault()
                last?.focus()
            } else if (!event.shiftKey && active === last) {
                event.preventDefault()
                first?.focus()
            }
        }
        document.addEventListener('keydown', onKeyDown)

        return () => {
            cancelAnimationFrame(focusRaf)
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previousOverflow
            previousFocusRef.current?.focus()
        }
    }, [])

    const { summary } = item
    const referenceNow = now ?? Date.now()
    const axes = decodeTypeCode(summary.typeCode)
    const isGoldforce =
        resolveFrameType(
            { goldforceExpireAt: summary.goldforceExpireAt },
            referenceNow,
        ) === 'GOLDFORCE'
    const frameLabel = isGoldforce ? '골드' : '블랙'
    const typeLine = `${frameLabel} - ${subGroupLabelOf(axes.subGroup)}`
    const channelLimit = channelLimitOf(summary.level)
    const elementLabel = elementLabelOf(axes.element)
    const elementKey = toElementKey(axes.element)
    const goldforceDays = goldforceRemainingDays(
        summary.goldforceExpireAt,
        referenceNow,
    )
    const art = itemArt(
        {
            subGroup: axes.subGroup,
            kind: axes.kind,
            element: axes.element,
            level: summary.level,
        },
        'l',
        2,
    )
    // 스킬명은 인벤토리 요약에 없다 → 이름 없이 코드만 → 중립 표기(`스킬 #코드`).
    const skills = resolveSkillSlots(summary.skill1Code, summary.skill2Code)

    return (
        <div
            className="shop-cardinfo-overlay"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="inventoryCardInfoTitle"
                className="shop-cardinfo"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="ci-title">
                    <span aria-hidden className="ci-mark">
                        <TbId className="size-[18px]" />
                    </span>
                    <h2 id="inventoryCardInfoTitle">
                        카드정보 <small>CARD INFO</small>
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        className="ci-x"
                        aria-label="닫기"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-4" />
                    </button>
                </div>

                <div className="ci-scroll">
                    <div className="ci-head">
                        <div className="ci-thumb">
                            <ItemFrame
                                fill
                                showGoldforceDays
                                size="stage"
                                imageUrl={art?.src}
                                spriteUrl={art?.src}
                                name={summary.displayName}
                                visual={{
                                    goldforceExpireAt:
                                        summary.goldforceExpireAt,
                                }}
                                hasSkill={skills.length > 0}
                                now={now}
                                className="[--art-scale:2]"
                            />
                        </div>

                        <dl className="ci-attrs">
                            <div className="ci-row">
                                <dt className="k">타입</dt>
                                <dd className="v">{typeLine}</dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">명칭</dt>
                                <dd className="v">{summary.displayName}</dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">채널제한</dt>
                                <dd className="v">{channelLimit}</dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">속성</dt>
                                <dd
                                    className={`v ${elementKey ? `el-${elementKey}` : ''}`.trim()}
                                >
                                    {elementLabel}
                                </dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">남은 골드 포스</dt>
                                <dd
                                    className={`v ${goldforceDays ? '' : 'gf-off'}`.trim()}
                                >
                                    {goldforceDays
                                        ? `${goldforceDays}일`
                                        : '없음'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* 특수 스킬 — 탭 없이 직접 노출(마켓 모달과 동일) */}
                    <div className="ci-panel">
                        <h3>특수 스킬</h3>
                        {skills.length > 0 ? (
                            <ul className="skill-list" aria-label="특수 스킬">
                                {skills.map((skill) => {
                                    const showPercent =
                                        skill.slot === 2 &&
                                        summary.skillPercent > 0
                                    return (
                                        <li key={skill.slot}>
                                            <span aria-hidden className="n">
                                                {skill.slot}
                                            </span>
                                            <span>
                                                {skillLabelOf(skill)}
                                                {showPercent && (
                                                    <span className="pct">
                                                        {' '}
                                                        ({summary.skillPercent}
                                                        %)
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <p className="muted-note">
                                보유한 특수 스킬이 없습니다.
                            </p>
                        )}
                    </div>
                </div>

                {/* 하단 액션: 안내 + '판매 등록'(판매자·판매가·구매확인 없음) */}
                <div className="ci-foot">
                    <p className="min-w-0 text-[13px] font-medium leading-snug text-gray-500">
                        내 인벤토리 아이템입니다. 판매 등록으로 마켓에
                        올려보세요.
                    </p>
                    <button
                        type="button"
                        className="ci-buy"
                        onClick={() => onSell(item)}
                    >
                        판매 등록
                    </button>
                </div>
            </div>
        </div>
    )
}

export default InventoryCardInfoDialog
