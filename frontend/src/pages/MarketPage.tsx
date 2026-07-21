import { TbBuildingStore } from 'react-icons/tb'
import ComingSoonScaffold from '@/components/common/ComingSoonScaffold'

/**
 * 고정가 아이템 마켓 `/market` — [준비 중] ShopController 미구현(rebuild-contract-map §5).
 *
 * ★ 목업 `market()` 헤더 골격(툴바 + 상품 그리드)만 비활성 skeleton 으로 남긴다.
 *   `/shops`·`/market/*` 를 호출하지 않고 가짜 상품을 렌더하지 않는다(정직성·FC-048).
 */
export default function MarketPage() {
    return (
        <ComingSoonScaffold
            icon={TbBuildingStore}
            title="아이템 마켓"
            description="고정가로 등록된 게임 아이템을 사고파는 공간이에요."
            note="고정가 마켓은 준비 중이에요. 지금은 실시간 경매를 이용해 주세요."
        >
            {/* 툴바 자리(필터·정렬) */}
            <div className="mb-4 flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-8 w-20 rounded-full bg-gray-100"
                    />
                ))}
            </div>
            {/* 상품 그리드 자리 */}
            <div className="grid grid-cols-2 gap-3 xs:grid-cols-3 md:grid-cols-6">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
                    >
                        <div className="aspect-square bg-gray-100" />
                        <div className="flex flex-col gap-1.5 p-3">
                            <div className="h-3 w-3/4 rounded bg-gray-100" />
                            <div className="h-3 w-1/2 rounded bg-gray-100" />
                        </div>
                    </div>
                ))}
            </div>
        </ComingSoonScaffold>
    )
}
