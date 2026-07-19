import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * 테스트 공통 셋업(FC-051 → FC-055 이관).
 * - jest-dom 매처(`toBeInTheDocument` 등) 등록 + 타입 증강.
 * - 테스트 간 DOM 정리(globals:false 라 auto cleanup 이 걸리지 않는다 — 직접 건다).
 *
 * ★ 종전 셋업은 여기서 `useAuthStore.getState().clearSession()` 을 함께 돌렸다. Zustand 스토어는
 *   모듈 싱글턴이라 세션이 다음 테스트로 새면 "혼자 돌리면 통과, 전체 돌리면 실패"하는 순서 의존이
 *   생기기 때문이다. **인증 스토어는 FC-056 에서 이식하므로 그때 이 초기화를 되살려야 한다.**
 *   지금 없는 모듈을 import 하면 러너가 서지 않아 일단 뺐다 — 잊으면 순서 의존이 조용히 돌아온다.
 */
afterEach(() => {
    cleanup()
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
