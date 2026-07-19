import type { ReactNode } from 'react';

/**
 * AuthStickyActions — 주 CTA 도달(FC-043 결정 ⑧ 구현부).
 *
 * **문제**: 모바일에서 비밀번호 칸을 탭하면 소프트 키보드가 화면 절반을 덮는다. 로그인은 필드가 2개라
 * 데스크톱에선 CTA 가 폴드 위에 있지만, 키보드가 올라오면 CTA 가 키보드 뒤로 밀려 사용자는 제출하려고
 * **키보드를 닫는 동작을 한 번 더** 한다. 가입은 4필드라 360×640 에서 키보드 뒤 잔여가 ~300px 이라
 * CTA 가 애초에 들어오지 않는다.
 *
 * **해법**: 액션 블록을 카드 폭 전체로 넓혀 `position:sticky; bottom:0` 으로 붙인다. `index.html` 의
 * `interactive-widget=resizes-content` 와 짝이다 — 키보드가 뜨면 레이아웃 뷰포트가 줄어들고 sticky
 * 요소는 그 줄어든 바닥(= 키보드 윗변)에 앉는다.
 *
 * ★ `fixed` 가 아니라 `sticky` 인 이유: fixed 는 문서 흐름 밖이라 페이지 하단에 패딩을 따로 확보해야
 *   하고, 카드를 벗어나 OAuth 버튼·푸터 위까지 떠다닌다. sticky 는 부모(폼) 안에서만 붙고 폼을 지나면
 *   자연히 풀린다 — 이 화면에 맞는 건 후자다.
 * ★ 모바일 다단계 분할은 **명시적 기각**이다: 계약에 없는 중간 상태(부분 제출)를 만들거나 비밀번호를
 *   클라이언트에 더 오래 들고 있게 된다.
 * ★ `-mx-5`/`px-5` 는 카드의 모바일 좌우 패딩과 같은 값이다(카드 폭 전체를 덮는다). 카드 패딩이
 *   바뀌면 여기도 함께 바뀌어야 한다.
 * ★ CLS 회피: 높이·top 을 애니메이션하지 않는다.
 *
 * ≥720px 에서는 흐름 안 정위치로 되돌린다 — 포인터 입력이고 키보드가 화면을 가리지 않는다.
 */
export function AuthStickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-[5] -mx-5 mt-2 border-t border-border-muted bg-surface px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4 shadow-[0_-8px_14px_-10px_rgba(15,23,42,.16)] min-[720px]:static min-[720px]:mx-0 min-[720px]:border-0 min-[720px]:p-0 min-[720px]:shadow-none">
      {children}
    </div>
  );
}
