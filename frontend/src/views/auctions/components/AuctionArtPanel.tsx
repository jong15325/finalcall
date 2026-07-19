import { useRef, useState } from 'react'
import { PiMagnifyingGlassPlusDuotone } from 'react-icons/pi'
import Sheet from '@/components/shared/Sheet'
import GoldforceChip from '@/features/item/components/GoldforceChip'
import ItemArtSlot from '@/features/item/components/ItemArtSlot'
import { isGoldforceActive } from '@/features/item/lib/goldforce'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import { useNow } from '@/features/auction/lib/useNow'
import type { AuctionDetail } from '@/lib/api/auctions'

/**
 * 아트 패널 + 확대 라이트박스 (FC-064).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **라이트박스에는 아트와 정체성 한 줄만 넣는다 — 스펙·탭·거래 액션을 넣지 마라.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 게임 카드정보 모달은 폐기됐다. Baymard 가 **스펙 중심 상품에 퀵뷰를 만들지 말라**고
 * 명시하는데, 그 이유가 여기 그대로 해당한다 — **페이지가 이미 스펙을 전부 보여주고 있다.**
 * 모달이 같은 것을 다시 보여주면 사용자는 어느 쪽이 최신인지 묻게 되고, 거래 액션까지 넣으면
 * **입찰 경로가 둘**이 되어 마감 판정·에러 처리를 두 곳에서 관리하게 된다.
 * 그래서 이 모달의 존재 이유는 하나다 — **50×93 원본 아트를 크게 본다.**
 *
 * ★ 아웃라인(`design-system.md §5.12`)은 `ItemArtSlot` 이 갖는다. 여기서 다시 그리지 않는다.
 *
 * ★★ **확대는 정수배로만 한다.** `scale` 을 `ItemArtSlot` 에 넘기면 `image-rendering: pixelated`
 *    와 짝을 이뤄 도트가 뭉개지지 않는다. CSS `transform: scale()` 로 키웠다면 비정수 배율이
 *    섞여 원본 픽셀 격자가 깨진다(FC-058 이 카드에서 겪은 파손과 같은 종류).
 */

interface AuctionArtPanelProps {
    auction: AuctionDetail
}

const AuctionArtPanel = ({ auction }: AuctionArtPanelProps) => {
    const now = useNow()
    const [zoomed, setZoomed] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)

    const { item } = auction
    const goldforce = isGoldforceActive(item.goldforceExpireAt, now)
    const typeLabel = itemTypeLabel(item.subGroup, item.kind)

    return (
        <div className="flex min-w-0 flex-col items-center gap-3">
            {/*
             * ★ 아트 전체가 버튼이다 — 좁은 화면에서 작은 돋보기 아이콘만 표적으로 두면
             *   누르기 어렵다. `aria-label` 이 무슨 일이 일어나는지 말한다(아이콘만으로는 모른다).
             */}
            <button
                ref={triggerRef}
                aria-label={`${item.nameSnapshot} 아트 크게 보기`}
                className="group relative rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
                data-testid="auction-art-zoom-trigger"
                type="button"
                onClick={() => setZoomed(true)}
            >
                <ItemArtSlot
                    showLevel
                    className="w-full p-4 sm:p-6"
                    goldforce={goldforce}
                    item={item}
                    name={item.nameSnapshot}
                    scale={3}
                    scaleNarrow={2}
                />
                <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg bg-gray-900/80 text-base text-white transition-opacity duration-150 group-hover:bg-gray-900 dark:bg-gray-950/80"
                >
                    <PiMagnifyingGlassPlusDuotone />
                </span>
            </button>

            {goldforce && <GoldforceChip />}

            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                {typeLabel}
            </p>

            <Sheet
                closeLabel="아트 닫기"
                data-testid="auction-art-lightbox"
                open={zoomed}
                placement="center"
                title={item.nameSnapshot}
                triggerRef={triggerRef}
                onClose={() => setZoomed(false)}
            >
                <div className="flex flex-col items-center gap-3">
                    {/*
                     * ★ 슬롯 여백이 `p-2` 에서 시작한다 — **320px 실측 때문이다.**
                     *   라이트박스 패널은 `inset-x-4`(288px) · 본문 `px-4`(256px)이고,
                     *   4배 프레임이 218px(아트 200 + 링 8 + 베벨 8)이다. 여백을 `p-4` 로 두면
                     *   250px 이라 남는 폭이 6px 뿐이라 반올림 한 번에 잘린다. `p-2` 면 234px
                     *   (여유 22px). 넓은 화면에서는 여백을 되돌린다.
                     */}
                    <ItemArtSlot
                        className="p-2 sm:p-4"
                        goldforce={goldforce}
                        item={item}
                        name={item.nameSnapshot}
                        scale={5}
                        scaleNarrow={4}
                    />
                    {/* 정체성 한 줄 — 스펙이 아니라 "이게 무엇인가" 다. */}
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                        {typeLabel} · Lv.{item.level}
                    </p>
                </div>
            </Sheet>
        </div>
    )
}

export default AuctionArtPanel
