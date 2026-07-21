import { useParams } from 'react-router'
import { TbBox } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 보유 아이템 인스턴스 상세 — 빈 셸(FC-076에서 스킬 이름 포함 상세 구현). */
export default function ItemDetailPage() {
    const { id } = useParams()
    return (
        <PlaceholderView
            variant="shell"
            icon={TbBox}
            title="아이템 상세"
            description={`아이템 ${id ?? ''} 상세(스킬 이름 포함)가 이 자리에 들어옵니다.`}
            ticket="FC-076에서 구현"
        />
    )
}
