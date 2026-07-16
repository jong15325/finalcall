/**
 * returnUrl 안전 파싱 (P-011 — 앱 내부 라우트 한정, 오픈 리다이렉트 방지).
 * 외부 URL·프로토콜 상대 URL(`//host`)·백슬래시 우회를 차단하고 내부 절대경로만 허용한다.
 */
export function sanitizeReturnUrl(raw: string | null | undefined): string {
  if (!raw) return '/';
  // 단일 '/' 로 시작하는 내부 절대경로만 허용
  if (!raw.startsWith('/')) return '/';
  // '//host' (프로토콜 상대) · '/\' (백슬래시 우회) 차단
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
