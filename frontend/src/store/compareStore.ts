import { create } from 'zustand'
import {
    loadCompareSelection,
    MAX_COMPARE_ITEMS,
    saveCompareSelection,
} from './compareSession'
import type { CompareReference } from './compareSession'

/**
 * 비교 선택 스토어 (FC-079 — 선택 상태 소유자).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **선택 상태의 단일 소유자다.** FC-068 `CompareToggle` 은 controlled UI(토글 모양·콜백)만
 *    갖고, FC-071 카드는 토글을 얹지 않고 여기로 위임했다. **어느 카드에서 담아도, 어디서
 *    빼도 이 스토어 하나가 진실이다** — 카드·플로팅 바·비교 페이지가 모두 여기를 구독한다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ★ **규칙은 여기, 지속은 어댑터**(`compareSession.ts`). 스토어는 add/remove/최대 3만 알고,
 *   어디에 저장되는지(sessionStorage)는 모른다 — 변경마다 어댑터로 흘려보낸다.
 * ★ **최대 3 초과는 조용히 무시**한다(예외·알럿 없음). 담기 버튼은 가득 차면 `disabled` 로
 *   막히므로(카드가 `full && !pressed` 를 넘긴다) 정상 경로에선 여기 도달하지 않는다 —
 *   경합·stale 클릭에 대한 방어선일 뿐이다.
 */

interface CompareState {
    items: CompareReference[]
    /** 담기/빼기 토글 — 있으면 제거, 없고 여유 있으면 추가(3 초과는 무시) */
    toggle: (ref: CompareReference) => void
    /** listingId 로 제거(비교 바·비교 페이지의 × 버튼) */
    remove: (listingId: string) => void
    /** 전체 해제 */
    clear: () => void
}

export const useCompareStore = create<CompareState>((set) => ({
    // 모듈 초기화 시 세션에서 복원한다(탭 새로고침에도 선택 유지).
    items: loadCompareSelection(),

    toggle: (ref) =>
        set((state) => {
            const exists = state.items.some(
                (item) => item.listingId === ref.listingId,
            )

            let items: CompareReference[]
            if (exists) {
                items = state.items.filter(
                    (item) => item.listingId !== ref.listingId,
                )
            } else if (state.items.length >= MAX_COMPARE_ITEMS) {
                // 가득 참 — 상태를 바꾸지 않는다(방어선, 위 ★).
                return state
            } else {
                items = [...state.items, ref]
            }

            saveCompareSelection(items)
            return { items }
        }),

    remove: (listingId) =>
        set((state) => {
            const items = state.items.filter(
                (item) => item.listingId !== listingId,
            )
            saveCompareSelection(items)
            return { items }
        }),

    clear: () =>
        set(() => {
            saveCompareSelection([])
            return { items: [] }
        }),
}))

/** 선택 목록(참조). 비교 페이지·바가 구독한다. */
export const useCompareItems = (): CompareReference[] =>
    useCompareStore((state) => state.items)

/** 선택 개수 — 카드/바 배지, "N/3" 표기. */
export const useCompareCount = (): number =>
    useCompareStore((state) => state.items.length)

/** 특정 리스팅이 담겼는가(카드 토글의 `pressed`). */
export const useIsCompared = (listingId: string): boolean =>
    useCompareStore((state) =>
        state.items.some((item) => item.listingId === listingId),
    )

/** 가득 찼는가 — 미선택 카드의 담기 버튼을 `disabled` 로 막는 데 쓴다. */
export const useCompareFull = (): boolean =>
    useCompareStore((state) => state.items.length >= MAX_COMPARE_ITEMS)
