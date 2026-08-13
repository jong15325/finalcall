import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router'
import { renderWithProviders } from '@/test/renderWithProviders'
import ShopCard from './ShopCard'
import type { ShopSummary } from '@/lib/api/shop'

/** 현재 경로를 노출해 내비게이션 유무를 단언한다. */
function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location">{location.pathname}</div>
}

const NOW = Date.parse('2026-07-23T00:00:00Z')

const noop = () => {}

const baseShop: ShopSummary = {
    shopPublicId: '01JMARKET0001',
    status: 'ACTIVE',
    item: {
        typeCode: 1121,
        mainCategory: 1,
        subGroup: 1,
        element: 2,
        kind: 1,
        level: 3,
        skill1: 11,
        skill2: 202,
        skill1Name: '공격시간 3 감소',
        skill2Name: '트리플샷',
        skillPercent: 33,
        goldforceExpireAt: null,
        nameSnapshot: '불의 전투도끼',
        specSnapshot: '공격력이 높은 한손 도끼',
    },
    price: 2_480_000,
    endAt: '2026-07-30T00:00:00Z',
    sellerNickname: '신뢰상점',
    sellerCompletedSales: 128,
}

describe('<ShopCard>', () => {
    it('카드정보 열기 버튼과 플립·비교 버튼을 중첩하지 않는다(FC-146 모달 전환)', () => {
        const { container } = renderWithProviders(
            <ShopCard shop={baseShop} now={NOW} onOpen={noop} />,
        )
        // 카드→상세 네비게이션은 카드정보 모달 열기 버튼으로 대체됐다(링크 없음).
        expect(
            screen.queryByRole('link', { name: '불의 전투도끼 상세 보기' }),
        ).not.toBeInTheDocument()
        const opener = screen.getByRole('button', {
            name: '불의 전투도끼 카드정보 보기',
        })
        expect(opener).toHaveClass('item-card__primary-action--content')
        expect(opener.closest('.item-card__market-info')).not.toBeNull()
        expect(screen.getByText('2,480,000')).toBeInTheDocument()
        expect(screen.queryByText('248만')).not.toBeInTheDocument()
        expect(opener).toBeEmptyDOMElement()
        expect(opener.querySelector('button')).toBeNull()
        // 키보드 대표 열기 + 포인터용 아트 열기 + 스킬 플립 + 비교 담기.
        const controlGapOpeners = container.querySelectorAll(
            '[data-card-hit-area="control-gap"]',
        )
        expect(controlGapOpeners).toHaveLength(2)
        controlGapOpeners.forEach((gap) => {
            expect(gap).toHaveAttribute('aria-hidden', 'true')
            expect(gap).toHaveAttribute('tabindex', '-1')
            expect(gap.parentElement).toHaveClass('item-card__control-gap')
        })
        const artworkOpener = container.querySelector(
            '.item-card__primary-action--artwork',
        )
        expect(artworkOpener).toHaveAttribute('aria-hidden', 'true')
        expect(artworkOpener).toHaveAttribute('tabindex', '-1')
        // disclosure(m3): 스킬 플립 트리거는 뒷면 region 을 aria-controls 로 가리킨다.
        const trigger = screen.getByRole('button', {
            name: '불의 전투도끼 스킬 보기',
        })
        expect(trigger.parentElement).toHaveClass('item-card__artwork-controls')
        const controls = trigger.getAttribute('aria-controls')
        expect(controls).toBeTruthy()
        expect(
            container.querySelector('.item-card__skill-flip-back'),
        ).toHaveAttribute('id', controls)
        expect(
            container.querySelector('.item-card__skill-flip'),
        ).not.toContainElement(
            screen.getByRole('button', {
                name: '불의 전투도끼 비교에 담기',
            }),
        )
        expect(artworkOpener?.parentElement).toHaveClass(
            'item-card__artwork-composition',
        )
        expect(trigger.parentElement).toContainElement(
            screen.getByRole('button', {
                name: '불의 전투도끼 비교에 담기',
            }),
        )
        expect(trigger.parentElement).not.toContainElement(
            artworkOpener as HTMLElement | null,
        )
        expect(trigger).toHaveAttribute('data-card-hit-area', 'flip')
        expect(
            screen
                .getByRole('button', {
                    name: '불의 전투도끼 비교에 담기',
                })
                .closest('[data-card-hit-area="compare"]'),
        ).not.toBeNull()
    })

    it('정보영역 클릭은 네비게이션 없이 onOpen 으로 모달을 연다', () => {
        const onOpen = vi.fn()
        renderWithProviders(
            <>
                <ShopCard shop={baseShop} now={NOW} onOpen={onOpen} />
                <LocationProbe />
            </>,
            { route: '/market' },
        )
        expect(screen.getByTestId('location')).toHaveTextContent('/market')

        fireEvent.click(
            screen.getByRole('button', {
                name: '불의 전투도끼 카드정보 보기',
            }),
        )

        // 상세 페이지로 이동하지 않고(경로 불변) 부모에 선택 리스팅을 넘긴다.
        expect(screen.getByTestId('location')).toHaveTextContent('/market')
        expect(onOpen).toHaveBeenCalledWith(baseShop)
    })

    it('상단 control rect 밖의 빈 영역도 같은 모달 action으로 동작한다', () => {
        const onOpen = vi.fn()
        const { container } = renderWithProviders(
            <ShopCard shop={baseShop} now={NOW} onOpen={onOpen} />,
        )

        const gapAction = container.querySelector(
            '[data-card-hit-area="control-gap"]',
        )
        expect(gapAction).not.toBeNull()
        fireEvent.click(gapAction as Element)
        expect(onOpen).toHaveBeenCalledWith(baseShop)
    })

    it('비교 버튼 클릭은 모달을 열지 않는다(독립 상위 레이어)', () => {
        const onOpen = vi.fn()
        renderWithProviders(
            <ShopCard shop={baseShop} now={NOW} onOpen={onOpen} />,
            { route: '/market' },
        )

        fireEvent.click(
            screen.getByRole('button', { name: '불의 전투도끼 비교에 담기' }),
        )

        // 담기는 열기 버튼과 독립 상위 레이어 — onOpen 미호출.
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('스킬이 없어도 마켓 이미지 높이 클래스는 유지하고 토글만 생략한다', () => {
        const { container } = renderWithProviders(
            <ShopCard
                shop={{
                    ...baseShop,
                    item: { ...baseShop.item, skill1: null, skill2: null },
                }}
                now={NOW}
                onOpen={noop}
            />,
        )
        const flip = container.querySelector('.item-card__skill-flip')
        expect(flip).toHaveClass('is-market')
        expect(flip).not.toHaveClass('is-enabled')
        expect(
            screen.queryByRole('button', {
                name: '불의 전투도끼 스킬 보기',
            }),
        ).not.toBeInTheDocument()
    })

    // FC-101: 대량 목록 매초 리렌더(잰더) 방지 — 부모 리렌더가 카드로 번지지 않도록 memo 로 격리한다.
    it('memo 로 감싸 부모 리렌더가 카드로 번지지 않는다', () => {
        expect((ShopCard as unknown as { $$typeof: symbol }).$$typeof).toBe(
            Symbol.for('react.memo'),
        )
    })

    // now 격리 후에도 골드포스 잔여일 파생은 주입된 시각으로 그대로 흐른다(일 단위 스냅샷).
    it('주입된 now 로 골드포스 잔여일을 파생한다', () => {
        renderWithProviders(
            <ShopCard
                shop={{
                    ...baseShop,
                    item: {
                        ...baseShop.item,
                        goldforceExpireAt: '2026-07-30T00:00:00Z',
                    },
                }}
                now={NOW}
                onOpen={noop}
            />,
        )
        // NOW=07-23 → 만료 07-30 : 잔여 7일(일 단위 파생, 매초 시계 불필요).
        expect(
            screen.getByRole('img', { name: '골드포스 잔여 7일' }),
        ).toBeInTheDocument()
    })
})
