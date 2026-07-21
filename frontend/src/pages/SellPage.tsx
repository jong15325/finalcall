import { TbTag } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 아이템 판매(경매 등록) — 빈 셸(FC-073에서 등록 폼 구현). */
export default function SellPage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbTag}
            title="아이템 판매"
            description="경매 등록 폼이 이 자리에 들어옵니다."
            ticket="FC-073에서 구현"
        />
    )
}
