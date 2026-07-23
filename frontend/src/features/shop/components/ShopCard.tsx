import { Link } from 'react-router'
import { marketDetailPath } from '@/app/paths'
import ItemCard from '@/features/item/components/ItemCard'
import CardCompareOverlay from '@/features/auction/components/CardCompareOverlay'
import type { ShopSummary } from '@/lib/api/shop'

/**
 * 고정가 마켓 카드 — **세로형 + 상세 링크**(FC-094 · 목업 §9 공통 카드).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **카드 → 상세 → 구매로 통일**(게이트 결정 2026-07-22) — 경매 카드(→상세→입찰)와 동일 UX.
 * ══════════════════════════════════════════════════════════════════════════════
 * 카드 전체가 마켓 상세(`/market/:id`)로 가는 링크다. 구매는 카드에서 직접 열지 않고 상세의 "바로
 * 구매"에서 한다(경매 대칭). **비교 토글만 카드에 남는다**(overlay, 이미지 DOM 밖 층 — §3.1-4).
 *
 * ★ 세로 공통 카드(`ItemCard`, §3.1 "아이템 마켓의 아이템 영역을 공통 기준")를 링크로 감싼다.
 *   비교 클릭은 `CardCompareOverlay` 가 `stopPropagation` 해 링크 이동을 막는다(경매 카드와 동일).
 * ★ **가격 = `shop.price`**(고정가) — 라벨 없이 축약값만(목업 카드 정합, §3.3 목록 축약).
 * ★ 비교 출처는 `MARKET` — 경매와 혼합 비교(compareSession, 목업 §11).
 */

interface ShopCardProps {
    shop: ShopSummary
    /** 골드포스 파생 기준 시각(목록 단일 타이머 주입) */
    now: number
}

function ShopCard({ shop, now }: ShopCardProps) {
    return (
        <div className="shop-card group relative rounded-xl transition-transform hover:-translate-y-[3px]">
            <ItemCard
                skillFlip
                item={shop.item}
                price={shop.price}
                now={now}
                sellerNickname={shop.sellerNickname}
            />
            <Link
                to={marketDetailPath(shop.shopPublicId)}
                aria-label={`${shop.item.nameSnapshot} 상세 보기`}
                className="absolute inset-x-0 bottom-0 top-[252px] z-[5] rounded-b-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
            />
            <div className="absolute right-1.5 top-1.5 z-20">
                <CardCompareOverlay
                    source="MARKET"
                    listingId={shop.shopPublicId}
                    name={shop.item.nameSnapshot}
                />
            </div>
        </div>
    )
}

export default ShopCard
