import type { ReactNode } from 'react'

/**
 * 인증 폼 입력 필드 (FC-078 — 목업 `.modern-auth-input`).
 *
 * ★ 목업 구조(아이콘 + 입력 한 줄, 우측 선택 액션)를 1:1 로 따르되 색은 브랜드 토큰으로 치환한다
 *   (rebuild-contract-map §2.9). 아이콘은 장식이라 `aria-hidden`, 라벨은 `htmlFor` 로 묶는다.
 * ★ `trailing` 은 "준비 중" 자리(중복확인·인증요청) 비활성 버튼을 넘기는 슬롯이다 — 필드는
 *   그리되 뒤가 없는 경로는 **DOM `disabled`** 로만 남긴다(§5 · 404 방지).
 */

interface AuthTextFieldProps {
    id: string
    label: string
    icon: ReactNode
    value: string
    onChange: (value: string) => void
    type?: 'text' | 'password' | 'email'
    autoComplete?: string
    inputMode?: 'text' | 'numeric' | 'email'
    placeholder?: string
    maxLength?: number
    invalid?: boolean
    describedById?: string
    /** 우측 액션(중복확인·인증요청 등). 준비 중 자리는 비활성 버튼을 넘긴다. */
    trailing?: ReactNode
}

export default function AuthTextField({
    id,
    label,
    icon,
    value,
    onChange,
    type = 'text',
    autoComplete,
    inputMode,
    placeholder,
    maxLength,
    invalid = false,
    describedById,
    trailing,
}: AuthTextFieldProps) {
    return (
        <div>
            <label
                htmlFor={id}
                className="text-xs font-semibold text-content-muted"
            >
                {label}
            </label>
            <div className="mt-1.5 flex gap-2">
                <div
                    className={`flex h-11 min-w-0 flex-1 items-center rounded-lg border bg-content-surface transition focus-within:ring-2 ${
                        invalid
                            ? 'border-danger focus-within:ring-danger/30'
                            : 'border-content-line focus-within:border-control-action focus-within:ring-control-action/30'
                    }`}
                >
                    <span
                        aria-hidden
                        className="ml-3.5 flex shrink-0 text-lg text-content-subtle"
                    >
                        {icon}
                    </span>
                    <input
                        id={id}
                        type={type}
                        value={value}
                        autoComplete={autoComplete}
                        inputMode={inputMode}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedById}
                        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-content-fg placeholder:text-content-subtle outline-none"
                        onChange={(event) => onChange(event.target.value)}
                    />
                </div>
                {trailing}
            </div>
        </div>
    )
}
