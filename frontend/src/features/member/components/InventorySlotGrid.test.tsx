import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import InventorySlotGrid from './InventorySlotGrid'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 슬롯 그리드 (FC-076).
 *
 * 고정하는 것:
 *  1. capacity·used 는 서버값 그대로(파생 금지).
 *  2. 채운 슬롯 = 상세 링크(이름은 aria-label 로만, 하단 이름 라벨 없음) / 빈 슬롯 = 번호.
 *  3. 슬롯 확장·카테고리 = 미구현/무데이터 자리(확장 버튼 disabled DOM 속성, 정령카드/아바타 드롭).
 *  4. 24칸/페이지 페이지네이션 — 탭 전환 시 다음 24칸 노출.
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
    return render(
        <MemoryRouter>
            <InventorySlotGrid capacity={96} used={0} items={[]} {...props} />
        </MemoryRouter>,
    )
}

describe('<InventorySlotGrid>', () => {
    it('슬롯을 96×178 크기로 렌더한다', () => {
        renderGrid({ capacity: 24 })
        const grid = screen.getByRole('list', { name: /인벤토리 슬롯/ })
        expect(grid).toHaveClass('auto-rows-[178px]')
        expect(grid.className).toContain('repeat(2,96px)')
        expect(grid.className).toContain('repeat(6,96px)')
    })
    it('capacity 배지는 서버값(used/capacity)을 그대로 보인다', () => {
        renderGrid({ capacity: 96, used: 2, items: [item(1, 'A', '불의 검')] })
        expect(screen.getByText('2 / 96 사용')).toBeInTheDocument()
    })

    it('채운 슬롯은 인스턴스 상세로 링크한다(이름은 aria-label 로만, 하단 라벨 제거)', () => {
        renderGrid({ used: 1, items: [item(1, 'INST-1', '불의 검')] })
        const slot = screen.getByRole('button', { name: '불의 검 스킬 보기' })
        expect(slot).toHaveAttribute('aria-expanded', 'false')
        expect(slot).not.toHaveAttribute('href')
        // 이미지 중심(FC-102) — 이름을 별도 텍스트 라벨로 렌더하지 않는다(aria-label 접근성만).
        expect(screen.queryByText('불의 검')).toBeNull()
    })

    it('스킬이 있는 슬롯은 클릭으로 앞뒤를 전환한다', () => {
        const { container } = renderGrid({
            used: 1,
            items: [item(1, 'INST-1', '불의 검')],
        })
        const slot = screen.getByRole('button', { name: '불의 검 스킬 보기' })
        expect(container.querySelector('.inv-slot-flip__back')).not.toBeNull()
        expect(slot).toHaveAttribute('data-flipped', 'false')

        fireEvent.click(slot)

        expect(slot).toHaveAttribute('data-flipped', 'true')
        expect(slot).toHaveAttribute('aria-expanded', 'true')
        expect(slot).toHaveAccessibleName('불의 검 스킬 닫기')
    })
    it('빈 슬롯은 번호 라벨을 가진다', () => {
        renderGrid({ used: 1, items: [item(1, 'INST-1', '불의 검')] })
        // slot 1 은 채워졌고 slot 2 는 비었다
        expect(screen.getByLabelText('빈 슬롯 2')).toBeInTheDocument()
        expect(screen.queryByLabelText('빈 슬롯 1')).toBeNull()
    })

    it('슬롯 확장 버튼은 비활성(DOM 속성)이다 — 미호출 자리', () => {
        renderGrid({})
        const expand = screen.getByRole('button', { name: '슬롯 확장' })
        expect(expand).toBeDisabled()
        expect(expand).toHaveAttribute('aria-disabled', 'true')
    })

    it('카테고리는 전체 아이템만 — 정령카드/아바타는 드롭', () => {
        renderGrid({})
        expect(screen.getByText('전체 아이템')).toBeInTheDocument()
        expect(screen.queryByText('정령 카드')).toBeNull()
        expect(screen.queryByText('아바타')).toBeNull()
    })

    it('used===0 이면 빈 상태 안내를 보인다', () => {
        renderGrid({ used: 0, items: [] })
        expect(
            screen.getByText('보유한 아이템이 없습니다.'),
        ).toBeInTheDocument()
    })

    it('24칸/페이지 — 기본 페이지는 25번 슬롯을 렌더하지 않는다', () => {
        renderGrid({
            used: 1,
            items: [item(25, 'INST-25', '2페이지 아이템')],
        })
        expect(screen.queryByLabelText('빈 슬롯 25')).toBeNull()
        expect(
            screen.queryByRole('button', { name: '2페이지 아이템 스킬 보기' }),
        ).toBeNull()
    })

    it('탭 전환 시 다음 24칸(25–48)을 노출한다', () => {
        renderGrid({
            used: 1,
            items: [item(25, 'INST-25', '2페이지 아이템')],
        })
        fireEvent.click(
            screen.getByRole('button', { name: '슬롯 25번부터 48번' }),
        )
        expect(
            screen.getByRole('button', { name: '2페이지 아이템 스킬 보기' }),
        ).toHaveAttribute('aria-expanded', 'false')
    })
})
