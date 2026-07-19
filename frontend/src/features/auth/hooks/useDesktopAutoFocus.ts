import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * 첫 필드 자동 포커스 — **데스크톱에서만**(FC-043 결정 ⑧).
 *
 * 모바일에서 진입 즉시 포커스를 주면 소프트 키보드가 올라와 화면 절반과 브랜드·안내를 가린다.
 * 사용자가 "여기가 어디인지" 확인하기 전에 입력을 강요하는 셈이다 — 돈을 다루는 제품의 로그인
 * 화면에서 브랜드를 가리는 것은 특히 나쁘다(피싱 구별 수단을 덮는다).
 *
 * 조건이 `(pointer: fine)` **와** `(min-width: 720px)` 둘 다인 이유: 폭만 보면 태블릿 가로 모드가
 * 데스크톱으로 잡혀 소프트 키보드가 올라오고, 포인터만 보면 좁은 창의 마우스 환경까지 열린다.
 * matchMedia 가 없는 환경(jsdom 등)에서는 아무것도 하지 않는다.
 */
export function useDesktopAutoFocus(ref: RefObject<HTMLInputElement>): void {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(pointer: fine) and (min-width: 720px)').matches) return;
    ref.current?.focus();
  }, [ref]);
}
