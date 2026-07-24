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
 * 카드 이미지 영역은 hover/터치로 스킬 뒷면을 보이고(플립), **이미지 아래 정보영역이 상세
 * (`/market/:id`) 링크**다 — 링크를 정보영역 컨테이너 안에 두어(레이아웃 기반) 이미지 플립 영역을
 * 덮지 않는다(M2, 절대위치 top 오프셋 매직넘버 제거). 구매는 카드에서 직접 열지 않고 상세의 "바로
 * 구매"에서 한다(경매 대칭). **비교 토글은 이미지 위 상위 레이어**(overlay, 이미지 DOM 밖 층 — §3.1-4).
 *
 * ★ 세로 공통 카드(`ItemCard`, §3.1 "아이템 마켓의 아이템 영역을 공통 기준")에 상세 링크를
 *   정보영역 오버레이(`detailLink`)로 주입한다. 비교는 이미지 위 별도 층이라 상세 링크와 겹치지 않는다.
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
                detailLink={
                    <Link
                        to={marketDetailPath(shop.shopPublicId)}
                        aria-label={`${shop.item.nameSnapshot} 상세 보기`}
                        className="absolute inset-0 z-[5] rounded-b-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
                    />
                }
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
