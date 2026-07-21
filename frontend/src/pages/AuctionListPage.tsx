import { TbGavel } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 실시간 경매 목록 — 빈 셸(FC-071에서 커서 목록·필터 구현). */
export default function AuctionListPage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbGavel}
            title="실시간 경매"
            description="경매 카드 목록·필터·무한스크롤이 이 자리에 들어옵니다."
            ticket="FC-071에서 구현"
        />
    )
}
