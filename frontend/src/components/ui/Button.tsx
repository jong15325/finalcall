import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Button (design-system [5.1], U-021).
 * 주 CTA = ink 블랙 채움 + 흰 글자. 퍼플(primary)은 버튼 채움에 쓰지 않는다(액센트만) — ghost 텍스트만 퍼플.
 * 포커스 링은 전역 :focus-visible(index.css)가 담당(퍼플 2px + offset 2px). 여기서 재정의하지 않는다.
 */
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-fast disabled:pointer-events-none disabled:cursor-not-allowed';

/*
 * 비활성 라벨은 `text-disabled`(#5F5F66)다 — v0.6 에서 `#A1A1AA` 폐기, v0.6.1 에서 토큰 승격([2.4]·[5.1]).
 * 종전값은 `primary-disabled`(#E4E4E7) 위 2.02:1 로 라벨이 사실상 소실됐다. WCAG 1.4.3 이 비활성 컨트롤을
 * 면제하므로 위반은 아니었으나 **면제는 "검사 대상이 아니다"이지 "읽히지 않아도 된다"가 아니다** —
 * 이 시스템은 이미 "사유 없는 비활성 금지"를 명문화했고, 사유 문장이 가리키는 버튼 라벨이 안 읽히면
 * 짝이 맞지 않는다(rate limit 잠금이 실제 사례다). 새 값은 4.99:1 로 면제에 기대지 않는다.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  // ink 블랙 채움. hover 살짝 밝힘 / active 순검정 / disabled 중립 그레이([5.1])
  primary:
    'bg-ink text-primary-fg hover:bg-[#33333a] active:bg-black disabled:bg-primary-disabled disabled:text-text-disabled',
  // surface + border-strong 경계 + text. 보조 액션(취소 등). hover surface-sunken
  outline:
    'border border-border-strong bg-surface text-text hover:bg-surface-sunken disabled:border-border disabled:text-text-subtle',
  // 투명 + 퍼플 텍스트. hover primary-soft 배경. 최소 강조
  ghost: 'text-primary hover:bg-primary-soft disabled:text-text-subtle',
  // danger 채움 + 흰 글자. 탈퇴 등 파괴적 액션
  danger:
    'bg-danger text-primary-fg hover:brightness-110 active:brightness-95 disabled:bg-primary-disabled disabled:text-text-disabled',
};

/*
 * 크기 = 역할 단계다([5.1] v0.6). **버튼 라벨은 문장이 아니므로** md 를 본문(13)에 두고 주 CTA(lg)만
 * 값 단계(17)로 올린다 — 크기가 곧 "이게 주 액션"이라는 신호가 되게 한다([3.1] 원칙 4).
 * 굵기는 스케일 토큰이 굽는 하한 위에서 각 단계 범위 안으로만 올린다(micro 400~700 · body 400~500 ·
 * value 600~800).
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-micro font-medium',
  md: 'h-11 px-4 text-body font-medium',
  lg: 'h-12 px-5 text-value font-bold',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 로딩 시 aria-busy + 중복 제출 차단. 라벨은 유지한다([5.1]). */
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
