import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import InventoryItemCard from './InventoryItemCard'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 카드 = 아이템 마켓 카드(FC-178).
 *
 * 고정하는 것:
 *  1. 마켓 `ItemCard`(variant="market")와 동일 렌더 — 타입 줄·종류/Lv·속성 배지·스킬.
 *  2. **가격 미표시**(price 미전달 → `.item-card__market-price` 없음).
 *  3. 카드 전체 오버레이 버튼 → `onOpen(item)`(마켓 ShopCard 패턴). 이름은 aria-label 로만.
 *  4. **스킬명(v1.21/FC-179 델타)을 표시**한다 — 인벤도 `스킬 #코드`가 아닌 실제 이름(마켓 동일 배선).
 */

const target: InventoryItem = {
    itemInstancePublicId: 'INST-9',
    slotNo: 1,
    summary: {
        typeCode: 1123, // 무기(1)·불(2)·검(3)
        displayName: '불의 검',
        level: 3,
        skill1Code: 104,
        skill2Code: null,
        skill1Name: '공격력 증가',
        skill2Name: null,
        skillPercent: 18,
        goldforceExpireAt: null,
    },
}

const NOW = Date.parse('2026-07-23T00:00:00Z')

describe('<InventoryItemCard>', () => {
    it('마켓 카드(variant="market")와 동일하게 타입·종류/Lv·속성·스킬을 렌더한다', () => {
        render(<InventoryItemCard item={target} now={NOW} onOpen={vi.fn()} />)

        // 타입 줄(블랙 - 무기) + 종류·Lv + 속성 배지 — 마켓 카드 정합.
        expect(
            screen.getByRole('heading', { name: '블랙 - 무기' }),
        ).toBeInTheDocument()
        expect(screen.getAllByText('검 · Lv.3').length).toBeGreaterThan(0)
        expect(screen.getByText('불')).toBeInTheDocument()
        // 스킬명(v1.21 델타)을 그대로 표시 — `스킬 #104` 코드 폴백이 아니라 실제 이름(마켓 동일 배선).
        // 정보영역 + 플립 뒷면 양쪽에 렌더되므로 1개 이상.
        expect(screen.getAllByText('공격력 증가').length).toBeGreaterThan(0)
        expect(screen.queryByText('스킬 #104')).toBeNull()
    })

    it('가격을 표시하지 않는다(price 미전달 — 가격 줄 없음)', () => {
        const { container } = render(
            <InventoryItemCard item={target} now={NOW} onOpen={vi.fn()} />,
        )
        expect(container.querySelector('.item-card__market-price')).toBeNull()
    })

    it('카드 전체가 열기 버튼 — onOpen(item) 을 부르고 이름은 aria-label 로만 노출한다', () => {
        const onOpen = vi.fn()
        render(<InventoryItemCard item={target} now={NOW} onOpen={onOpen} />)

        // 이름은 heading/본문 텍스트로 렌더하지 않는다(마켓 카드처럼 타입 줄만) — aria-label 접근성만.
        expect(screen.queryByText('불의 검')).toBeNull()

        fireEvent.click(
            screen.getByRole('button', { name: '불의 검 카드정보 보기' }),
        )
        expect(onOpen).toHaveBeenCalledWith(target)
    })

    it('memo 로 감싸 부모 리렌더가 카드로 번지지 않는다', () => {
        expect(
            (InventoryItemCard as unknown as { $$typeof: symbol }).$$typeof,
        ).toBe(Symbol.for('react.memo'))
    })
})
