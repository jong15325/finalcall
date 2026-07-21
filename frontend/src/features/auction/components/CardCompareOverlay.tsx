import CompareToggle from '@/features/item/components/CompareToggle'
import {
    useCompareFull,
    useCompareStore,
    useIsCompared,
} from '@/store/compareStore'

/**
 * 카드 비교 담기 오버레이 (FC-079).
 *
 * ★ **경매 카드 두 종(가로형 `AuctionCard`·세로형 `AuctionPreviewCard`)이 공유**한다 —
 *   토글을 스토어에 잇는 배선이 같아 한 곳에 둔다. FC-068 `CompareToggle`(controlled) 을
 *   `useCompareStore` 에 연결하고, `pressed`=담김 여부·`disabled`=미담김 & 가득참으로 파생한다.
 * ★ **카드 전체가 `<Link>` 라 클릭이 상세로 샌다.** 토글 클릭은 이 래퍼가 `preventDefault`
 *   (앵커 기본 이동 차단)+`stopPropagation`(Link onClick 차단)으로 가둔다 — 담기가 페이지
 *   이동을 일으키지 않는다.
 * ★ **이미지 크기 불변**(§3.1-4) — `ItemFrame` 의 `overlay` 층(이미지 DOM 밖)에 얹힐 뿐,
 *   아트 캔버스(72×134)를 건드리지 않는다.
 */

interface CardCompareOverlayProps {
    /** 경매 공개 ID(`auctionPublicId`) — 비교 참조의 listingId */
    listingId: string
    /** 접근성 라벨에 쓸 아이템 표시명 */
    name: string
}

function CardCompareOverlay({ listingId, name }: CardCompareOverlayProps) {
    const pressed = useIsCompared(listingId)
    const full = useCompareFull()
    const toggle = useCompareStore((state) => state.toggle)

    return (
        <span
            // 담기 클릭이 카드 상세 이동을 일으키지 않도록 여기서 가둔다(위 ★).
            onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
            }}
        >
            <CompareToggle
                pressed={pressed}
                // 가득 찬 상태에서 미담김 카드만 막는다 — 담긴 카드는 빼기가 되어야 한다.
                disabled={!pressed && full}
                label={
                    pressed ? `${name} 비교에서 빼기` : `${name} 비교에 담기`
                }
                onToggle={() => toggle({ source: 'AUCTION', listingId })}
            />
        </span>
    )
}

export default CardCompareOverlay
