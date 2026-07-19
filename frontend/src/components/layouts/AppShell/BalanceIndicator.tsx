import Skeleton from '@/components/ui/Skeleton'
import classNames from '@/utils/classNames'
import { useMyBalance } from '@/lib/queries/balance'

/**
 * 셸 잔액 표시 (계약 §4.4 `GET /me/balance`) — FC-057.
 *
 * ★ **`variant` 는 반응형 접기가 아니라 서로 다른 정보 밀도다.**
 *   - `full`(데스크톱 1행): 캐시 + 게임머니 **두 축**. 가로 여유가 있어 둘 다 라벨과 함께 선다.
 *   - `compact`(모바일 헤더): 게임머니 **가용액 하나**. 모바일에서 지금 당장 답이 필요한 질문은
 *     "얼마짜리까지 입찰할 수 있나"이고, 그 답은 캐시가 아니라 가용 게임머니다.
 *     캐시는 탭바 `MY` 로 들어가면 나온다.
 *
 * ★★ **`gameMoneyAvailable` 을 "게임머니"라고 부르지 않는다.** 그 이름표를 붙이면 입찰 홀드로
 *    묶인 금액만큼 **잔액이 줄어든 것처럼 보인다**. 라벨은 "게임머니 가용"이고, 보유·홀드
 *    내역은 스크린리더용 문장으로 함께 준다.
 *
 * ★ §1.2 Game-Color Containment — 여기에 element 색·게임 색이 **하나도 없다.** 금액은
 *   near-black 활자와 tabular 숫자만으로 읽힌다.
 */

interface BalanceIndicatorProps {
    variant?: 'full' | 'compact'
    className?: string
}

const won = new Intl.NumberFormat('ko-KR')

/** 라벨은 작게·자간 넓게, 값은 크게·자간 좁게(design-system [3.1]). */
const LABEL_CLASS =
    'text-[11px] leading-none tracking-wide text-gray-500 dark:text-gray-400'
const VALUE_CLASS =
    'text-sm leading-none font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-100'

const BalanceFigure = ({ label, value }: { label: string; value: number }) => (
    <div className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{label}</span>
        <span className={VALUE_CLASS}>{won.format(value)}</span>
    </div>
)

const BalanceIndicator = ({
    variant = 'full',
    className,
}: BalanceIndicatorProps) => {
    const { data, isPending, isError } = useMyBalance()

    /*
     * 실패는 조용히 사라진다 — 셸의 잔액은 보조 정보다. 헤더에 에러 배너를 띄우면 전 화면에
     * 상시로 붙어 **정작 그 화면의 에러를 덮는다**. 잔액이 필요한 조작(입찰·구매)은 자기
     * 화면에서 자기 에러를 낸다.
     */
    if (isError) return null

    if (isPending) {
        return (
            <div className={classNames('flex items-center gap-4', className)}>
                <Skeleton
                    className="h-6"
                    width={variant === 'full' ? 132 : 64}
                />
            </div>
        )
    }

    if (!data) return null

    const heldDetail = `게임머니 보유 ${won.format(data.gameMoneyBalance)}, 입찰 홀드 ${won.format(data.gameMoneyHeld)}`

    if (variant === 'compact') {
        return (
            <div
                className={classNames('flex items-center', className)}
                data-testid="balance-indicator"
            >
                <BalanceFigure
                    label="게임머니 가용"
                    value={data.gameMoneyAvailable}
                />
                <span className="sr-only">{heldDetail}</span>
            </div>
        )
    }

    return (
        <div
            className={classNames('flex items-center gap-4', className)}
            data-testid="balance-indicator"
        >
            <BalanceFigure label="캐시" value={data.cashBalance} />
            <span
                aria-hidden="true"
                className="h-6 w-px bg-gray-200 dark:bg-gray-700"
            />
            <BalanceFigure
                label="게임머니 가용"
                value={data.gameMoneyAvailable}
            />
            <span className="sr-only">{heldDetail}</span>
        </div>
    )
}

export default BalanceIndicator
