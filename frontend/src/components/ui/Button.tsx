import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Button (design-system [5.1], U-021).
 * 주 CTA = ink 블랙 채움 + 흰 글자. 퍼플(primary)은 버튼 채움에 쓰지 않는다(액센트만) — ghost 텍스트만 퍼플.
 * 포커스 링은 전역 :focus-visible(index.css)가 담당(퍼플 2px + offset 2px). 여기서 재정의하지 않는다.
 */
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-fast disabled:pointer-events-none disabled:cursor-not-allowed';

const VARIANTS: Record<ButtonVariant, string> = {
  // ink 블랙 채움. hover 살짝 밝힘 / active 순검정 / disabled 중립 그레이([5.1])
  primary:
    'bg-ink text-primary-fg hover:bg-[#33333a] active:bg-black disabled:bg-primary-disabled disabled:text-[#a1a1aa]',
  // surface + border-strong 경계 + text. 보조 액션(취소 등). hover surface-sunken
  outline:
    'border border-border-strong bg-surface text-text hover:bg-surface-sunken disabled:border-border disabled:text-text-subtle',
  // 투명 + 퍼플 텍스트. hover primary-soft 배경. 최소 강조
  ghost: 'text-primary hover:bg-primary-soft disabled:text-text-subtle',
  // danger 채움 + 흰 글자. 탈퇴 등 파괴적 액션
  danger:
    'bg-danger text-primary-fg hover:brightness-110 active:brightness-95 disabled:bg-primary-disabled disabled:text-[#a1a1aa]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-12 px-5 text-lg',
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
