import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { TbTag, TbX } from 'react-icons/tb'
import ItemFrame from '@/features/item/components/ItemFrame'
import ItemSkillSummary from '@/features/item/components/ItemSkillSummary'
import { deriveItemSummaryArt } from '@/features/item/lib/itemSummary'
import { elementBadgeLabelOf } from '@/features/item/lib/element'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 아이템 상세 다이얼로그 (FC-177 — 승인 목업 `.sheet`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 인벤토리 슬롯 클릭 → 아이템 상세(프레임·이름·속성/종류/Lv·스킬) + **[판매하기]**.
 *   판매하기는 부모(`InventoryPage`)가 `/sell?item=<id>` 로 이동시킨다(URL 쿼리 정본).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **모달 배선(초점 트랩·스크롤 잠금·Esc·backdrop·role=dialog)은 `SellConfirmDialog` 에서
 *   이식**했다. 컴포넌트는 열릴 때만 마운트되므로 초기화 effect 의존은 마운트(`[]`)뿐이다.
 * ★ **반응형**: 웹=중앙 모달 / 모바일=하단 시트(`items-end sm:items-center`, 하단 라운드).
 * ★ 스킬명은 인벤토리 요약(계약 §4.2)에 없어 `ItemSkillSummary` 가 코드→중립 표기로 폴백한다
 *   (마켓 상세와 달리 skill1Name/skill2Name 없음 — 기존 슬롯 플립과 동일 데이터).
 */

interface InventoryItemDialogProps {
    item: InventoryItem
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
    /** 판매하기 — 부모가 `/sell?item=<id>` 로 이동한다. */
    onSell: (item: InventoryItem) => void
    onClose: () => void
}

function InventoryItemDialog({
    item,
    now,
    onSell,
    onClose,
}: InventoryItemDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const sellRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    /** 최신 onClose — effect 의존에서 빼기 위한 콜백 ref */
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    // ── 초점 트랩 · 스크롤 잠금 · Esc(SellConfirmDialog 이식) ──────────────────
    useEffect(() => {
        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusRaf = requestAnimationFrame(() => sellRef.current?.focus())

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
                (el) => !el.hasAttribute('disabled'),
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

    const { art, axes, hasSkill } = deriveItemSummaryArt(item.summary)
    const name = item.summary.displayName

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/60 backdrop-blur-[2px] sm:items-center sm:px-4"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="inventoryItemTitle"
                className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-[0_30px_80px_rgba(17,26,44,0.33)] sm:max-w-[400px] sm:rounded-2xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <h2
                        id="inventoryItemTitle"
                        className="text-lg font-bold leading-snug text-gray-900"
                    >
                        {name}
                    </h2>
                    <button
                        type="button"
                        aria-label="닫기"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </div>

                <div className="flex gap-4 px-5 py-5">
                    <span
                        className="item-sprite-stage flex h-[134px] w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line"
                        style={
                            art?.src
                                ? ({
                                      '--item-sprite': `url("${art.src}")`,
                                  } as CSSProperties)
                                : undefined
                        }
                    >
                        <ItemFrame
                            imageUrl={art?.src}
                            spriteUrl={art?.src}
                            name={name}
                            visual={{
                                goldforceExpireAt:
                                    item.summary.goldforceExpireAt,
                            }}
                            hasSkill={hasSkill}
                            size="frame"
                            now={now}
                        />
                    </span>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-md bg-surface-sunken px-2 py-1 text-[11px] font-bold text-navy">
                                {elementBadgeLabelOf(axes.element)}
                            </span>
                            <span className="rounded-md bg-navy px-2 py-1 text-[11px] font-bold text-white">
                                {itemTypeLabel(axes.subGroup, axes.kind)} · Lv.
                                {item.summary.level}
                            </span>
                        </div>
                        <div className="mt-3">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                                스킬
                            </span>
                            <ItemSkillSummary
                                showSlotLabels
                                skill1={item.summary.skill1Code}
                                skill2={item.summary.skill2Code}
                                skillPercent={item.summary.skillPercent}
                                emptyLabel="보유한 스킬이 없습니다"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-line bg-surface-sunken px-5 py-4">
                    <button
                        ref={sellRef}
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange px-5 py-3 text-sm font-bold text-white hover:bg-orange-deep"
                        onClick={() => onSell(item)}
                    >
                        <TbTag aria-hidden className="size-4" />
                        판매하기
                    </button>
                    <button
                        type="button"
                        className="w-full rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-bold text-gray-600 hover:border-navy hover:text-navy"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    )
}

export default InventoryItemDialog
