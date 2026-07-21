import { TbSmartHome } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 홈 — 빈 셸(FC-070에서 경매 프리뷰·추천 구현). */
export default function HomePage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbSmartHome}
            title="홈"
            description="경매 마감 임박·추천 아이템 프리뷰가 이 자리에 들어옵니다."
            ticket="FC-070에서 구현"
        />
    )
}
