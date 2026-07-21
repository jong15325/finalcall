import { TbBuildingStore } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 고정가 아이템 마켓 — [준비 중] ShopController 미구현(rebuild-contract-map §5). */
export default function MarketPage() {
    return (
        <PlaceholderView
            variant="coming-soon"
            icon={TbBuildingStore}
            title="아이템 마켓"
            description="고정가 거래는 준비 중입니다. 지금은 실시간 경매를 이용해 주세요."
        />
    )
}
