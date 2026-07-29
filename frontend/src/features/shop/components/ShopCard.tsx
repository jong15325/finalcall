import { memo } from 'react'
import ItemCard from '@/features/item/components/ItemCard'
import CardCompareOverlay from '@/features/auction/components/CardCompareOverlay'
import type { ShopSummary } from '@/lib/api/shop'

/**
 * 고정가 마켓 카드 — **세로형 + 카드정보 구매 모달**(FC-146 · 목업 §9 공통 카드).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **카드 클릭 → 카드정보 구매 모달로 바로 구매**(FC-146 디자인 게이트 승인) — 상세페이지
 *   네비게이션을 모달로 대체한다. 목록 스크롤을 보존하고 여러 카드를 빠르게 열고 닫으며 구매한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **카드 영역 전체가 모달을 여는 버튼**이다(FC-146 라이브 리뷰) — 이미지·정보영역을 통째로 덮는
 *   단일 오버레이 버튼(`absolute inset-0`)을 카드 루트에 얹어, 어디를 눌러도 카드정보 모달이 열린다.
 *   예전엔 정보영역만 열기 버튼이라 이미지 클릭은 무반응이었다. 카드 이미지 영역은 hover/터치로
 *   스킬 뒷면을 보이지만(플립, CSS `:hover`·`data-flipped`), 플립은 이 오버레이 밑에서도 동작한다
 *   (`.shop-card:hover` 로 트리거 — 오버레이가 그 자손이라 hover 가 유지된다).
 * ★ **중복 트리거 방지**: 열기 오버레이(z-10)와 비교 토글(z-20)은 형제 층이라 클릭이 서로 버블링되지
 *   않는다. 비교 토글은 자체 `stopPropagation` 도 갖는다. 카드 안 다른 링크/버튼은 없다.
 * ★ **가격 = `shop.price`**(고정가) — 라벨 없이 축약값만(목업 카드 정합, §3.3 목록 축약).
 * ★ 비교 출처는 `MARKET` — 경매와 혼합 비교(compareSession, 목업 §11).
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
//    얕은 비교로 충분하다. 비교 하이라이트는 자식 CardCompareOverlay 가 스토어를 직접 구독하므로
//    memo 와 무관하게 갱신된다.
function ShopCard({ shop, now, onOpen }: ShopCardProps) {
    return (
        <div className="shop-card group relative rounded-xl transition-transform hover:-translate-y-[3px]">
            <ItemCard
                skillFlip
                item={shop.item}
                price={shop.price}
                now={now}
                sellerNickname={shop.sellerNickname}
            />
            {/* 카드 영역 전체 열기 버튼 — 이미지·정보영역을 통째로 덮는다(비교 토글 z-20 은 위층). */}
            <button
                type="button"
                aria-label={`${shop.item.nameSnapshot} 카드정보 보기`}
                className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
                onClick={() => onOpen(shop)}
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

export default memo(ShopCard)
