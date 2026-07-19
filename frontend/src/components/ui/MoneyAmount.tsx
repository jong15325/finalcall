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

/*
 * 금액은 값 축이다([3.2] `text-value` = "금액 기본"). sm·md 가 같은 단계로 모이는 것은 중복이 아니라
 * [3.1] 원칙 3("중간 크기를 만들지 않는다")의 결과다 — 종전 16/18 은 고유 역할이 없는 잔여값이었고,
 * 금액에 실재하는 단계는 **기본(17)과 수치 승격(28)** 둘뿐이다. 호출부 API 는 그대로 둔다.
 * 상세 현재가의 `text-figure-xl`(44) 최고 승격은 화면당 1개 제약이 걸려 있어 화면 티켓(FC-049) 소관이다.
 */
const SIZES = {
  sm: 'text-value font-bold',
  md: 'text-value font-bold',
  lg: 'text-figure',
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
      <span className="text-label text-text-muted">{label}</span>
      {/* `font-num` 이 tabular-nums 를 담당한다 — 유틸을 따로 붙이지 않는다([3.4]). */}
      <span className={`font-num ${SIZES[size]} ${TONES[tone]}`}>
        {amount.toLocaleString('ko-KR')}
        {unit ? <span className="ml-1 text-micro text-text-subtle">{unit}</span> : null}
      </span>
    </div>
  );
}
