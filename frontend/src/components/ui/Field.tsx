import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

/**
 * Field (Input) — design-system [5.2].
 * 라벨 항상 가시(placeholder 라벨 대용 금지). error 는 aria-describedby 로 연결.
 * default 경계 = border-strong(라이트 컨트롤 1.4.11 대비 3:1), error = danger, focus = primary 경계.
 *
 * ★ FC-050 에서 [5.2] 미구현분 3건을 채웠다(새 결정이 아니라 스펙 복귀다).
 *   ① **함몰 웰 바탕** — 카드가 순백인데 인풋도 순백이면 둘의 구분이 1.27:1 짜리 선 하나에만 걸린다.
 *      한 단 내리면 "여기에 쓰는 곳"이 면으로 읽히고, 포커스 시 순백으로 **떠오르며** 활성 필드가
 *      카드와 같은 높이로 올라온다 — 상태 변화가 색이 아니라 층으로 표현된다(FC-043 결정 ③).
 *      대비 재검증(sunken #E8E8EB 위): 입력값 14.49 · placeholder 4.59 · 경계 3.17 — 전건 AA.
 *   ② **focus 링** — [5.2]가 규정한 `primary-soft` 3px 링이 빠져 있었다. 경계색만 바뀌면 포커스가
 *      1px 선 하나에 실려 함몰 바탕 위에서 잘 읽히지 않는다.
 *   ③ **disabled 표현** — 제출 중 필드 잠금(FC-043 상태 카탈로그 ③)에 대응. 바탕은 그대로 두고
 *      글자·경계를 낮춘다(바탕까지 같이 내리면 평상 상태와 구분이 사라진다).
 *
 * ★ `forwardRef` — 인증 화면의 포커스 규칙(데스크톱 첫 필드 자동 포커스 / 에러 필드로 포커스 이동)이
 *   인풋 ref 를 요구한다. id 는 `useId` 소유라 호출부가 DOM 을 되짚을 수단이 없었다.
 */
interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className = '', ...rest },
  ref,
) {
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
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        /* placeholder 는 값이 아니라 안내다 — 굵기·자간을 값 축에서 되돌린다([3.1] 원칙 2) */
        className={`h-11 rounded-md border px-4 text-value text-text transition-colors duration-fast placeholder:font-normal placeholder:tracking-normal placeholder:text-text-subtle focus:bg-surface focus:ring-[3px] disabled:cursor-not-allowed disabled:border-border disabled:text-text-subtle ${
          error
            ? 'border-danger bg-surface focus:border-danger focus:ring-danger/20'
            : 'border-border-strong bg-surface-sunken focus:border-primary focus:ring-primary-soft'
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
});
