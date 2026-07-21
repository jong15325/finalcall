import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import TempStorageList from './TempStorageList'
import { EXPIRY_IMMINENT_MS } from '@/features/member/lib/tempStorageExpiry'
import type { TempStorageItem } from '@/lib/api/tempStorage'

/**
 * 임시 보관함 목록 (FC-076 · FC-085 #1).
 *
 * 고정하는 것:
 *  1. 이동 버튼 클릭 → onRelocate(id).
 *  2. pendingId 인 행만 비활성 + "이동 중…"(DOM 속성).
 *  3. 만료 임박(24h 내) 항목이 있으면 상단 경고 노출 + 행 배지.
 *  4. 아트는 인스턴스 상세 조회로 파생하되, 데이터 전/실패 시 **깨진 img 없이** 폴백(#1).
 *     (테스트 환경엔 상세 응답이 없어 항상 폴백 경로를 탄다.)
 *
 * ★ `TempStorageArt` 가 `useItemInstance`(react-query)를 쓰므로 QueryClient 프로바이더가 필요하다.
 */

const NOW = Date.parse('2026-07-21T00:00:00Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

function tempItem(id: string, expireAt: string | null): TempStorageItem {
    return {
        itemInstancePublicId: id,
        storedAt: at(-3 * 86_400_000),
        expireAt,
    }
}

function renderList(
    props: Partial<React.ComponentProps<typeof TempStorageList>> = {},
) {
    const onRelocate = props.onRelocate ?? vi.fn()
    renderWithProviders(
        <TempStorageList
            items={[
                tempItem('ITEM-AAAAAA', at(EXPIRY_IMMINENT_MS / 2)),
                tempItem('ITEM-BBBBBB', null),
            ]}
            pendingId={null}
            now={NOW}
            onRelocate={onRelocate}
            {...props}
        />,
    )
    return { onRelocate }
}

describe('<TempStorageList>', () => {
    it('만료 임박 항목이 있으면 상단 경고를 보인다', () => {
        renderList()
        expect(
            screen.getByText(/만료가 임박한 아이템은 우선 이동/),
        ).toBeInTheDocument()
        // 임박 배지 + 보관 중 배지 공존
        expect(screen.getByText('만료 임박')).toBeInTheDocument()
        expect(screen.getByText('보관 중')).toBeInTheDocument()
    })

    it('임박·만료 항목이 없으면 경고를 숨긴다', () => {
        renderList({
            items: [tempItem('ITEM-CCCCCC', at(2 * EXPIRY_IMMINENT_MS))],
        })
        expect(
            screen.queryByText(/만료가 임박한 아이템은 우선 이동/),
        ).toBeNull()
    })

    it('아트는 상세 링크를 걸고, 상세 응답 전엔 깨진 img 없이 폴백한다(#1)', () => {
        renderList()
        const link = screen.getByRole('link', {
            name: '보관 아이템 #AAAAAA 상세 보기',
        })
        expect(link).toHaveAttribute('href', '/items/ITEM-AAAAAA')
        // 상세 데이터 도착 전/실패 시 실제 img 아트가 아니라 플레이스홀더(깨진 이미지 0)
        expect(link.querySelector('img')).toBeNull()
    })

    it('이동 버튼 클릭 → onRelocate(id)', () => {
        const { onRelocate } = renderList()
        const buttons = screen.getAllByRole('button', {
            name: /빈 슬롯으로 이동/,
        })
        fireEvent.click(buttons[0])
        expect(onRelocate).toHaveBeenCalledWith('ITEM-AAAAAA')
    })

    it('pendingId 인 행만 비활성 + "이동 중…"', () => {
        renderList({ pendingId: 'ITEM-AAAAAA' })
        const moving = screen.getByRole('button', { name: /이동 중/ })
        expect(moving).toBeDisabled()
        // 다른 행은 여전히 이동 가능
        expect(
            screen.getByRole('button', { name: /빈 슬롯으로 이동/ }),
        ).toBeEnabled()
    })
})
