import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ItemInstanceDetail from './ItemInstanceDetail'
import type { ItemInstanceDetail as ItemInstanceDetailData } from '@/lib/api/items'

/**
 * 아이템 인스턴스 상세 (FC-077 — design-brief B-11).
 *
 * 고정하는 것:
 *  1. ★ 스킬 **이름** 표시 — 경매뷰의 `스킬 #{code}` 중립 표기와 구분(§2.5).
 *  2. 마법(skill1 부재)은 skill2 를 **슬롯 2** 로 유지(슬롯 오표기 금지, m-5).
 *  3. slotNo 는 소유자 & INVENTORY 일 때만 존재 → 있을 때만 슬롯·"경매에 등록".
 *  4. location 표기(INVENTORY/TEMP/LISTED).
 *  5. 골드포스 파생 — 활성일 때만 배지 + 잔여일(클라 파생).
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')
const DAY = 86_400_000

function makeItem(
    overrides: Partial<ItemInstanceDetailData> = {},
): ItemInstanceDetailData {
    return {
        itemInstancePublicId: 'itm_1',
        template: {
            typeCode: 1113,
            mainCategory: 1,
            subGroup: 1, // 무기
            element: 1, // 물
            kind: 3, // 검
            displayName: '물의 장검',
        },
        level: 5,
        skill1: { skillCode: 104, name: '강인함' },
        skill2: { skillCode: 207, name: '대지의 축복' },
        skillPercent: 18,
        goldforceExpireAt: null,
        location: 'INVENTORY',
        ownerMasked: '레***',
        slotNo: 7,
        ...overrides,
    }
}

function renderDetail(item: ItemInstanceDetailData) {
    return render(
        <MemoryRouter>
            <ItemInstanceDetail item={item} now={NOW} />
        </MemoryRouter>,
    )
}

describe('<ItemInstanceDetail>', () => {
    it('스킬을 실제 이름으로 표시한다(경매뷰 중립 표기와 구분)', () => {
        renderDetail(makeItem())
        expect(screen.getByText('강인함')).toBeInTheDocument()
        expect(screen.getByText('대지의 축복')).toBeInTheDocument()
        // ★ 인스턴스 상세는 이름을 내리므로 `스킬 #{code}` 중립 표기가 나오면 안 된다.
        expect(screen.queryByText(/스킬 #104/)).not.toBeInTheDocument()
        expect(screen.queryByText(/스킬 #207/)).not.toBeInTheDocument()
    })

    it('마법(skill1 부재)은 skill2 를 슬롯 2 로 유지한다(슬롯 오표기 금지)', () => {
        renderDetail(
            makeItem({
                template: {
                    typeCode: 1312,
                    mainCategory: 1,
                    subGroup: 3, // 마법
                    element: 1,
                    kind: 2, // 특수
                    displayName: '얼음 마법서',
                },
                skill1: null,
                skill2: { skillCode: 301, name: '빙결' },
            }),
        )
        // 슬롯 2 라벨이 그대로 남고, 슬롯 1 로 재번호되지 않는다.
        expect(screen.getByText('스킬 2')).toBeInTheDocument()
        const skill1Row = screen.getByText('스킬 1').closest('div')
        expect(skill1Row).not.toBeNull()
        expect(
            within(skill1Row as HTMLElement).getByText('-'),
        ).toBeInTheDocument()
        expect(screen.getByText('빙결')).toBeInTheDocument()
    })

    it('스킬이 없으면 두 슬롯을 대시로 표기한다', () => {
        renderDetail(makeItem({ skill1: null, skill2: null }))
        const skill1Row = screen.getByText('스킬 1').closest('div')
        const skill2Row = screen.getByText('스킬 2').closest('div')
        expect(
            within(skill1Row as HTMLElement).getByText('-'),
        ).toBeInTheDocument()
        expect(
            within(skill2Row as HTMLElement).getByText('-'),
        ).toBeInTheDocument()
    })

    it('slotNo 가 있으면(소유자 & INVENTORY) 슬롯과 "경매에 등록"을 낸다', () => {
        renderDetail(makeItem({ slotNo: 7 }))
        expect(screen.getByText(/슬롯 7/)).toBeInTheDocument()
        expect(
            screen.getByRole('link', { name: /경매에 등록/ }),
        ).toBeInTheDocument()
    })

    it('slotNo 가 없으면 슬롯·등록 버튼을 감춘다(헛클릭/404 방지)', () => {
        renderDetail(makeItem({ slotNo: null, location: 'LISTED' }))
        expect(screen.queryByText(/슬롯 /)).not.toBeInTheDocument()
        expect(
            screen.queryByRole('link', { name: /경매에 등록/ }),
        ).not.toBeInTheDocument()
    })

    it('location 을 사람이 읽는 표기로 낸다', () => {
        renderDetail(makeItem({ location: 'LISTED', slotNo: null }))
        expect(screen.getByText('경매 출품 중')).toBeInTheDocument()
    })

    it('골드포스 활성이면 배지와 잔여일(클라 파생)을 낸다', () => {
        renderDetail(
            makeItem({
                goldforceExpireAt: new Date(NOW + 3 * DAY).toISOString(),
            }),
        )
        expect(screen.getByText('골드포스 활성')).toBeInTheDocument()
        expect(screen.getByText('3일 남음')).toBeInTheDocument()
    })

    it('골드포스가 없으면 배지·잔여 행을 렌더하지 않는다', () => {
        renderDetail(makeItem({ goldforceExpireAt: null }))
        expect(screen.queryByText('골드포스 활성')).not.toBeInTheDocument()
        expect(screen.queryByText('골드포스 잔여')).not.toBeInTheDocument()
    })

    it('소유자 마스킹과 발동확률을 표시한다', () => {
        renderDetail(makeItem({ ownerMasked: '레***', skillPercent: 18 }))
        expect(screen.getByText('레***')).toBeInTheDocument()
        expect(screen.getByText('(18%)')).toBeInTheDocument()
    })
})
