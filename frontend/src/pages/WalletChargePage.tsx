import { TbCreditCard } from 'react-icons/tb'
import ComingSoonScaffold from '@/components/common/ComingSoonScaffold'
import { useAppFooterVariant } from '@/components/layout/AppFooterContext'

/**
 * 코드 충전 `/wallet/charge` — [준비 중] 결제(`/charges`·Toss) 미구현(rebuild-contract-map §5).
 *
 * ★ 목업 `payment()` 헤더 골격(충전 금액 선택 + 결제 버튼)만 비활성 skeleton 으로 남긴다.
 *   `/charges`·Toss 승인을 호출하지 않고 결제창을 띄우지 않는다(정직성·FC-048).
 */
export default function WalletChargePage() {
    useAppFooterVariant('compact')

    return (
        <ComingSoonScaffold
            icon={TbCreditCard}
            title="코드 충전"
            description="결제로 코드를 충전하는 기능이에요."
            note="결제 연동은 준비 중이에요."
        >
            {/* 충전 금액 선택 자리 */}
            <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-14 rounded-xl border border-line bg-gray-50"
                    />
                ))}
            </div>
            {/* 결제 버튼 자리 */}
            <div className="mt-4 h-11 rounded-xl bg-gray-100" />
        </ComingSoonScaffold>
    )
}
