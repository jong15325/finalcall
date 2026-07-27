import { useRef } from 'react'

/**
 * 6자리 인증 코드 입력 (OTP) — 목업 `template-email-verify.html` §10 이식(FC-138).
 *
 * ★ 목업 구조를 1:1 로 옮긴다 — 한 칸=한 자리, 입력 시 다음 칸 자동 넘김, 백스페이스는 이전 칸,
 *   6자리 붙여넣기는 각 칸에 분배(§10 스크립트 주석). 색은 브랜드 토큰으로 치환(SignupForm 규약).
 * ★ 접근성: `role="group"` + 그룹 라벨(`aria-labelledby`), 각 칸 `aria-label="N번째 자리"`,
 *   `inputmode="numeric"`·`autocomplete="one-time-code"`(1번째 칸). 오류 시 `aria-invalid`.
 * ★ **코드값을 로깅하지 않는다**(계약 §7 보안) — 값은 상위(`onChange`)로만 흘리고 콘솔에 찍지 않는다.
 */

interface OtpInputProps {
    /** 현재 코드(0~6자, 숫자만). 상위가 소유한다. */
    value: string
    onChange: (next: string) => void
    /** 6자리가 모두 채워진 순간 1회 호출(자동 제출). */
    onComplete?: (code: string) => void
    length?: number
    disabled?: boolean
    invalid?: boolean
    /** 그룹 라벨 요소 id(`aria-labelledby`). */
    labelledById: string
}

const onlyDigits = (raw: string) => raw.replace(/\D/g, '')

export default function OtpInput({
    value,
    onChange,
    onComplete,
    length = 6,
    disabled = false,
    invalid = false,
    labelledById,
}: OtpInputProps) {
    const inputsRef = useRef<(HTMLInputElement | null)[]>([])

    const focusCell = (index: number) => {
        const clamped = Math.min(Math.max(index, 0), length - 1)
        inputsRef.current[clamped]?.focus()
    }

    /** 코드 갱신 + 6자리 완성 시 자동 제출 신호. */
    const commit = (next: string) => {
        const trimmed = next.slice(0, length)
        onChange(trimmed)
        if (trimmed.length === length) onComplete?.(trimmed)
    }

    const handleChange = (index: number, raw: string) => {
        const digit = onlyDigits(raw).slice(-1) // 마지막 입력 문자만(교체 입력 대응)
        if (!digit) return
        const chars = value.split('')
        chars[index] = digit
        commit(chars.join('').slice(0, length))
        if (index < length - 1) focusCell(index + 1)
    }

    const handleKeyDown = (
        index: number,
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key === 'Backspace') {
            event.preventDefault()
            const chars = value.split('')
            if (chars[index]) {
                // 현재 칸을 지운다(포커스 유지).
                chars[index] = ''
                onChange(chars.join(''))
            } else if (index > 0) {
                // 빈 칸이면 이전 칸으로 이동하며 그 값을 지운다.
                chars[index - 1] = ''
                onChange(chars.join(''))
                focusCell(index - 1)
            }
        } else if (event.key === 'ArrowLeft') {
            focusCell(index - 1)
        } else if (event.key === 'ArrowRight') {
            focusCell(index + 1)
        }
    }

    const handlePaste = (
        index: number,
        event: React.ClipboardEvent<HTMLInputElement>,
    ) => {
        event.preventDefault()
        const pasted = onlyDigits(event.clipboardData.getData('text'))
        if (!pasted) return
        const chars = value.split('')
        for (let k = 0; k < pasted.length && index + k < length; k += 1) {
            chars[index + k] = pasted[k]
        }
        const next = chars.join('').slice(0, length)
        commit(next)
        focusCell(index + pasted.length)
    }

    const cellClass = invalid
        ? 'border-danger bg-surface text-danger'
        : 'border-line bg-surface-sunken text-gray-900 focus:border-orange'

    return (
        <div
            role="group"
            aria-labelledby={labelledById}
            className="flex justify-between gap-1.5 sm:gap-2"
        >
            {Array.from({ length }, (_, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputsRef.current[index] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    disabled={disabled}
                    aria-label={`${index + 1}번째 자리`}
                    aria-invalid={invalid || undefined}
                    value={value[index] ?? ''}
                    className={`h-14 min-w-0 flex-1 rounded-lg border text-center text-xl font-extrabold tabular-nums outline-none transition focus:ring-2 focus:ring-orange/30 disabled:cursor-not-allowed disabled:text-gray-400 sm:h-[52px] ${cellClass}`}
                    onChange={(event) =>
                        handleChange(index, event.target.value)
                    }
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    onPaste={(event) => handlePaste(index, event)}
                />
            ))}
        </div>
    )
}
