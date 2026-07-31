import type { MemoResponse, MemoSummary } from '@/lib/api/memos'

/**
 * 메모 표시 헬퍼 (계약 §2.6) — FC-172.
 *
 * ★ 서버가 준 분해값(닉네임·레벨·성별·시각)을 화면 문구로만 바꾼다. `type` 판정·상대 선택은
 *   받은함/보낸함 축에 따라 다르므로 한 곳에 모아 목록·상세·작성이 같은 규칙을 쓰게 한다.
 */

/** 메모함 축. */
export type MemoBox = 'received' | 'sent'

/** 회원 메모(USER) type 값 — 그 외(0/14 등)는 시스템(운영자) 메모. */
export const MEMO_TYPE_USER = 5

/** 시스템(운영자) 메모 여부 — 회원 발신(5)이 아니면 시스템. */
export function isSystemMemo(type: number): boolean {
    return type !== MEMO_TYPE_USER
}

/** 성별 코드 → 라벨(게이트2 (a): 0=남·1=여, 현재 기본 0). 미지 값은 표기 생략. */
export function genderLabel(gender: number | undefined): string | null {
    if (gender === 0) return '남'
    if (gender === 1) return '여'
    return null
}

/**
 * 목록 행에 표시할 상대 닉네임. 받은함=발신자, 보낸함=수신자.
 * 시스템 메모는 발신자 자리에 운영자 표기가 오므로 그대로 senderNickname 을 쓴다.
 */
export function summaryCounterpartName(
    memo: MemoSummary,
    box: MemoBox,
): string {
    if (box === 'sent') return memo.receiverNickname ?? '(수신자)'
    return memo.senderNickname ?? '(발신자)'
}

/** 상세에서 답장할 상대 닉네임. 받은함=발신자, 보낸함=수신자. */
export function detailReplyTarget(memo: MemoResponse, box: MemoBox): string {
    return box === 'sent' ? memo.receiverNickname : memo.senderNickname
}

/** 아바타 이니셜(닉네임 첫 글자). 빈 값이면 물음표. */
export function avatarInitial(nickname: string | undefined): string {
    const trimmed = nickname?.trim()
    return trimmed && trimmed.length > 0 ? [...trimmed][0] : '?'
}

const fullFormat = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
})

/** 상세 헤더용 절대 시각(YYYY. MM. DD. HH:MM). 파싱 실패 시 원문. */
export function formatMemoTimeFull(iso: string): string {
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? fullFormat.format(ms) : iso
}

const shortDateFormat = new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
})

/**
 * 목록용 상대 시각(방금 / N분 전 / N시간 전 / 어제 / MM.DD). 미래·파싱 실패는 방어적으로 처리.
 * `now` 는 테스트 주입용(기본 현재).
 */
export function formatMemoTimeRelative(
    iso: string,
    now: number = Date.now(),
): string {
    const ms = Date.parse(iso)
    if (!Number.isFinite(ms)) return ''

    const diffSec = Math.floor((now - ms) / 1000)
    if (diffSec < 60) return '방금'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}분 전`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}시간 전`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay === 1) return '어제'
    if (diffDay < 7) return `${diffDay}일 전`
    return shortDateFormat.format(ms)
}
