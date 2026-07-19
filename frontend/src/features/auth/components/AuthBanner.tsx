import { forwardRef } from 'react';
import type { ReactNode } from 'react';

/**
 * AuthBanner — 폼 위 인라인 배너([5.6] Toast/Notification 의 인라인 변형).
 *
 * 인증 화면의 알림은 화면 모서리에 뜨는 토스트가 **아니다**. 토스트는 자동 소멸하는데 로그인 실패·
 * rate limit 은 사용자가 다음 행동을 결정하기 전까지 남아 있어야 한다([5.6] "에러는 자동 소멸 지양").
 * 폼과 같은 열에 두면 시선 이동도 없다.
 *
 * ★ 배너 안에도 라벨/값 대비를 적용한다 — `text-label`(무슨 일인가) + `text-value`(그래서 어쩌라는
 *   건가). 제목과 본문이 같은 크기면 배너가 회색 문단처럼 보인다([3.1] 원칙 2). 이 규칙 덕에 배너는
 *   카드 안에서 주 CTA 다음으로 큰 활자를 갖는다.
 *
 * ★ 공용 `Alert` 를 쓰지 않는 이유: `Alert` 는 단문 한 줄용이라 눈썹/본문 2축이 없고, 에러 시
 *   **포커스를 옮기기 위한 ref** 도 받지 않는다. 인증 배너는 그 둘이 요건이다.
 *
 * ★ `tabIndex={-1}`: `role="alert"` 는 낭독을 보장하지만 **시각 사용자의 시야는 보장하지 않는다.**
 *   모바일에서 키보드가 올라온 채 제출하면 폼 위 배너가 뷰포트 밖일 수 있다 — 호출부가 이 ref 로
 *   포커스를 옮기고 스크롤한다(FC-043 결정 ⑧).
 */
type BannerTone = 'danger' | 'warning' | 'success';

const TONES: Record<BannerTone, string> = {
  danger: 'bg-danger/[.08] text-danger',
  warning: 'bg-warning/[.08] text-warning',
  success: 'bg-success/[.08] text-success',
};

const ICON_PATHS: Record<BannerTone, ReactNode> = {
  danger: <path d="M10 6v5M10 13.6v.6" strokeWidth="1.8" strokeLinecap="round" />,
  warning: (
    <path d="M10 5.6V10l2.8 1.8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  success: (
    <path
      d="M6.4 10.2l2.4 2.4 4.8-5"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

interface AuthBannerProps {
  tone: BannerTone;
  /** 눈썹 — "무슨 일인가"(예: 로그인 실패 · 요청 제한 · 가입 완료). */
  label: string;
  /** 본문 — "그래서 어쩌라는 건가". 값 축(17px)에 놓인다. */
  children: ReactNode;
}

export const AuthBanner = forwardRef<HTMLDivElement, AuthBannerProps>(function AuthBanner(
  { tone, label, children },
  ref,
) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      className={`mb-6 flex items-start gap-3 rounded-md p-4 focus:outline-none ${TONES[tone]}`}
    >
      <svg
        className="h-5 w-5 flex-none"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8" strokeWidth="1.6" />
        {ICON_PATHS[tone]}
      </svg>
      <div className="min-w-0 flex-1">
        <span className="block text-label opacity-[.85]">{label}</span>
        <strong className="mt-2 block text-value font-bold">{children}</strong>
      </div>
    </div>
  );
});
