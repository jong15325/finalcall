import { TbWallet } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 지갑(표시+교환) — 빈 셸(FC-075에서 잔액·교환 구현, 충전은 자리만). */
export default function WalletPage() {
    return (
        <PlaceholderView
            variant="shell"
            icon={TbWallet}
            title="지갑"
            description="잔액 표시·코드 교환이 이 자리에 들어옵니다. (충전은 준비 중)"
            ticket="FC-075에서 구현"
        />
    )
}
