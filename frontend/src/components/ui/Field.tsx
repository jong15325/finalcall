import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

/**
 * Field (Input) — design-system [5.2].
 * 라벨 항상 가시(placeholder 라벨 대용 금지). error 는 aria-describedby 로 연결.
 * default 경계 = border-strong(라이트 컨트롤 1.4.11 대비 3:1), error = danger, focus = primary 경계.
 */
interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, className = '', ...rest }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {/* 폼 필드 라벨은 `text-label`(11/700/+0.12em)이 정본이다([3.2]) — 작고 자간이 넓어진 라벨 축이
          크고 자간이 좁은 입력값 축과 반대 방향으로 갈린다([3.1] 원칙 2). */}
      <label htmlFor={id} className="text-label text-text">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 rounded-md border bg-surface px-3 text-value text-text placeholder:text-text-subtle transition-colors duration-fast focus:border-primary ${
          error ? 'border-danger' : 'border-border-strong'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="text-body text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-body text-text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
