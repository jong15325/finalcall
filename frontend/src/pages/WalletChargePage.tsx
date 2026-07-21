import { TbCreditCard } from 'react-icons/tb'
import PlaceholderView from '@/components/common/PlaceholderView'

/** 코드 충전 — [준비 중] 결제(/charges) 미구현(rebuild-contract-map §5). */
export default function WalletChargePage() {
    return (
        <PlaceholderView
            variant="coming-soon"
            icon={TbCreditCard}
            title="코드 충전"
            description="결제 연동은 준비 중입니다."
        />
    )
}
