import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import InventoryCardInfoDialog from './InventoryCardInfoDialog'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 카드정보 모달 = 아이템 마켓 `ShopCardInfoDialog` 와 동일 구조(FC-178).
 *
 * 고정하는 것:
 *  1. 카드정보 렌더 — 속성표(타입·명칭·채널제한·속성·골드포스)·특수스킬.
 *  2. **판매자·판매가·구매확인 없음**(마켓과 다른 점) + 하단 CTA = '판매 등록'.
 *  3. CTA → onSell(item), Esc·닫기 → onClose. role=dialog + aria-modal(접근성).
 */

const NOW = Date.parse('2026-07-23T00:00:00Z')

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

function renderDialog(
    props: Partial<Parameters<typeof InventoryCardInfoDialog>[0]> = {},
) {
    return render(
        <InventoryCardInfoDialog
            item={target}
            now={NOW}
            onSell={() => {}}
            onClose={() => {}}
            {...props}
        />,
    )
}

describe('<InventoryCardInfoDialog>', () => {
    it('카드정보 속성표·특수스킬을 role=dialog 로 렌더한다', () => {
        renderDialog()

        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveClass('shop-cardinfo')
        expect(dialog.querySelector('.card-info-content')).toBeInTheDocument()
        expect(dialog.querySelector('.ci-scroll')).toHaveClass(
            'card-info-content-shell',
        )

        // 속성표 — 타입(블랙 - 무기)·명칭·채널제한(level 파생)·속성·골드포스.
        expect(screen.getByText('블랙 - 무기')).toBeInTheDocument()
        expect(screen.getByText('불의 검')).toBeInTheDocument()
        expect(screen.getByText('채널제한')).toBeInTheDocument()
        // level 3 → 초보채널 이상(channelLimitOf 파생, 표시 전용).
        expect(screen.getByText('초보채널 이상')).toBeInTheDocument()
        expect(screen.getByText('불')).toBeInTheDocument()
        // 골드포스 없음(goldforceExpireAt null).
        expect(screen.getByText('없음')).toBeInTheDocument()

        // 특수스킬 — v1.21 델타로 실제 이름 표시(마켓 동일 배선, `스킬 #코드` 폴백 아님).
        expect(
            screen.getByRole('heading', { name: '특수 스킬' }),
        ).toBeInTheDocument()
        expect(screen.getByText('공격력 증가')).toBeInTheDocument()
        expect(screen.queryByText('스킬 #104')).toBeNull()
    })

    it('판매자·판매가·구매확인은 없고 하단 CTA 는 판매 등록이다', () => {
        renderDialog()

        // 마켓 모달과 다른 점 — 판매자/판매가/구매 없음.
        expect(screen.queryByText('판매자')).toBeNull()
        expect(screen.queryByText('판매가')).toBeNull()
        expect(screen.queryByRole('button', { name: '바로 구매' })).toBeNull()

        const sellButton = screen.getByRole('button', { name: '판매 등록' })
        expect(sellButton).toBeInTheDocument()
        expect(sellButton).toHaveAttribute('data-modal-button', 'primary')
    })

    it('판매 등록 → onSell(item) 을 부른다', () => {
        const onSell = vi.fn()
        renderDialog({ onSell })
        fireEvent.click(screen.getByRole('button', { name: '판매 등록' }))
        expect(onSell).toHaveBeenCalledWith(target)
    })

    it('닫기·Esc 는 onClose 를 부른다', () => {
        const onClose = vi.fn()
        renderDialog({ onClose })

        fireEvent.click(screen.getByRole('button', { name: '닫기' }))
        expect(onClose).toHaveBeenCalledTimes(1)

        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('보유 스킬이 없으면 두 슬롯을 대시로 보인다', () => {
        renderDialog({
            item: {
                ...target,
                summary: {
                    ...target.summary,
                    skill1Code: null,
                    skill2Code: null,
                },
            },
        })
        const skills = screen.getAllByRole('listitem')
        expect(skills).toHaveLength(2)
        expect(within(skills[0]).getByText('-')).toBeVisible()
        expect(within(skills[1]).getByText('-')).toBeVisible()
        expect(skills[0].querySelector('.sr-only')).toHaveTextContent('스킬 1')
        expect(skills[1].querySelector('.sr-only')).toHaveTextContent('스킬 2')
    })
})
