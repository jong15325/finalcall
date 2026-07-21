import { TbUserCircle } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 마이페이지 통합 홈 — 빈 셸(FC-074에서 프로필·설정 구현). */
export default function MePage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbUserCircle}
            title="마이페이지"
            description="프로필·설정·거래 요약이 이 자리에 들어옵니다."
            ticket="FC-074에서 구현"
        />
    )
}
