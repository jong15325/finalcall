import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';

/**
 * 테스트 공통 셋업(FC-051).
 * - jest-dom 매처(`toBeInTheDocument` 등) 등록 + 타입 증강.
 * - 테스트 간 DOM 정리(globals:false 라 auto cleanup 이 걸리지 않는다 — 직접 건다).
 * - 인증 스토어 초기화. Zustand 스토어는 모듈 싱글턴이라 세션이 다음 테스트로 새면
 *   "혼자 돌리면 통과, 전체 돌리면 실패"하는 순서 의존이 생긴다.
 */
afterEach(() => {
  cleanup();
  useAuthStore.getState().clearSession();
});

/**
 * jsdom 에 없는 브라우저 API 보충.
 * `CursorLoadMore` 의 무한스크롤 센티넬이 `IntersectionObserver` 를 쓴다 — 없으면 `hasNext=true`
 * 목록이 렌더 중 터진다. 교차 이벤트는 발화시키지 않는다(관찰만 삼키는 no-op).
 */
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = NoopIntersectionObserver;
