/**
 * 버튼 채움 색 확장 (FC-057).
 *
 * ★ 컴포넌트가 아니라 상수라 **파일을 분리**했다(`LinkButton.tsx` 와 한 파일이면 react-refresh
 *   경고가 난다 — 컴포넌트 파일은 컴포넌트만 내보내야 HMR 이 정확히 동작한다).
 */

/**
 * 주 CTA 채움 = **near-black**(design-system [2.2] `ink` #18181B 계열).
 *
 * ★ 템플릿 `variant="solid"` 는 `--primary`(블루 #2A85FF)를 쓴다. 우리 CTA 는 블랙이고
 *   퍼플/블루는 **채움에 쓰지 않는다** — 퍼플은 워드마크 마감선 하나로 아껴 쓰는 액센트다.
 *   템플릿 Button 의 자체 확장점(`customColorClass`)만 사용해 컴포넌트를 포크하지 않는다.
 *
 * ★ **단일 출처다.** 두 군데 이상에서 손으로 같은 클래스를 적으면 CTA 색이 갈라진다
 *   (구 프론트에서 워드마크가 갈라졌던 것과 같은 종류의 사고).
 *
 * 대비: `gray-900` #171717 채움 / 흰 배경 17.93:1, 채움 위 흰 글자 17.93:1.
 * 다크: `gray-100` #F5F5F5 채움 / `gray-900` 배경 16.44:1, 채움 위 near-black 글자 16.44:1.
 */
export const inkColorClass = () =>
    'bg-gray-900 hover:bg-gray-800 active:bg-black text-white dark:bg-gray-100 dark:hover:bg-white dark:text-gray-900'
