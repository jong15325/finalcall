/**
 * 테마 토글 버튼 (U-005 — data-theme 토글 1회). 실제 값 오버라이드는 index.css.
 *
 * U-005(다크 팔레트) 확정 전까지 숨김 — 다크 CSS 오버레이가 없어 눌러도 시각 변화가 없는
 * 비기능 컨트롤이었다(시각적 no-op). 마크업/사용처는 보존해 U-005에서 그대로 되살린다.
 * 부활 시: 아래 주석 처리된 본문을 복구하고 themeStore 기본값을 조정한다.
 */
export function ThemeToggle() {
  return null;
}
