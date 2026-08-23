import { cardInfoFixture } from '@/test/cardInfoFixture'
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import AuctionHeroCard from './AuctionHeroCard'
import type { AuctionDetail } from '@/lib/api/auctions'

const NOW = Date.parse('2026-08-08T00:00:00Z')

const baseAuction: AuctionDetail = {
    auctionPublicId: '01J3AUCTION0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1121,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 5,
        skill1: 104,
        skill2: 207,
        skill1Name: '긴 이름의 화염 강타',
        skill2Name: '연속 폭발',
        skillPercent: 18,
        goldforceExpireAt: '2026-08-10T00:00:00Z',
        nameSnapshot: '불의 전투도끼',
        specSnapshot: '화면에서 제거되어야 하는 설명',
        cardInfo: cardInfoFixture({
            level: 5,
            shortName: 'Lv.5 불도',
            formalName: '5레벨 도끼',
            channelLimit: { code: 'INTERMEDIATE', label: '중수채널 이상' },
            frame: { type: 'GOLD', label: '골드', remainingGoldforceDays: 2 },
            skills: [
                {
                    slot: 1,
                    code: 104,
                    name: '긴 이름의 화염 강타',
                    percent: null,
                },
                { slot: 2, code: 207, name: '연속 폭발', percent: 18 },
            ],
        }),
    },
    startPrice: 1_000_000,
    buyNowPrice: null,
    highestBidAmount: null,
    bidCount: 0,
    startAt: null,
    endAt: '2026-08-09T00:00:00Z',
    sellerNickname: '토르',
    resultType: null,
    highestBidderMasked: null,
    extensionCount: 0,
    maxEndAt: '2026-08-09T01:00:00Z',
    createdAt: '2026-08-07T00:00:00Z',
    minNextBidAmount: 1_100_000,
}

function renderHero(item: Partial<AuctionDetail['item']> = {}) {
    return renderWithProviders(
        <AuctionHeroCard
            auction={{
                ...baseAuction,
                item: { ...baseAuction.item, ...item },
            }}
            phase="live"
            now={NOW}
        />,
    )
}

function valueOf(label: string) {
    const term = screen.getByText(label, { selector: 'dt' })
    const row = term.closest('div')
    expect(row).not.toBeNull()
    return within(row as HTMLElement).getByRole('definition')
}

describe('<AuctionHeroCard>', () => {
    it('활성 골드포스와 카드 기본 정보를 의미 구조로 표시한다', () => {
        renderHero()

        expect(
            screen.getByRole('heading', { name: '카드정보 CARD INFO' }),
        ).toBeVisible()
        expect(screen.getByText('진행 중')).toBeVisible()
        expect(
            screen.getAllByRole('term').map((term) => term.textContent),
        ).toEqual(['타입', '명칭', '채널제한', '속성', '남은 골드 포스'])
        expect(valueOf('타입')).toHaveTextContent('골드 - 무기')
        expect(valueOf('명칭')).toHaveTextContent('5레벨 도끼')
        expect(valueOf('채널제한')).toHaveTextContent('중수채널 이상')
        // CardInfoDialog와 동일한 elementLabelOf 의미론: 축 이름은 dt, 값은 순수 라벨이다.
        expect(valueOf('속성')).toHaveTextContent('불')
        expect(valueOf('남은 골드 포스')).toHaveTextContent(/^2$/)
        expect(screen.queryByText('종류', { selector: 'dt' })).toBeNull()
        expect(screen.queryByText('레벨', { selector: 'dt' })).toBeNull()
        expect(screen.queryByText('골드포스 2일 남음')).toBeNull()
        expect(
            screen.queryByText('화면에서 제거되어야 하는 설명'),
        ).not.toBeInTheDocument()
    })

    it.each([
        ['만료', '2026-08-07T00:00:00Z'],
        ['미적용', null],
    ])('%s 골드포스는 블랙 타입과 없음 상태를 표시한다', (_, expireAt) => {
        renderHero({
            goldforceExpireAt: expireAt,
            cardInfo: cardInfoFixture({
                level: 5,
                shortName: 'Lv.5 불도',
                formalName: '5레벨 도끼',
            }),
        })

        expect(valueOf('타입')).toHaveTextContent('블랙 - 무기')
        expect(valueOf('남은 골드 포스')).toHaveTextContent(/^0$/)
    })

    it('원본 슬롯과 이름, 슬롯 2 퍼센트를 보존한다', () => {
        renderHero()

        const list = screen.getByRole('list', { name: '특수 스킬' })
        const items = within(list).getAllByRole('listitem')
        expect(items).toHaveLength(2)
        expect(items[0]).toHaveTextContent('긴 이름의 화염 강타')
        expect(items[1]).toHaveTextContent('연속 폭발 (18%)')
        const percent = within(items[1]).getByText('(18%)')
        // --gold-deep(#8b6100)은 surface-sunken(#f4f5f8)에서 5.06:1로 WCAG AA를 충족한다.
        expect(percent).toHaveClass('pct')
        expect(percent).not.toHaveAttribute('aria-hidden')
        expect(within(items[0]).queryByText(/%/)).not.toBeInTheDocument()
        expect(within(items[0]).getByText('1')).toHaveAttribute(
            'aria-hidden',
            'true',
        )
        expect(within(items[1]).getByText('2')).toHaveAttribute(
            'aria-hidden',
            'true',
        )
        expect(screen.queryByText('발동 확률')).not.toBeInTheDocument()
    })

    it('슬롯 2만 있어도 모달과 동일하게 1·2번 슬롯을 유지한다', () => {
        renderHero({
            subGroup: 3,
            kind: 2,
            skill1: null,
            skill1Name: null,
            skill2: 999,
            skill2Name: null,
            skillPercent: 7,
            cardInfo: cardInfoFixture({
                category: { code: 3, label: '마법' },
                kind: { code: 2, label: '스페셜필', abbreviation: '스필' },
                frame: {
                    type: 'GOLD',
                    label: '골드',
                    remainingGoldforceDays: 2,
                },
                skills: [
                    { slot: 1, code: null, name: null, percent: null },
                    { slot: 2, code: 999, name: '스킬 #999', percent: 7 },
                ],
            }),
        })

        expect(valueOf('타입')).toHaveTextContent('골드 - 마법')
        const list = screen.getByRole('list', { name: '특수 스킬' })
        const items = within(list).getAllByRole('listitem')
        expect(items).toHaveLength(2)
        expect(items[0]).toHaveTextContent('-')
        expect(items[1]).toHaveTextContent('스킬 #999 (7%)')
        expect(within(items[1]).getByText('(7%)')).toHaveClass('pct')
    })

    it('슬롯 2 퍼센트가 0이면 강조 요소를 표시하지 않는다', () => {
        renderHero({
            skillPercent: 0,
            cardInfo: cardInfoFixture({
                skills: [
                    {
                        slot: 1,
                        code: 104,
                        name: '긴 이름의 화염 강타',
                        percent: null,
                    },
                    { slot: 2, code: 207, name: '연속 폭발', percent: null },
                ],
            }),
        })

        const list = screen.getByRole('list', { name: '특수 스킬' })
        const items = within(list).getAllByRole('listitem')
        expect(items[1]).toHaveTextContent('2연속 폭발')
        expect(within(items[1]).queryByText(/%/)).not.toBeInTheDocument()
    })

    it('스킬이 없으면 명시적인 빈 상태를 표시한다', () => {
        renderHero({
            skill1: null,
            skill2: null,
            skillPercent: 20,
            cardInfo: cardInfoFixture({
                skills: [
                    { slot: 1, code: null, name: null, percent: null },
                    { slot: 2, code: null, name: null, percent: null },
                ],
            }),
        })

        const list = screen.getByRole('list', { name: '특수 스킬' })
        expect(within(list).getAllByRole('listitem')).toHaveLength(2)
        expect(within(list).getAllByText('-')).toHaveLength(2)
        expect(screen.queryByText('(20%)')).not.toBeInTheDocument()
    })

    it('미등록 코드는 축 이름과 원본 코드로 안전하게 폴백한다', () => {
        renderHero({
            subGroup: 9,
            kind: 8,
            element: 7,
            cardInfo: cardInfoFixture({
                category: { code: 9, label: '대분류 9' },
                element: { code: 7, label: '속성 7', abbreviation: '7' },
                frame: {
                    type: 'GOLD',
                    label: '골드',
                    remainingGoldforceDays: 2,
                },
            }),
        })

        expect(valueOf('타입')).toHaveTextContent('골드 - 대분류 9')
        expect(valueOf('속성')).toHaveTextContent('속성 7')
    })

    it.each([
        [3, '초보채널 이상'],
        [8, '고수채널 이상'],
    ])('레벨 %i의 공용 채널 제한을 표시한다', (level, expected) => {
        renderHero({
            level,
            cardInfo: cardInfoFixture({
                level,
                channelLimit:
                    level <= 4
                        ? { code: 'BEGINNER', label: '초보채널 이상' }
                        : { code: 'EXPERT', label: '고수채널 이상' },
            }),
        })

        expect(valueOf('채널제한')).toHaveTextContent(expected)
    })
})
