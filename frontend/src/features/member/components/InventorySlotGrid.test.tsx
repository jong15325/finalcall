import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ListGrid } from '@/components/common/ListFrame'
import InventorySlotGrid from './InventorySlotGrid'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 슬롯 그리드 (FC-076 → FC-177 개편).
 *
 * 고정하는 것:
 *  1. ListFrame이 소유한 마켓 동형 전체폭 그리드(2/3/6열).
 *  2. 채운 슬롯 = 클릭 시 `onItemClick(item)` 을 부르는 버튼(이름은 aria-label 로만).
 *  3. 빈 슬롯 = 번호 라벨(상호작용 없음). capacity 까지 슬롯을 채운다.
 *  4. 부모가 선택한 24칸 페이지 슬롯만 렌더하고, 페이지 내비게이션은 그리드 밖에서 소유한다.
 */

function item(slotNo: number, id: string, name: string): InventoryItem {
    return {
        itemInstancePublicId: id,
        slotNo,
        summary: {
            typeCode: 1123, // 무기·불·검
            displayName: name,
            level: 3,
            skill1Code: 104,
            skill2Code: null,
            skillPercent: 18,
            goldforceExpireAt: null,
        },
    }
}

function renderGrid(
    props: Partial<React.ComponentProps<typeof InventorySlotGrid>>,
) {
    const onItemClick = props.onItemClick ?? vi.fn()
    const utils = render(
        <ListGrid layout="inventory" as="ul" label="인벤토리 슬롯">
            <InventorySlotGrid
                capacity={24}
                used={0}
                items={[]}
                onItemClick={onItemClick}
                {...props}
            />
        </ListGrid>,
    )
    return { ...utils, onItemClick }
}

describe('<InventorySlotGrid>', () => {
    it('마켓과 동형 전체폭 그리드(2/3/6열)로 렌더한다', () => {
        renderGrid({})
        const grid = screen.getByRole('list', { name: '인벤토리 슬롯' })
        expect(grid.className).toContain('grid-cols-2')
        expect(grid.className).toContain('xs:grid-cols-3')
        expect(grid.className).toContain('min-[1200px]:grid-cols-6')
    })

    it('채운 슬롯 = 마켓 카드 오버레이 클릭 시 onItemClick(item) 을 부른다(이름은 aria-label 로만)', () => {
        const target = item(1, 'INST-1', '불의 검')
        const { onItemClick } = renderGrid({ used: 1, items: [target] })
        // FC-178: 채운 슬롯은 마켓 카드 — 오버레이 버튼 aria-label 로 연다(가격/판매자 없음).
        const slot = screen.getByRole('button', {
            name: '불의 검 카드정보 보기',
        })
        // 이미지·타입 줄 중심 — 이름은 별도 텍스트 라벨이 아니라 aria-label 로만.
        expect(screen.queryByText('불의 검')).toBeNull()

        fireEvent.click(slot)
        expect(onItemClick).toHaveBeenCalledTimes(1)
        expect(onItemClick).toHaveBeenCalledWith(target)
    })

    it('배송 badge는 비상호작용 overlay이고 그 아래 빈 영역은 카드 action이 소유한다', () => {
        const target = item(1, 'INST-1', '불의 검')
        const deliveries = new Map([
            [
                target.itemInstancePublicId,
                {
                    deliveryPublicId: 'DELIVERY-1',
                    status: 'PENDING' as const,
                    item: target.summary,
                    itemInstancePublicId: target.itemInstancePublicId,
                    createdAt: '2026-08-13T00:00:00Z',
                },
            ],
        ])
        const { container, onItemClick } = renderGrid({
            used: 1,
            items: [target],
            deliveries,
        })

        const controls = container.querySelector('.item-card__artwork-controls')
        const badge = container.querySelector('[data-card-overlay="badge"]')
        const gapAction = container.querySelector(
            '[data-card-hit-area="control-gap"]',
        )
        expect(badge).not.toBeNull()
        expect(controls).not.toContainElement(badge as HTMLElement | null)
        expect(badge?.parentElement).toContainElement(
            controls as HTMLElement | null,
        )
        expect(gapAction?.parentElement).toHaveClass('item-card__control-gap')

        fireEvent.click(gapAction as Element)
        expect(onItemClick).toHaveBeenCalledWith(target)
    })

    it('빈 슬롯은 번호 라벨을 가진다(상호작용 없음)', () => {
        renderGrid({ used: 1, items: [item(1, 'INST-1', '불의 검')] })
        // slot 1 은 채워졌고 slot 2 는 비었다
        expect(screen.getByLabelText('빈 슬롯 2')).toBeInTheDocument()
        expect(screen.queryByLabelText('빈 슬롯 1')).toBeNull()
    })

    it('capacity 만큼 슬롯을 채운다(24칸 = 채운 1 + 빈 23)', () => {
        renderGrid({ capacity: 24, used: 1, items: [item(1, 'A', '검')] })
        expect(screen.getByLabelText('빈 슬롯 24')).toBeInTheDocument()
        expect(screen.queryByLabelText('빈 슬롯 25')).toBeNull()
    })

    it('선택한 페이지의 24개 슬롯만 렌더한다', () => {
        renderGrid({ capacity: 96, page: 4 })
        expect(screen.getByLabelText('빈 슬롯 73')).toBeInTheDocument()
        expect(screen.getByLabelText('빈 슬롯 96')).toBeInTheDocument()
        expect(screen.queryByLabelText('빈 슬롯 72')).toBeNull()
    })

    it.each([
        [24, 1],
        [25, 2],
        [48, 2],
        [73, 4],
        [96, 4],
    ])('slotNo %i는 %i페이지에만 귀속된다', (slotNo, page) => {
        const target = item(slotNo, `INST-${slotNo}`, `경계 아이템 ${slotNo}`)
        const view = renderGrid({
            capacity: 96,
            used: 96,
            items: [target],
            page,
        })

        expect(
            screen.getByRole('button', {
                name: `경계 아이템 ${slotNo} 카드정보 보기`,
            }),
        ).toBeInTheDocument()

        view.unmount()
        renderGrid({
            capacity: 96,
            used: 96,
            items: [target],
            page: page === 1 ? 2 : page - 1,
        })
        expect(
            screen.queryByRole('button', {
                name: `경계 아이템 ${slotNo} 카드정보 보기`,
            }),
        ).toBeNull()
    })

    it('capacity가 24의 배수가 아니면 마지막 페이지는 capacity에서 끝난다', () => {
        renderGrid({ capacity: 73, page: 4 })

        expect(screen.getByLabelText('빈 슬롯 73')).toBeInTheDocument()
        expect(screen.queryByLabelText('빈 슬롯 74')).toBeNull()
        expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })

    it('슬롯 그리드 자체에는 페이지 내비게이션·확장 버튼을 두지 않는다', () => {
        renderGrid({ capacity: 96 })
        expect(screen.queryByRole('button', { name: '슬롯 확장' })).toBeNull()
        expect(
            screen.queryByRole('navigation', { name: /슬롯 페이지/ }),
        ).toBeNull()
    })
})
