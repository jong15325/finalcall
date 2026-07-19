/**
 * SocialLoginButton (OAuth 자리 확보) — design-system [5.11] · [2.8].
 *
 * **지금은 기능이 없다.** 계약 §2 는 loginId/password 만 다루고 OAuth 백엔드는 미래 에픽이다.
 * 그럼에도 지금 자리를 잡는 이유는 레이아웃 산술이다 — 로그인 폼은 필드가 2개뿐이라 카드가 짧고,
 * 나중에 [구분선 + 46px 버튼 2개 + 안내문]이 들어오면 카드 높이가 약 40% 늘어 그리드 균형과
 * 뷰포트 안 수직 위치가 통째로 바뀐다. 그건 조정이 아니라 재설계다(FC-043 결정 ④).
 *
 * ★ 브랜드색은 규격 그대로 두고(재색 금지 — [2.8] 팔레트 예외) 비활성은 `opacity` 로만 낮춘다.
 *   회색으로 칠하면 "무슨 버튼이 들어올 자리인지"가 사라져 자리 확보의 목적 자체를 잃는다.
 *   `.78` 은 임의값이 아니다: 부모 opacity 가 자식("준비 중" 칩)까지 함께 흐리므로 `.62` 에서는
 *   칩 라벨 대비가 AA 경계였다. `.78` + near-black 칩 라벨이면 합성 후 카카오 8.56 · 네이버 8.25 다.
 *
 * ⚠ 미결(FC-043 판단 대기 2건차): 네이버 규격(흰 라벨 on `#03C75A`)은 원본 자체가 2.25:1 로 AA 미달이고
 *   opacity 합성 후 1.94:1 이다. 브랜드 규격을 우리가 재색할 수 없어 **사용자 결정 대기**로 남긴다.
 *   현 시점 버튼은 비활성이라 1.4.3 면제 구간이지만, 실제 연동 시점에 그대로 두면 위반이 된다.
 *
 * 로고는 각 사 브랜드 자산을 복제하지 않는다 — 규격색 위 중립 도형 + 텍스트 라벨이다(`aria-hidden`).
 * 실제 연동 시 공식 로고 리소스로 교체한다.
 */
type SocialProvider = 'kakao' | 'naver';

const PROVIDER_STYLE: Record<SocialProvider, string> = {
  kakao: 'bg-kakao text-ink',
  naver: 'bg-naver text-primary-fg',
};

const PROVIDER_MARK: Record<SocialProvider, string> = {
  kakao:
    'M9 2.2C5.1 2.2 2 4.6 2 7.6c0 1.9 1.3 3.6 3.3 4.6l-.7 2.6c-.1.3.2.5.4.3l3.1-2c.3 0 .6.1.9.1 3.9 0 7-2.4 7-5.6S12.9 2.2 9 2.2z',
  naver: 'M3.4 3.4h3.7l3.6 5.3V3.4h3.9v11.2h-3.7L7.3 9.3v5.3H3.4z',
};

interface SocialLoginButtonProps {
  provider: SocialProvider;
  /** 버튼 라벨. 로그인은 "…로 계속하기", 가입은 "…로 시작하기". */
  label: string;
  /** 비활성 사유 안내문의 id — 사유 없는 비활성은 금지다([5.1]). */
  describedBy: string;
}

export function SocialLoginButton({ provider, label, describedBy }: SocialLoginButtonProps) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-describedby={describedBy}
      /* 높이 46px 은 [5.11] 스펙값이다 — 모바일에서 오탭이 걱정되면 높이가 아니라 간격으로 푼다. */
      className={`relative flex h-[46px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-md text-value font-bold opacity-[.78] ${PROVIDER_STYLE[provider]}`}
    >
      <svg className="h-[18px] w-[18px] flex-none" viewBox="0 0 18 18" aria-hidden="true">
        <path d={PROVIDER_MARK[provider]} fill="currentColor" />
      </svg>
      {label}
      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface px-2 py-px text-label text-text">
        준비 중
      </span>
    </button>
  );
}
