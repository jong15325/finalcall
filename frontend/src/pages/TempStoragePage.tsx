import { TbArchive } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 임시 보관함 — 빈 셸(FC-076에서 보관·재배치 구현). */
export default function TempStoragePage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbArchive}
            title="임시 보관함"
            description="임시 보관 아이템·재배치가 이 자리에 들어옵니다."
            ticket="FC-076에서 구현"
        />
    )
}
