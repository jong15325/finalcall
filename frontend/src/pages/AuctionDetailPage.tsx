import { useParams } from 'react-router'
import { TbGavel } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 경매 상세·입찰 — 빈 셸(FC-072에서 상세·입찰 시트 구현). */
export default function AuctionDetailPage() {
    const { id } = useParams()
    return (
        <PlaceholderView
            variant="shell"
            icon={TbGavel}
            title="경매 상세"
            description={`경매 ${id ?? ''} 상세·입찰 시트가 이 자리에 들어옵니다.`}
            ticket="FC-072에서 구현"
        />
    )
}
