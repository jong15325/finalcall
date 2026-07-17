/**
 * MoneyAmount — design-system [5.10].
 * font-num(tabular-nums) + 단위 라벨 + 천단위 구분. 잔액 4종은 라벨로 구분(held=홀드/available=가용).
 * 색만으로 정보 전달 금지 — 라벨 텍스트가 항상 병기된다.
 */
type MoneyTone = 'default' | 'muted' | 'warning' | 'danger';

const TONES: Record<MoneyTone, string> = {
  default: 'text-text',
  muted: 'text-text-muted',
  warning: 'text-warning',
  danger: 'text-danger',
};

interface MoneyAmountProps {
  label: string;
  amount: number;
  /** 단위 접미(예: 캐시·게임머니). 생략 가능. */
  unit?: string;
  tone?: MoneyTone;
  /** 강조 힌트(가용 잔액 등). 기본 md. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

export function MoneyAmount({
  label,
  amount,
  unit,
  tone = 'default',
  size = 'md',
}: MoneyAmountProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-text-muted">{label}</span>
      <span className={`font-num font-bold tabular-nums ${SIZES[size]} ${TONES[tone]}`}>
        {amount.toLocaleString('ko-KR')}
        {unit ? <span className="ml-1 text-sm font-medium text-text-subtle">{unit}</span> : null}
      </span>
    </div>
  );
}
