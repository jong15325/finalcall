import { useId } from 'react';
import type { ReactNode } from 'react';

/**
 * Checkbox — design-system [5.2] Checkbox.
 * checked 시 퍼플 채움(accent-primary) + 라벨 클릭 토글. 경고문은 describedById 로 연결.
 * 용도: 탈퇴 명시 동의(미체크 시 제출 disabled + 비활성 사유 병기 — D-080).
 */
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  describedById?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, children, describedById, disabled }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={describedById}
        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
      />
      <label htmlFor={id} className="text-body text-text">
        {children}
      </label>
    </div>
  );
}
