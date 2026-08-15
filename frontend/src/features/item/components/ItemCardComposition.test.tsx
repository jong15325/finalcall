import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import ItemCardActionSurface from './ItemCardActionSurface'
import ItemCardFlip from './ItemCardFlip'
import ItemCardView, { ItemCardArtwork } from './ItemCardView'
import type { ItemCardViewModel } from './ItemCardView'

describe('compact ItemCardView', () => {
    it('판매자 정보가 없으면 판매자 행을 표시하지 않는다', () => {
        render(<ItemCardView density="compact" item={item} />)

        expect(screen.queryByText(/^판매자 /)).not.toBeInTheDocument()
    })

    it('0·1·2개 스킬 모두 동일한 두 행 레이아웃 계약을 사용한다', () => {
        const fixtures: ItemCardViewModel[] = [
            { ...item, skills: [] },
            item,
            {
                ...item,
                skills: [
                    ...item.skills,
                    { slot: 2, label: '연속 폭발', percent: 18 },
                ],
            },
        ]

        fixtures.forEach((fixture) => {
            const { container, unmount } = render(
                <ItemCardView density="compact" item={fixture} />,
            )
            const list = container.querySelector('.item-card__market-skills')
            const rows = list?.querySelectorAll('.item-card__skill-row')

            expect(list).toHaveClass('item-card__skill-rows')
            expect(rows).toHaveLength(2)
            expect(rows?.[0]).toHaveTextContent(
                `스킬 1 ${fixture.skills[0]?.label ?? '-'}`,
            )
            expect(rows?.[1]).toHaveTextContent(
                `스킬 2 ${fixture.skills[1]?.label ?? '-'}`,
            )
            unmount()
        })
    })
})

const item: ItemCardViewModel = {
    name: '불의 전투도끼',
    description: '공격력이 높은 한손 도끼',
    typeLabel: '블랙 - 무기',
    kindLabel: '도끼',
    level: 3,
    element: 'fire',
    artUrl: '/art/items/level3/l/fire/axe.png',
    skills: [{ slot: 1, label: '공격시간 3 감소' }],
    price: { amount: 2_480_000, label: '현재가' },
    goldforceExpireAt: null,
    referenceNow: Date.parse('2026-07-23T00:00:00Z'),
}

describe('아이템 카드 composition', () => {
    it('표시 view는 외부 상태 없이 아이템 정보를 렌더한다', () => {
        render(<ItemCardView item={item} />)

        expect(
            screen.getByRole('heading', { name: item.name }),
        ).toBeInTheDocument()
        expect(screen.getByText('2,480,000')).toBeInTheDocument()
        expect(screen.queryByText('248만')).not.toBeInTheDocument()
        expect(screen.getByLabelText('2,480,000 코드')).toHaveClass(
            'max-w-full',
            'min-w-0',
            'flex-wrap',
            'break-all',
        )
        expect(screen.getByText('공격시간 3 감소')).toBeInTheDocument()
    })

    it('서로 다른 art fixture도 공통 stage 폭 안에 72×134 frame을 보존한다', () => {
        const fixtures = [
            item,
            {
                ...item,
                name: '대지의 검',
                artUrl: '/art/items/level7/l/earth/sword.png',
                skills: [],
            },
        ]
        const { container } = render(
            <>
                {fixtures.map((fixture) => (
                    <ItemCardArtwork key={fixture.name} item={fixture} />
                ))}
            </>,
        )

        const frames = container.querySelectorAll(
            '.item-frame--stage.item-card__artwork-frame',
        )
        expect(frames).toHaveLength(2)
        frames.forEach((frame) => {
            expect(frame.querySelector('.item-frame__stage')).not.toBeNull()
            expect(frame.querySelector('.card-art')).not.toBeNull()
            expect(frame.querySelector('.item-art')).not.toBeNull()
        })
        expect(screen.getByRole('img', { name: item.name })).toHaveAttribute(
            'src',
            item.artUrl,
        )
        expect(screen.getByRole('img', { name: '대지의 검' })).toHaveAttribute(
            'src',
            '/art/items/level7/l/earth/sword.png',
        )
    })

    it('fill mode는 preview wrapper 없이 부모 block-size를 채우는 stage를 제공한다', () => {
        const { container } = render(
            <div data-fill-parent style={{ height: 296 }}>
                <ItemCardArtwork item={item} mode="fill" />
            </div>,
        )
        const parent = container.querySelector('[data-fill-parent]')!
        const frame = parent.firstElementChild

        expect(frame).toHaveClass(
            'item-frame',
            'item-frame--fill',
            'item-frame--stage',
            'item-card__artwork-frame',
        )
        expect(frame?.querySelector('.item-frame__stage')).toBeInTheDocument()
        expect(frame?.parentElement).toBe(parent)
        expect(container.getElementsByClassName('h-[158px]')).toHaveLength(0)
    })

    it('controlled flip은 자기 focus 범위의 Escape만 처리한다', () => {
        const onFlippedChange = vi.fn()
        const { container } = render(
            <ItemCardFlip
                flipped
                back={<span>뒷면</span>}
                front={<span>앞면</span>}
                label={item.name}
                onFlippedChange={onFlippedChange}
            />,
        )

        expect(
            container.querySelector('.item-card__artwork-composition'),
        ).not.toHaveClass('is-hover-latch')

        fireEvent.keyDown(window, { key: 'Escape' })
        expect(onFlippedChange).not.toHaveBeenCalled()

        fireEvent.keyDown(
            screen.getByRole('button', {
                name: `${item.name} 스킬 닫기`,
            }),
            { key: 'Escape' },
        )
        expect(onFlippedChange).toHaveBeenCalledWith(false)
    })

    it('action surface는 link와 button을 각각 단일 주 행동으로 렌더한다', () => {
        const onPress = vi.fn()
        const view = render(
            <MemoryRouter>
                <ItemCardActionSurface
                    action={{
                        kind: 'link',
                        to: '/auctions/A-1',
                        label: '경매 상세 보기',
                    }}
                />
                <ItemCardActionSurface
                    opensDialog
                    action={{
                        kind: 'button',
                        label: '카드정보 보기',
                        onPress,
                    }}
                />
            </MemoryRouter>,
        )

        expect(
            screen.getByRole('link', { name: '경매 상세 보기' }),
        ).toHaveAttribute('href', '/auctions/A-1')
        const button = screen.getByRole('button', { name: '카드정보 보기' })
        expect(button).toHaveAttribute('aria-haspopup', 'dialog')
        expect(button.querySelector('button, a')).toBeNull()
        fireEvent.click(button)
        expect(onPress).toHaveBeenCalledOnce()
        view.unmount()
    })

    it('footer pointer action은 키보드 대표 action과 겹치지 않는다', () => {
        const onPress = vi.fn()
        const { container } = render(
            <ItemCardView
                item={item}
                footer={<span>배송 중</span>}
                footerAction={
                    <ItemCardActionSurface
                        area="footer"
                        keyboard={false}
                        action={{
                            kind: 'button',
                            label: '카드정보 보기',
                            onPress,
                        }}
                    />
                }
            />,
        )

        const footerAction = container.querySelector(
            '[data-card-hit-area="footer"]',
        )
        expect(footerAction).toHaveAttribute('aria-hidden', 'true')
        expect(footerAction).toHaveAttribute('tabindex', '-1')
        expect(footerAction?.parentElement).toHaveClass('relative')
        fireEvent.click(footerAction as Element)
        expect(onPress).toHaveBeenCalledOnce()
    })
})
