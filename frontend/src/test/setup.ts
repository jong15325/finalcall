import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { __resetRefreshStateForTest } from '@/lib/api/client'

/**
 * 테스트 공통 셋업(FC-051 → FC-055 이관).
 * - jest-dom 매처(`toBeInTheDocument` 등) 등록 + 타입 증강.
 * - 테스트 간 DOM 정리(globals:false 라 auto cleanup 이 걸리지 않는다 — 직접 건다).
 *
 * ★★ **모듈 싱글턴 상태를 매 테스트 뒤에 비운다**(FC-056 복원). 이게 없으면 한 테스트가 심어둔
 *    세션·in-flight refresh 가 다음 테스트로 새어 **"혼자 돌리면 통과, 전체 돌리면 실패"** 하는
 *    순서 의존이 생긴다. 그 실패는 원인이 자기 파일 안에 없어서 추적이 유난히 어렵다.
 *    - `useAuthStore` — zustand 스토어(+persist 저장소)
 *    - `__resetRefreshStateForTest` — `apiClient` 의 single-flight refresh 프로미스
 *    새 전역 싱글턴을 만들면 여기에 초기화를 추가하라.
 */
afterEach(() => {
    cleanup()
    useAuthStore.getState().clearSession()
    __resetRefreshStateForTest()
    localStorage.clear()
    sessionStorage.clear()
})

/**
 * jsdom 에 없는 브라우저 API 보충.
 * 무한스크롤 센티넬이 `IntersectionObserver` 를 쓴다 — 없으면 목록이 렌더 중 터진다.
 * 교차 이벤트는 발화시키지 않는다(관찰만 삼키는 no-op).
 */
class NoopIntersectionObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
        return []
    }
}

globalThis.IntersectionObserver = NoopIntersectionObserver

/**
 * 템플릿 컴포넌트(Dialog·Drawer·Select 등)가 쓰는 `matchMedia` 는 jsdom 에 없다.
 * 없으면 해당 컴포넌트를 렌더하는 순간 터진다.
 */
if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList
}
