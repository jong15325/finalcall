/**
 * 마감 카운트다운 파생 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **전부 `endAt` 에서 파생한다. 하드코딩 금지, 폴링 아님.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 서버가 주는 것은 마감 **시각** 하나뿐이고 "남은 시간"이라는 필드는 없다. 클라이언트가
 * `endAt - now` 로 계산해 흐르게 한다. 값이 매초 변하는 것은 **로컬 시계가 흐르기 때문**이지
 * 데이터를 다시 받아서가 아니다 — 화면에 "실시간 갱신"·"N초마다 새로고침" 같은 문구를
 * 쓰지 마라. 거짓이다.
 *
 * ★ 임계값(5분·30초)은 **도메인 규칙**이다(FC-057 이 유지 항목으로 확정). 시각 취향이 아니라
 *   "언제부터 급한가"의 정의이며, 이 모듈이 그 판정을 **글자로** 낸다 —
 *   색으로 낼 수 없기 때문이다(방침상 우리 색 사용 불가 → 색 단독 전달도 애초에 불가능).
 */

export type CountdownUrgency = 'ended' | 'critical' | 'urgent' | 'normal'

/** 30초 미만 = 초읽기. */
export const CRITICAL_THRESHOLD_MS = 30_000
/** 5분 미만 = 임박. */
export const URGENT_THRESHOLD_MS = 5 * 60_000

export interface Countdown {
    /** 남은 밀리초. 마감했으면 0(음수로 새지 않는다) */
    remainingMs: number
    /** 화면 표기 — "2일 3시간" · "1시간 20분" · "04:31" · "마감" */
    text: string
    urgency: CountdownUrgency
    /** 스크린리더·툴팁용 완전 문장(축약 표기는 소리 내어 읽기 어렵다) */
    ariaText: string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function pad(value: number): string {
    return String(value).padStart(2, '0')
}

/**
 * `endAt`(ISO-8601 UTC) 과 현재 시각으로 카운트다운을 만든다.
 *
 * ★ **표기 단위가 남은 시간에 따라 바뀐다** — 3일 남았는데 초 단위를 보여주면 매초 흔들리는
 *   숫자가 의미 없이 시선을 먹고, 40초 남았는데 "1분 미만"이라고만 하면 정작 필요한 순간에
 *   정보가 없다. 한 시간 미만에서만 `mm:ss` 로 내려간다.
 *
 * ★ 파싱 불가 입력은 예외를 던지지 않고 "마감" 취급한다 — 카드 하나의 이상한 값이 목록
 *   전체를 흰 화면으로 만들면 안 된다.
 */
export function countdownFrom(endAt: string, now: number): Countdown {
    const end = Date.parse(endAt)

    if (!Number.isFinite(end)) {
        return {
            remainingMs: 0,
            text: '마감',
            urgency: 'ended',
            ariaText: '마감 시각을 알 수 없습니다',
        }
    }

    const remainingMs = Math.max(0, end - now)

    if (remainingMs === 0) {
        return {
            remainingMs: 0,
            text: '마감',
            urgency: 'ended',
            ariaText: '마감되었습니다',
        }
    }

    const days = Math.floor(remainingMs / DAY)
    const hours = Math.floor((remainingMs % DAY) / HOUR)
    const minutes = Math.floor((remainingMs % HOUR) / MINUTE)
    const seconds = Math.floor((remainingMs % MINUTE) / 1000)

    let text: string
    let ariaText: string

    if (days > 0) {
        text = `${days}일 ${hours}시간`
        ariaText = `${days}일 ${hours}시간 남음`
    } else if (hours > 0) {
        text = `${hours}시간 ${minutes}분`
        ariaText = `${hours}시간 ${minutes}분 남음`
    } else {
        text = `${pad(minutes)}:${pad(seconds)}`
        ariaText =
            minutes > 0 ? `${minutes}분 ${seconds}초 남음` : `${seconds}초 남음`
    }

    const urgency: CountdownUrgency =
        remainingMs < CRITICAL_THRESHOLD_MS
            ? 'critical'
            : remainingMs < URGENT_THRESHOLD_MS
              ? 'urgent'
              : 'normal'

    return { remainingMs, text, urgency, ariaText }
}

/**
 * 급함을 **글자로** 낸다. 색이 없으므로 이 라벨이 유일한 채널이다(WCAG 1.4.1 이전에 기능 요건).
 * `normal` 은 라벨이 없다 — 전부에 붙이면 아무것도 강조되지 않는다.
 */
export function urgencyLabelOf(urgency: CountdownUrgency): string | null {
    switch (urgency) {
        case 'ended':
            return '마감됨'
        case 'critical':
            return '초읽기'
        case 'urgent':
            return '곧 마감'
        default:
            return null
    }
}
