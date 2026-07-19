/**
 * 카드 인터랙션 클래스 (FC-058 재작업 — 피드백 4 "hover 시 입체감").
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **템플릿에 이미 있는 관례를 그대로 빌렸다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 그림자 값은 발명이 아니다 — 템플릿 데모의
 * `views/concepts/files/FileManager/components/FileSegment.tsx` 가 **클릭 가능한 카드**에
 * 쓰는 hover 그림자를 그대로 옮겼다:
 *   `hover:shadow-[0_0_1rem_0.25rem_rgba(0,0,0,0.04),0px_2rem_1.5rem_-1rem_rgba(0,0,0,0.12)]`
 * 템플릿에서 "카드가 눌릴 수 있다"를 뜻하는 표현이 이미 정해져 있는데 새 그림자를 지어내면
 * 같은 제품 안에 두 개의 카드 언어가 생긴다(product.md: *"Consistent affordances"*).
 *
 * ★ **확대(scale)는 아주 작다(1.01).** 카드가 커지면 옆 카드를 침범한 것처럼 보이고,
 *   격자에서 여러 장이 연달아 흔들리면 산만하다. 들어 올리는 느낌은 대부분 **그림자**가
 *   만들고 scale 은 그것을 거드는 정도다.
 *
 * ★★ **`motion-safe:` 가 붙은 것만 움직인다.** Tailwind 가 이 접두를
 *    `@media (prefers-reduced-motion: no-preference)` 로 감싸므로, 감소 모드에서는
 *    transform·transition 이 **선언 자체가 되지 않는다.** 그림자는 모션이 아니므로 남는다 —
 *    즉 감소 모드에서도 **hover 피드백은 사라지지 않고** 움직임만 없어진다.
 *    (피드백을 통째로 없애면 감소 모드 사용자는 카드가 눌리는지 알 수 없게 된다.)
 *
 * ★ 시간은 200ms — product.md 의 150~250ms 권장 구간 안이다. 사용자는 흐름 중이라
 *   연출을 기다릴 이유가 없다.
 */

/** 링크·버튼으로 감싼 카드에 붙인다. `focus-visible` 도 같은 들림을 준다(키보드 동등성). */
export const CARD_INTERACTION_CLASS = [
    'group block h-full rounded-2xl',
    'transition-shadow duration-200 ease-out',
    'hover:shadow-[0_0_1rem_0.25rem_rgba(0,0,0,0.04),0px_2rem_1.5rem_-1rem_rgba(0,0,0,0.12)]',
    'focus-visible:shadow-[0_0_1rem_0.25rem_rgba(0,0,0,0.04),0px_2rem_1.5rem_-1rem_rgba(0,0,0,0.12)]',
    'focus-visible:outline-hidden',
    // 움직임은 감소 모드에서 완전히 빠진다. 그림자는 위에서 이미 걸려 남는다.
    'motion-safe:transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01]',
    'motion-safe:focus-visible:-translate-y-0.5',
].join(' ')

/** 행 목록 항목 — 카드가 아니므로 들어 올리지 않고 면만 바뀐다(밀도가 높아 흔들리면 산만하다). */
export const ROW_INTERACTION_CLASS = [
    'group flex items-center gap-3 rounded-lg px-2 py-3',
    'transition-colors duration-150 ease-out',
    'hover:bg-gray-100 dark:hover:bg-gray-700/50',
    'focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700/50',
].join(' ')
