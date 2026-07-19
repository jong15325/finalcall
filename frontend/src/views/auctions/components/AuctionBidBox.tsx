import { useEffect, useRef, useState } from 'react'
import { PiGavelDuotone } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LinkButton from '@/components/shared/LinkButton'
import CountdownText from '@/features/auction/components/CountdownText'
import {
    auctionPriceOf,
    bidCountLabelOf,
    formatGameMoney,
} from '@/features/auction/lib/auctionPrice'
import {
    isMinRaised,
    reconcileAmountWithMin,
    validateBidAmount,
} from '@/features/auction/lib/bidAmount'
import { bidErrorViewOf } from '@/features/auction/lib/bidErrors'
import { isOwnAuction } from '@/features/auction/lib/auctionPhase'
import { usePlaceBid } from '@/lib/queries/auctions'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import { ROUTES, buildPath } from '@/configs/routes.config'
import useAuth from '@/auth/useAuth'
import classNames from '@/utils/classNames'
import type { AuctionPhase } from '@/features/auction/lib/auctionPhase'
import type { AuctionDetail } from '@/lib/api/auctions'
import type { ReactNode } from 'react'

/**
 * 입찰 상자 — 가격·마감·입찰 폼 (FC-064).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **데스크톱 전폭 카드와 모바일 바텀시트가 같은 컴포넌트다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 입찰 경로가 둘이면 마감 판정·에러 분기·최소가 안내를 **두 곳에서** 맞춰야 하고, 한쪽만
 * 고치는 순간 좁은 화면에서만 나는 버그가 생긴다(FC-059 가 필터 폼 한 벌을 레일과 시트에
 * 함께 넣은 것과 같은 이유). 다른 것은 바깥 껍데기뿐이다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **마감은 서버 `status` 가 아니라 `phase` 로 판정한다**(`auctionPhase.ts`).
 * ══════════════════════════════════════════════════════════════════════════════
 * 마감 강등 워커가 없어 끝난 경매도 `status: "ACTIVE"` 로 내려온다. `phase` 를 쓰지 않으면
 * **종료된 경매에 활성 입찰 폼이 뜨고** 서버는 그 입찰을 `BID_006` 으로 거절한다.
 *
 * ★ 판매자 숨김(`isOwnAuction`)은 **표시 제어일 뿐 인가가 아니다** — 서버 `BID_003` 분기를
 *   `bidErrors.ts` 가 반드시 갖는다(다른 탭에서 계정이 바뀌면 여기 도달한다).
 *
 * ★ **즉시구매 버튼이 없다.** `POST /auctions/{id}/purchase` 는 계약에만 있고 백엔드에 매핑이
 *   없다(404). `buyNowPrice` 는 스펙 목록의 정보 표기로만 존재한다.
 */

interface AuctionBidBoxProps {
    auction: AuctionDetail
    phase: AuctionPhase
    /**
     * 입력 id 접두 — **데스크톱 패널과 모바일 시트가 동시에 DOM 에 있을 수 있다.**
     * 같은 `id` 가 둘이면 `<label for>` 가 어느 쪽을 가리키는지 정해지지 않아 라벨 클릭·
     * 스크린리더 연결이 임의로 어긋난다(FC-059 `AuctionFilterPanel` 이 같은 이유로 쓴 장치).
     */
    idPrefix: string
    className?: string
}

/** 상자 안의 회색 안내 한 칸. 템플릿 `Alert`(framer-motion)를 대신한다. */
function Notice({
    tone = 'muted',
    title,
    description,
    action,
    testId,
    live,
}: {
    tone?: 'muted' | 'strong'
    title: string
    description?: string
    action?: ReactNode
    testId?: string
    live?: boolean
}) {
    return (
        <div
            className={classNames(
                'flex flex-col gap-2 rounded-lg border px-3 py-2.5',
                tone === 'strong'
                    ? 'border-gray-400 bg-gray-100 dark:border-gray-500 dark:bg-gray-700'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/40',
            )}
            data-testid={testId}
            role={live ? 'status' : undefined}
            aria-live={live ? 'polite' : undefined}
        >
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {title}
            </p>
            {description && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {description}
                </p>
            )}
            {action}
        </div>
    )
}

const AuctionBidBox = ({
    auction,
    phase,
    idPrefix,
    className,
}: AuctionBidBoxProps) => {
    const { authenticated, user } = useAuth()
    const amountId = `${idPrefix}-bid-amount`
    const helpId = `${idPrefix}-bid-amount-help`
    const mutation = usePlaceBid(auction.auctionPublicId)

    const price = auctionPriceOf(auction)
    const minNextBidAmount = auction.minNextBidAmount
    const own = isOwnAuction(auction.sellerNickname, user?.nickname)

    const [amount, setAmount] = useState('')
    const [localError, setLocalError] = useState<string | null>(null)
    /** 최소가가 오른 사실을 알리는 안내(값). 사용자가 값을 만지면 사라진다 */
    const [raisedMin, setRaisedMin] = useState<number | null>(null)
    /** 제출 직전 마감 시각 — 응답과 다르면 소프트클로즈 연장이 일어난 것이다. */
    const endAtAtSubmit = useRef(auction.endAt)
    /**
     * 사용자가 금액을 **직접 만졌는가**. 프리필과 사용자 입력을 가르는 유일한 근거다.
     * ref 인 이유는 아래 effect 가 이 값에 **반응해서는 안 되기** 때문이다 — 읽기만 한다.
     */
    const edited = useRef(false)
    /** 직전 최소가 — 올랐을 때만 안내한다(첫 렌더는 비교 대상이 없다) */
    const previousMin = useRef<number | null>(null)

    /*
     * ★ 판단은 전부 `bidAmount.ts` 의 순수 함수에 있다(리뷰 M-1). 여기는 그 결과를
     *   상태에 옮기기만 한다 — 금전 규칙이 렌더 타이밍에 얽히지 않게 하려는 분리다.
     */
    useEffect(() => {
        if (minNextBidAmount === null) return

        setAmount((current) =>
            reconcileAmountWithMin({
                current,
                minNextBidAmount,
                edited: edited.current,
            }),
        )
        setLocalError(null)

        if (isMinRaised(previousMin.current, minNextBidAmount)) {
            setRaisedMin(minNextBidAmount)
        }
        previousMin.current = minNextBidAmount
    }, [minNextBidAmount])

    const submit = (event: React.FormEvent) => {
        event.preventDefault()

        const check = validateBidAmount(
            amount,
            minNextBidAmount,
            formatGameMoney,
        )
        if (!check.ok) {
            setLocalError(check.message)
            return
        }

        setLocalError(null)
        setRaisedMin(null)
        endAtAtSubmit.current = auction.endAt
        /*
         * ★ **성공해도 시트를 닫지 않는다.** 닫아버리면 소프트클로즈 연장 안내를 아무도 못
         *   보고, 카운트다운이 늘어난 이유를 설명할 자리가 사라진다. 닫기는 사용자가 한다.
         */
        mutation.mutate(check.amount)
    }

    const errorView = mutation.error
        ? bidErrorViewOf(mutation.error, minNextBidAmount)
        : null

    return (
        <div
            className={classNames('flex min-w-0 flex-col gap-4', className)}
            data-testid="auction-bid-box"
        >
            {/*
             * ★ 요약은 **1열에서 시작**해 `sm` 에서 3열이 된다. 320px 에서 세 칸을 나란히 두면
             *   "1,250,000 GM" 이 칸을 넘친다(FC-058 파손 유형).
             */}
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                        {price.label}
                    </dt>
                    <dd
                        className="truncate text-xl font-bold tabular-nums text-gray-900 sm:text-2xl dark:text-gray-100"
                        data-testid="auction-current-price"
                    >
                        {formatGameMoney(price.amount)} GM
                    </dd>
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                        최소 입찰가
                    </dt>
                    <dd
                        className="truncate text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100"
                        data-testid="auction-min-next-bid"
                    >
                        {minNextBidAmount !== null
                            ? `${formatGameMoney(minNextBidAmount)} GM`
                            : '—'}
                    </dd>
                    <dd className="text-xs text-gray-500 dark:text-gray-400">
                        {bidCountLabelOf(auction.bidCount)}
                    </dd>
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                        남은 시간
                    </dt>
                    <dd className="min-w-0">
                        <CountdownText endAt={auction.endAt} />
                    </dd>
                    {auction.extensionCount > 0 && (
                        <dd
                            className="text-xs text-gray-500 dark:text-gray-400"
                            data-testid="auction-extension-count"
                        >
                            마감 {auction.extensionCount}회 연장됨
                        </dd>
                    )}
                </div>
            </dl>

            {auction.highestBidderMasked && (
                /*
                 * ★★ **"낙찰" 이라 단정하지 않는다.** `resultType` 이 항상 null 이라 결과를 알 수
                 *    없고, 마감 처리·정산은 아직 없다(EPIC-CLOSING). 사실은 "최고 입찰" 까지다.
                 */
                <p
                    className="text-sm text-gray-600 dark:text-gray-400"
                    data-testid="auction-highest-bidder"
                >
                    최고 입찰{' '}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {auction.highestBidderMasked}
                    </span>
                </p>
            )}

            {phase === 'ended' && (
                <Notice
                    testId="auction-ended-notice"
                    title="마감된 경매입니다"
                    description="더 이상 입찰을 받지 않습니다."
                    tone="strong"
                />
            )}

            {phase === 'scheduled' && (
                <Notice
                    testId="auction-scheduled-notice"
                    title="아직 시작하지 않은 경매입니다"
                    description="시작 시각이 되면 입찰할 수 있습니다."
                />
            )}

            {phase === 'live' && own && (
                <Notice
                    testId="auction-own-notice"
                    title="내가 등록한 경매입니다"
                    description="자기 경매에는 입찰할 수 없습니다."
                />
            )}

            {phase === 'live' && !own && !authenticated && (
                <Notice
                    testId="auction-login-notice"
                    title="입찰하려면 로그인이 필요합니다"
                    action={
                        <LinkButton
                            size="sm"
                            variant="solid"
                            to={`${ROUTES.login}${buildReturnUrlQuery({
                                pathname: buildPath.auctionDetail(
                                    auction.auctionPublicId,
                                ),
                            })}`}
                        >
                            로그인
                        </LinkButton>
                    }
                />
            )}

            {phase === 'live' && !own && authenticated && (
                /*
                 * ★★ **`noValidate` 가 필요하다.** `min` 을 붙여 두면 브라우저 기본 검증이
                 *    제출을 **가로채고** 자체 말풍선을 띄운다 — 그 문구는 브라우저 언어를
                 *    따르고 우리 에러 상자와 생김새·위치가 다르며, `BID_001` 로 되돌아오는
                 *    서버 실패와 **같은 실패가 두 가지 모습**으로 보이게 된다.
                 *    검증을 끈 게 아니라 **말하는 주체를 하나로 모은 것**이다(아래 `submit` 이
                 *    같은 조건을 그대로 검사한다). `min` 은 보조기술용 의미로 남긴다.
                 */
                <form
                    noValidate
                    className="flex min-w-0 flex-col gap-2"
                    data-testid="auction-bid-form"
                    onSubmit={submit}
                >
                    <label
                        className="text-xs text-gray-500 dark:text-gray-400"
                        htmlFor={amountId}
                    >
                        입찰 금액 (GM)
                    </label>
                    {/*
                     * ★ `inputMode="numeric"` — 모바일에서 숫자 키패드가 뜬다. `type="number"` 만
                     *   두면 기기에 따라 문자 키보드가 먼저 나온다.
                     * ★ 세로 스택이 기본, `sm` 에서 처음 가로로 붙는다(320px 에서 입력칸과
                     *   버튼을 한 줄에 두면 둘 다 눌리기 어려워진다).
                     */}
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                        <Input
                            aria-describedby={helpId}
                            aria-invalid={Boolean(
                                localError || errorView?.amountFault,
                            )}
                            className="min-w-0"
                            data-testid="bid-amount-input"
                            id={amountId}
                            inputMode="numeric"
                            min={minNextBidAmount ?? 1}
                            step={1}
                            type="number"
                            value={amount}
                            onChange={(event) => {
                                // ★ 여기서부터 이 값은 **사용자 의사**다 — 덮어쓰기 금지 대상.
                                edited.current = true
                                setRaisedMin(null)
                                setAmount(event.target.value)
                            }}
                        />
                        <Button
                            block
                            className="sm:w-auto sm:shrink-0"
                            data-testid="bid-submit"
                            icon={<PiGavelDuotone />}
                            loading={mutation.isPending}
                            type="submit"
                            variant="solid"
                        >
                            입찰하기
                        </Button>
                    </div>

                    <p
                        className="text-xs text-gray-500 dark:text-gray-400"
                        id={helpId}
                    >
                        {minNextBidAmount !== null
                            ? `${formatGameMoney(minNextBidAmount)} GM 이상 입력할 수 있습니다.`
                            : '최소 입찰가를 불러오지 못했습니다.'}
                    </p>

                    {/*
                     * ★ 최소가가 오른 사실은 **말로 알린다**(리뷰 M-1). 입력칸이 조용히
                     *   바뀌든 그대로 남든, 사용자가 그 변화를 모른 채 제출하면 안 된다.
                     *   `role="status"` 라 초점을 뺏지 않고 읽힌다.
                     */}
                    {raisedMin !== null && (
                        <p
                            aria-live="polite"
                            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                            data-testid="bid-min-raised"
                            role="status"
                        >
                            최소 입찰가가 {formatGameMoney(raisedMin)} GM 으로
                            올랐습니다. 금액을 확인해 주세요.
                        </p>
                    )}

                    {/*
                     * 실패는 **한 자리에서** 말한다 — 클라 검증과 서버 코드 분기가 서로 다른
                     * 곳에 뜨면 사용자는 두 군데를 살펴야 한다. `role="alert"` 로 즉시 읽힌다.
                     */}
                    {(localError || errorView) && (
                        <div
                            className="flex flex-col gap-1 rounded-lg border border-gray-400 bg-gray-100 px-3 py-2 dark:border-gray-500 dark:bg-gray-700"
                            data-testid="bid-error"
                            role="alert"
                        >
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                {localError ?? errorView?.title}
                            </p>
                            {!localError && errorView?.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {errorView.description}
                                </p>
                            )}
                        </div>
                    )}

                    {mutation.isSuccess && !localError && (
                        <Notice
                            live
                            testId="bid-success"
                            title={`입찰했습니다 — ${formatGameMoney(mutation.data.currentHighestAmount)} GM`}
                            description={
                                /*
                                 * ★ 소프트클로즈 연장을 **사용자에게 말한다.** 카운트다운이 갑자기
                                 *   늘어나는 것을 설명 없이 두면 화면이 고장 난 것처럼 보인다.
                                 */
                                mutation.data.endAt !== endAtAtSubmit.current
                                    ? '마감 직전 입찰이라 마감 시각이 연장되었습니다.'
                                    : undefined
                            }
                        />
                    )}
                </form>
            )}
        </div>
    )
}

export default AuctionBidBox
