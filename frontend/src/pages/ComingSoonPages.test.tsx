import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import CommunityPage from './CommunityPage'
import WalletChargePage from './WalletChargePage'

/**
 * 준비 중 자리 화면 통일 (FC-080).
 *
 * 고정하는 것:
 *  1. 목업 헤더(제목·설명) + 명시적 "준비 중" 배지 + 하단 안내가 렌더된다.
 *  2. **미구현 엔드포인트 호출 0**(FC-048) — 렌더만으로 fetch 를 부르지 않는다.
 *
 * ★ 아이템 마켓은 FC-094 에서 `/shops` 실기능으로 승격되어 준비 중 자리에서 빠졌다.
 */

const CASES = [
    {
        name: '커뮤니티',
        Page: CommunityPage,
        title: '커뮤니티',
        note: /커뮤니티 게시판은 준비 중이에요/,
    },
    {
        name: '코드 충전',
        Page: WalletChargePage,
        title: '코드 충전',
        note: /결제 연동은 준비 중이에요/,
    },
] as const

describe('준비 중 자리 화면(FC-080)', () => {
    it.each(CASES)(
        '$name — 헤더·"준비 중" 배지·안내를 렌더하고 네트워크를 부르지 않는다',
        ({ Page, title, note }) => {
            const fetchSpy = vi.fn(() =>
                Promise.reject(new Error('미구현 엔드포인트 호출 금지')),
            )
            vi.stubGlobal('fetch', fetchSpy)

            renderWithProviders(<Page />)

            expect(
                screen.getByRole('heading', { name: title }),
            ).toBeInTheDocument()
            expect(screen.getByText('준비 중')).toBeInTheDocument()
            expect(screen.getByText(note)).toBeInTheDocument()

            // ★ 미호출 확인 — 자리 화면은 백엔드를 건드리지 않는다.
            expect(fetchSpy).not.toHaveBeenCalled()
        },
    )
})
