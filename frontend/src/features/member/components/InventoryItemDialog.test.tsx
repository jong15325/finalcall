import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import InventoryItemDialog from './InventoryItemDialog'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 아이템 상세 다이얼로그 (FC-177).
 *
 * 고정하는 것:
 *  1. 아이템 상세(이름·속성/종류/Lv·스킬)를 보인다.
 *  2. [판매하기] → onSell(item), [닫기]·Esc → onClose (모달 배선).
 *  3. role=dialog + aria-modal (접근성).
 */

const target: InventoryItem = {
    itemInstancePublicId: 'INST-9',
    slotNo: 1,
    summary: {
        typeCode: 1123, // 무기(1)·불(2)·검(3)
        displayName: '불의 검',
        level: 4,
        skill1Code: 104,
        skill2Code: null,
        skillPercent: 18,
        goldforceExpireAt: null,
    },
}

describe('<InventoryItemDialog>', () => {
    it('아이템 상세(이름·속성·종류/Lv)를 role=dialog 로 보인다', () => {
        render(
            <InventoryItemDialog
                item={target}
                onSell={vi.fn()}
                onClose={vi.fn()}
            />,
        )
        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(screen.getByText('불의 검')).toBeInTheDocument()
        expect(screen.getByText('불 속성')).toBeInTheDocument()
        expect(screen.getByText(/무기 · 검 · Lv\.4/)).toBeInTheDocument()
    })

    it('[판매하기] 는 onSell(item) 을 부른다', () => {
        const onSell = vi.fn()
        render(
            <InventoryItemDialog
                item={target}
                onSell={onSell}
                onClose={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: '판매하기' }))
        expect(onSell).toHaveBeenCalledWith(target)
    })

    it('[닫기] 와 Esc 는 onClose 를 부른다', () => {
        const onClose = vi.fn()
        render(
            <InventoryItemDialog
                item={target}
                onSell={vi.fn()}
                onClose={onClose}
            />,
        )
        // 헤더 X · 푸터 버튼 둘 다 "닫기" — 푸터 버튼(마지막)을 누른다.
        const closers = screen.getAllByRole('button', { name: '닫기' })
        fireEvent.click(closers[closers.length - 1])
        expect(onClose).toHaveBeenCalledTimes(1)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(2)
    })
})
