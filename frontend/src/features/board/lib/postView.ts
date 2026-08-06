/**
 * 게시글 표시 헬퍼 — 상대/절대 시각 + 아바타 이니셜 (FC-202).
 *
 * ★ 시각은 계약이 ISO-8601 UTC 로 준다(§1). 화면에서만 로컬 문구로 바꾼다.
 *   메모 목록(`memoView`)과 같은 규칙을 게시판에도 적용하되, 도메인 결합을 피해 별도로 둔다.
 */

const shortDateFormat = new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
})

const fullFormat = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
})

/**
 * 목록·메타용 상대 시각(방금 / N분 전 / N시간 전 / 어제 / N일 전 / MM.DD).
 * 미래·파싱 실패는 방어적으로 처리. `now` 는 테스트 주입용(기본 현재).
 */
export function formatPostTime(iso: string, now: number = Date.now()): string {
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

/** 상세 헤더용 절대 시각(YYYY. MM. DD. HH:MM). 파싱 실패 시 원문. */
export function formatPostTimeFull(iso: string): string {
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? fullFormat.format(ms) : iso
}

/** 아바타 이니셜(닉네임 첫 글자). 빈 값이면 물음표. */
export function avatarInitial(nickname: string | undefined): string {
    const trimmed = nickname?.trim()
    return trimmed && trimmed.length > 0 ? [...trimmed][0] : '?'
}
