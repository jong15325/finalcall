import { lazy, createElement } from 'react'
import type { Route } from '@/@types/routes'

/**
 * 자리표시자 라우트 팩토리 (FC-055).
 *
 * ★ 화면마다 빈 파일을 19개 만들지 않는다. 이 티켓이 증명해야 하는 건 **경로가 잡히는가**이지
 *   화면이 아니다(DoD: "화면 내용은 비어 있어도 된다"). 후속 티켓이 화면을 만들 때 각 항목의
 *   `component` 를 실제 뷰의 `lazy(() => import(...))` 로 갈아끼우면 된다.
 */
export function placeholderComponent(title: string): Route['component'] {
    return lazy(async () => {
        const { default: Placeholder } = await import('@/views/Placeholder')
        return { default: () => createElement(Placeholder, { title }) }
    }) as Route['component']
}

/** 라우트 한 줄을 만드는 축약. `authority` 는 빈 배열 = 역할 제한 없음. */
export function placeholderRoute(
    key: string,
    path: string,
    title: string,
    authority: string[] = [],
): Route {
    return { key, path, component: placeholderComponent(title), authority }
}
