/**
 * 메모 바이트 폭 규칙 + 28바이트 자동 줄바꿈 (memo-domain-spec §8.3 · 백엔드 `StringByteCounter` 재현)
 * — FC-172.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **게임 boundary 와 동일 규칙이어야 한다.** 프론트 미리보기가 게임 실제 표시와 어긋나면
 *   "게임에서 이렇게 보여요" 가 거짓이 된다. 규칙: char code 48–57(숫자)·65–122(A–Z·일부기호·
 *   a–z) = **1바이트**, 그 외(한글 등) = **2바이트**. 백엔드 `getStringByte` metric 과 1:1.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/** 게임 표시 용량 상한(계약 §2.6 본문 `≤112바이트`). */
export const MEMO_MAX_BYTES = 112

/** 게임 한 줄 폭(28바이트) — 자동 줄바꿈 경계. */
export const GAME_WRAP_WIDTH = 28

/** 카운터 경고 임계(90 초과부터 상한 근접 경고). */
export const MEMO_NEAR_BYTES = 90

/** 한 글자의 바이트 폭(1 또는 2). */
export function charByteWidth(ch: string): number {
    const code = ch.charCodeAt(0)
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 122)) return 1
    return 2
}

/**
 * 문자열 전체 바이트 폭(`getStringByte` metric).
 * ★ 백엔드 `StringByteCounter.getStringByte`(UTF-16 **코드유닛** `charAt` 순회)와 완전 동치가
 *   되도록 **코드유닛 단위**로 센다(코드포인트 `for..of` 아님). 보충문자(이모지 등)는 상위/하위
 *   서로게이트 2개로 쪼개져 각 2바이트(합 4) — 백엔드 `charAt` 결과와 일치한다.
 */
export function getStringByte(text: string): number {
    let total = 0
    for (let i = 0; i < text.length; i++) total += charByteWidth(text[i])
    return total
}

/**
 * 28바이트 폭 하드컷 자동 줄바꿈. **글자 중간 절단 없음** — 한 글자가 경계를 넘으면 통째로 다음
 * 줄로 내린다. 입력에 개행이 있으면(방어) 그 자리에서 줄을 끊는다(웹 저장 원문엔 개행 없음).
 * 빈 문자열은 `['']`(한 빈 줄)로 반환해 미리보기 박스가 접히지 않게 한다.
 * ★ 폭 계산은 `getStringByte`와 같은 **코드유닛** 순회로 백엔드 metric 과 일치시킨다.
 */
export function wrap28(text: string): string[] {
    const lines: string[] = []
    let line = ''
    let width = 0

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (ch === '\n') {
            lines.push(line)
            line = ''
            width = 0
            continue
        }
        const b = charByteWidth(ch)
        if (width + b > GAME_WRAP_WIDTH) {
            lines.push(line)
            line = ch
            width = b
        } else {
            line += ch
            width += b
        }
    }
    lines.push(line)
    return lines
}
