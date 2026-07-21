import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { okEnvelope, renderWithProviders } from '@/test/renderWithProviders'
import BidHistory from './BidHistory'
import type { BidSummary } from '@/lib/api/auctions'
import type { OffsetPage } from '@/types/api'

/**
 * 입찰 이력 무한스크롤 (FC-087 — 목업 §17).
 *
 * 고정하는 것:
 *  1. **"더 보기" 버튼을 두지 않는다** — 스크롤 감시점(sentinel)으로 다음 offset 페이지를 잇는다.
 *  2. 감시점이 교차하면 다음 페이지를 **누적**해 이전 페이지 행과 함께 보인다.
 *  3. 마지막 페이지까지 받으면 더 청하지 않는다(목록 끝 문구도 표시하지 않음).
 *
 * ★ jsdom 기본 `IntersectionObserver` 는 no-op(교차를 발화 안 함)이라, 이 테스트에서만
 *   observe 시 즉시 교차를 알리는 스텁으로 갈아끼운다(`unstubGlobals`가 매 테스트 뒤 되돌린다).
 */

function bid(id: string, amount: number): BidSummary {
    return {
        bidPublicId: id,
        bidderMasked: 'le***',
        amount,
        status: 'OUTBID',
        createdAt: '2026-07-21T00:00:00Z',
    }
}

/** page 0 → 2건(총 3건 중), page 1 → 1건. loaded<total 이면 다음 페이지가 있다. */
function stubBidPages() {
    const pageOne: OffsetPage<BidSummary> = {
        content: [bid('B-1', 2_000_000), bid('B-2', 1_900_000)],
        page: 0,
        size: 20,
        totalElements: 3,
        totalPages: 2,
    }
    const pageTwo: OffsetPage<BidSummary> = {
        content: [bid('B-3', 1_800_000)],
        page: 1,
        size: 20,
        totalElements: 3,
        totalPages: 2,
    }
    const fetchSpy = vi.fn((input: RequestInfo | URL) => {
        const raw = typeof input === 'string' ? input : input.toString()
        const page = new URL(raw, 'http://localhost').searchParams.get('page')
        return Promise.resolve(okEnvelope(page === '1' ? pageTwo : pageOne))
    })
    vi.stubGlobal('fetch', fetchSpy)
    return fetchSpy
}

/** observe 하면 곧바로 교차를 통지하는 IntersectionObserver 스텁(마이크로태스크로 지연). */
function stubFiringObserver() {
    class FiringObserver implements IntersectionObserver {
        readonly root = null
        readonly rootMargin = ''
        readonly thresholds: readonly number[] = []
        constructor(private cb: IntersectionObserverCallback) {}
        observe(target: Element): void {
            queueMicrotask(() =>
                this.cb(
                    [
                        {
                            isIntersecting: true,
                            target,
                        } as IntersectionObserverEntry,
                    ],
                    this,
                ),
            )
        }
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
            return []
        }
    }
    vi.stubGlobal('IntersectionObserver', FiringObserver)
}

describe('<BidHistory> 무한스크롤', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('★ "더 보기" 버튼이 없다(스크롤 누적으로 대체)', async () => {
        stubBidPages()
        renderWithProviders(<BidHistory auctionPublicId="A-1" />)

        // 1페이지(2건)가 렌더될 때까지 기다린다.
        await waitFor(() =>
            expect(screen.getAllByText('le***')).toHaveLength(2),
        )
        expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull()
    })

    it('감시점 교차로 다음 offset 페이지를 누적 로드한다', async () => {
        stubBidPages()
        stubFiringObserver()
        renderWithProviders(<BidHistory auctionPublicId="A-1" />)

        // 1페이지(2건) 렌더 후, 감시점 교차로 2페이지(1건)가 누적돼 3건이 된다.
        await waitFor(() =>
            expect(screen.getAllByText('le***')).toHaveLength(3),
        )
    })
})
