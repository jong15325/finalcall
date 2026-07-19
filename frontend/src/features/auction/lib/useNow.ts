import { useEffect, useState } from 'react'

/**
 * 흐르는 시계 (FC-058).
 *
 * ★★ **이건 폴링이 아니다.** 네트워크 요청을 반복하지 않는다 — **로컬 시계만** 흐른다.
 *    카운트다운은 서버가 준 `endAt` 에서 파생되므로, 값을 다시 받지 않아도 남은 시간은 준다.
 *    (그래서 화면에 "실시간 갱신" 문구를 쓸 수 없다. 갱신되는 건 시계지 데이터가 아니다.)
 *
 * ★ **구독자가 몇이든 타이머는 하나다.** 카드마다 `setInterval` 을 걸면 카드 20장에 타이머
 *   20개가 돌고, 각자 다른 순간에 깨어나 **같은 화면의 숫자가 제각각 튄다.** 모듈 레벨에
 *   하나만 두고 나눠 쓴다.
 *
 * ★ 구독자가 0이 되면 타이머를 **끈다** — 카운트다운이 없는 화면에서 배경으로 돌지 않는다.
 */

type Listener = (now: number) => void

const listeners = new Set<Listener>()
let timerId: ReturnType<typeof setInterval> | null = null

function start() {
    if (timerId !== null) return
    timerId = setInterval(() => {
        const now = Date.now()
        for (const listener of listeners) listener(now)
    }, 1000)
}

function stop() {
    if (timerId === null) return
    clearInterval(timerId)
    timerId = null
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener)
    start()
    return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stop()
    }
}

/** 1초마다 갱신되는 현재 시각(ms). 초기값은 마운트 시점이라 첫 프레임부터 정확하다. */
export function useNow(): number {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => subscribe(setNow), [])

    return now
}
