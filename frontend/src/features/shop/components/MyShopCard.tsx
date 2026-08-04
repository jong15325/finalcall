import CodeAmount from '@/components/common/CodeAmount'
import ItemCard from '@/features/item/components/ItemCard'
import type { MyShopSummary } from '@/lib/api/shop'

/**
 * 내 판매 카드 — 마이페이지 '내 판매' 섹션 (FC-096 · 계약 §3.2 `GET /me/shops`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **마켓 카드와 같은 공통 카드(`ItemCard`)를 재사용**한다(디자인 게이트 충족 — 승인된 마켓
 *   그리드 재사용, 신규 비주얼 창작 없음). 공개 `ShopCard` 와 달리 **비교 오버레이·상세 링크 대신
 *   판매자용 액션(예상 정산액 + 내리기)** 을 `footer` 로 얹는다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **링크로 감싸지 않는다** — footer 의 '내리기' 버튼과 중첩 인터랙션(링크 안의 버튼)을 피한다.
 *   이곳은 탐색이 아니라 관리 화면이다.
 * ★ **등록가**는 body(`price={{ amount, label: '등록가' }}`), **예상 정산액**은 footer 에 표기한다. 정산액은
 *   실현값이 아니라 예상치이므로(shop-spec §10.3) 라벨에 "예상"을 명시한다. 금액은 `CodeAmount`
 *   (aria 는 항상 전체값 + 코드) — 코드화폐 표기 규율.
 */
interface MyShopCardProps {
    shop: MyShopSummary
    /** 골드포스 파생 기준 시각(목록 단일 타이머 주입) */
    now: number
    /** 이 리스팅 내리기 요청(확인 다이얼로그 오픈) */
    onCancel: (shop: MyShopSummary) => void
    /** 이 카드가 취소 진행 중이면 버튼 비활성 */
    isCancelling: boolean
}

function MyShopCard({ shop, now, onCancel, isCancelling }: MyShopCardProps) {
    return (
        <ItemCard
            item={shop.item}
            price={{ amount: shop.price, label: '등록가' }}
            now={now}
            footer={
                <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                        <span className="text-[11px] text-gray-500 xs:text-xs">
                            예상 정산액
                        </span>
                        <CodeAmount
                            value={shop.estimatedSettle}
                            mode="compact"
                            className="text-[13px] font-bold text-navy xs:text-sm"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={isCancelling}
                        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-gray-600 hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => onCancel(shop)}
                    >
                        {isCancelling ? '내리는 중…' : '내리기'}
                    </button>
                </div>
            }
        />
    )
}

export default MyShopCard
