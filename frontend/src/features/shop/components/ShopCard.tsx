import { memo, useState } from 'react'
import ItemCardActionSurface from '@/features/item/components/ItemCardActionSurface'
import ItemCardFlip from '@/features/item/components/ItemCardFlip'
import ItemCardView, {
    ItemCardArtwork,
    ItemCardPropertyBackView,
} from '@/features/item/components/ItemCardView'
import { toItemCardViewModel } from '@/features/item/components/itemCardModel'
import CardCompareOverlay from '@/features/item/components/CardCompareOverlay'
import type { ShopSummary } from '@/lib/api/shop'

/**
 * 고정가 마켓 카드 — **세로형 + 카드정보 구매 모달**(FC-146 · 목업 §9 공통 카드).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **정본 카드 composition의 얇은 어댑터**. 카드 조립
 *   (`.shop-card` 래퍼·전면 오버레이 열기 버튼·비교 오버레이 층)은 타일이 소유하고, 이 어댑터는
 *   `ShopSummary` → 타일 props 매핑(가격·판매자·비교 슬롯)만 한다. FC-146 의 "카드 클릭 → 카드정보
 *   구매 모달" 은 `onOpen` 으로 타일에 전달된다(상세 네비게이션을 모달로 대체).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **가격 = `shop.price`**(고정가) — 라벨 없이 축약값만(목업 카드 정합, §3.3 목록 축약).
 * ★ 비교 출처는 `MARKET` — 경매와 혼합 비교(compareSession, 목업 §11). 담기 하이라이트는
 *   `CardCompareOverlay` 가 스토어를 직접 구독하므로 아래 `memo` 와 무관하게 갱신된다.
 */

interface ShopCardProps {
    shop: ShopSummary
    /**
     * 골드포스 파생 기준 시각(목록에서 마운트 시각 1회로 고정 주입).
     * 마켓 카드는 카운트다운이 없고 골드포스 잔여일은 일 단위라 매초 갱신이 불필요하다 —
     * 값이 안정적이라 아래 `memo` 가 유지된다(대량 목록 매초 리렌더 방지, FC-101).
     */
    now: number
    /**
     * 카드정보 구매 모달 열기(FC-146). 대량 목록 memo 유지를 위해 부모가 안정 참조
     * (`useCallback`)로 주입한다 — 매 카드가 같은 콜백을 공유하고 대상은 `shop` 으로 넘긴다.
     */
    onOpen: (shop: ShopSummary) => void
}

// ★ 5천 대량 목록에서 부모(MarketPage) 리렌더가 전 카드로 번지지 않게 memo 로 격리한다.
//    props(shop=react-query 캐시 안정 참조·now=마운트 고정·onOpen=useCallback)가 안정적이라
//    얕은 비교로 충분하다.
function ShopCard({ shop, now, onOpen }: ShopCardProps) {
    const [flipped, setFlipped] = useState(false)
    const item = toItemCardViewModel(shop.item, now, {
        price: { amount: shop.price },
        seller: shop.sellerNickname,
    })
    const compare = (
        <CardCompareOverlay
            source="MARKET"
            listingId={shop.shopPublicId}
            name={shop.item.nameSnapshot}
        />
    )
    const action = {
        kind: 'button' as const,
        label: `${item.name} 카드정보 보기`,
        onPress: () => onOpen(shop),
    }
    const artworkAction = (
        <ItemCardActionSurface
            area="artwork"
            keyboard={false}
            action={action}
        />
    )
    const controlGapAction = (
        <ItemCardActionSurface
            area="control-gap"
            keyboard={false}
            action={action}
        />
    )

    return (
        <div className="shop-card group relative rounded-xl transition-transform hover:-translate-y-[3px]">
            <ItemCardView
                density="compact"
                item={item}
                artwork={
                    item.skills.length > 0 ? (
                        <ItemCardFlip
                            back={<ItemCardPropertyBackView item={item} />}
                            contentLabel="아이템 정보"
                            flipped={flipped}
                            front={<ItemCardArtwork item={item} />}
                            interaction="hover-latch"
                            label={item.name}
                            overlay={compare}
                            onFlippedChange={setFlipped}
                        />
                    ) : (
                        <div className="item-card__artwork-composition">
                            <div className="item-card__skill-flip is-market">
                                <ItemCardArtwork item={item} />
                            </div>
                            <div className="item-card__artwork-controls">
                                <div className="item-card__control-gap">
                                    {controlGapAction}
                                </div>
                                <div
                                    className="item-card__secondary-actions"
                                    data-card-hit-area="compare"
                                >
                                    {compare}
                                </div>
                            </div>
                            {artworkAction}
                        </div>
                    )
                }
                action={<ItemCardActionSurface opensDialog action={action} />}
            />
        </div>
    )
}

export default memo(ShopCard)
