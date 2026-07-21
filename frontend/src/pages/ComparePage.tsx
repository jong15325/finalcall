import { TbScale } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 아이템 비교 — 빈 셸(FC-077에서 클라 비교표 구현). */
export default function ComparePage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbScale}
            title="아이템 비교"
            description="선택한 아이템 비교표가 이 자리에 들어옵니다. (스킬 데이터는 코드 중립표기)"
            ticket="FC-077에서 구현"
        />
    )
}
