import CodeAmount from '@/components/common/CodeAmount'
import AppModalButton from '@/components/common/AppModalButton'
import BidPanel from '@/features/auction/components/BidPanel'
import CardInfoContent from '@/features/item/components/CardInfoContent'
import CardInfoDialog from '@/features/item/components/CardInfoDialog'
import type { WorkbenchFixture } from '../types'
import {
    CARD_INFO_NOW as NOW,
    cardInfoAuction,
    cardInfoBalance,
    cardInfoParityFixture,
} from '../fixtures/cardInfoParity'

const baseItem = {
    subGroup: 1,
    kind: 1,
    element: 2,
    level: 7,
    goldforceExpireAt: '2026-09-03T09:00:00Z',
    name: '7레벨 - 갑옷',
    skill1: 131,
    skill2: 202,
    skillPercent: 33,
    skill1Name: '방어력 강화 8초',
    skill2Name: '이빌아이 8초',
    now: NOW,
}

// eslint-disable-next-line react-refresh/only-export-components
export const fixture: WorkbenchFixture = cardInfoParityFixture

function sellerRow() {
    return (
        <div data-seller-row className="ci-seller">
            <span aria-hidden className="avatar">
                신
            </span>
            <div className="who">
                <span className="lbl">판매자</span>
                <span className="name">신뢰상점</span>
            </div>
            <span className="trade">거래 128회</span>
        </div>
    )
}

function footer() {
    return (
        <>
            <div className="ci-price">
                <span className="lbl">판매가</span>
                <CodeAmount value={2_750_000} mode="full" className="amt" />
            </div>
            <AppModalButton type="button" variant="primary" className="ci-buy">
                바로 구매
            </AppModalButton>
        </>
    )
}

export default function CardInfoParityScenario() {
    const query = new URLSearchParams(window.location.search)
    const view = query.get('view') ?? 'auction'
    const state = query.get('state') ?? 'ready'
    const item =
        state === 'long'
            ? {
                  ...baseItem,
                  name: '아주 긴 이름의 전설적인 7레벨 황금 갑옷',
                  skill1Name:
                      '공격 성공 시 상대 방어력을 오랫동안 크게 감소시키는 효과',
              }
            : state === 'no-skill'
              ? {
                    ...baseItem,
                    skill1: null,
                    skill2: null,
                    skill1Name: null,
                    skill2Name: null,
                    skillPercent: 0,
                }
              : baseItem

    if (view === 'market')
        return (
            <CardInfoDialog
                {...item}
                belowScroll={sellerRow()}
                footer={footer()}
                onClose={() => undefined}
            />
        )

    return (
        <div
            className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]"
            data-testid="card-info-parity"
        >
            <section
                className="card-info-content-shell liquid-frost min-w-0 w-full p-5"
                aria-label="경매 아이템 정보"
            >
                <CardInfoContent {...item} />
                {sellerRow()}
            </section>
            <div aria-label="경매 입찰 정보">
                <BidPanel
                    isAuthed
                    auction={cardInfoAuction}
                    phase="live"
                    now={NOW}
                    balance={cardInfoBalance}
                    isOwn={false}
                    loginHref="/login"
                    cancelPending={false}
                    cancelError={null}
                    onBid={() => undefined}
                    onBuyNow={() => undefined}
                    onCancel={() => undefined}
                />
            </div>
        </div>
    )
}
