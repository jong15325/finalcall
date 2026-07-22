import ItemCard from '@/features/item/components/ItemCard'
import CardCompareOverlay from '@/features/auction/components/CardCompareOverlay'
import type { ShopSummary } from '@/lib/api/shop'

/**
 * 고정가 마켓 카드 — **세로형**(FC-094 · 목업 `market()` `.item-card` 1:1).
 *
 * 목업 §9 대로 **공통 세로 카드**(`ItemCard`, §3.1 "아이템 마켓의 아이템 영역을 공통 기준")에
 * 두 액션을 얹는다 — 프레임 위 **비교 토글**(overlay)과 카드 하단 **구매 버튼**(footer). 아이템
 * 이미지 DOM 은 건드리지 않는다(§3.1-4). 2/3/6 그리드는 상위(`MarketPage`)가 잡는다.
 *
 * ★ **가격 = `shop.price`**(고정가) — 경매의 "시작가/현재가" 구분이 없다. 라벨 없이 값만 낸다
 *   (목업 카드가 코인 아이콘 + 축약값만 보이는 것과 정합, §3.3 목록 축약).
 * ★ **자기 상품·판매 종료는 구매 버튼을 표시 제어로 잠근다**(§18 비활성) — 단, 표시 제어는
 *   인가가 아니므로 최종 판정은 구매 응답(SHOP_004·SHOP_006)이 한다(`shopErrors`).
 * ★ 비교 출처는 `MARKET` — 경매와 혼합 비교된다(compareSession, 목업 §11).
 */

interface ShopCardProps {
    shop: ShopSummary
    /** 골드포스 파생 기준 시각(목록 단일 타이머 주입) */
    now: number
    /** 내 닉네임(자기 상품 판정 — 표시 제어). 비로그인이면 null */
    myNickname: string | null
    /** 구매 다이얼로그 열기(상위 소관) */
    onBuy: (shop: ShopSummary) => void
}

function ShopCard({ shop, now, myNickname, onBuy }: ShopCardProps) {
    const isActive = shop.status === 'ACTIVE'
    const isOwn = myNickname !== null && myNickname === shop.sellerNickname
    const buyDisabled = !isActive || isOwn

    const buyLabel = !isActive ? '판매 종료' : isOwn ? '내 상품' : '구매'

    return (
        <ItemCard
            item={shop.item}
            price={shop.price}
            now={now}
            overlay={
                <CardCompareOverlay
                    source="MARKET"
                    listingId={shop.shopPublicId}
                    name={shop.item.nameSnapshot}
                />
            }
            footer={
                <button
                    type="button"
                    disabled={buyDisabled}
                    aria-label={`${shop.item.nameSnapshot} ${buyLabel}`}
                    className="w-full rounded-lg bg-navy px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    onClick={() => onBuy(shop)}
                >
                    {buyLabel}
                </button>
            }
        />
    )
}

export default ShopCard
