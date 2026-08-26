import type { WorkbenchFixture } from '../types'

// eslint-disable-next-line react-refresh/only-export-components
export const fixture: WorkbenchFixture = {
    shellState: { authSession: null, unreadMemoCount: 0 },
}

export default function PageActionScenario() {
    return (
        <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 p-6">
            <div>
                <h1 className="text-xl font-bold text-content-fg">
                    페이지 행동 버튼
                </h1>
                <p className="mt-2 text-sm text-content-muted">
                    등록·저장·확인처럼 작업을 완료하는 CTA에만 적용합니다.
                </p>
            </div>
            <div data-page-action-workbench className="flex flex-wrap gap-3">
                <button
                    type="button"
                    data-page-action="primary"
                    className="app-page-action min-h-11 px-5 py-2.5 text-sm font-bold"
                >
                    판매 등록
                </button>
                <button
                    type="button"
                    data-page-action="secondary"
                    className="app-page-action min-h-11 px-5 py-2.5 text-sm font-bold"
                >
                    다시 시도
                </button>
                <button
                    type="button"
                    data-page-action="danger"
                    className="app-page-action min-h-11 px-5 py-2.5 text-sm font-bold"
                >
                    삭제
                </button>
                <button
                    disabled
                    type="button"
                    data-page-action="primary"
                    className="app-page-action min-h-11 px-5 py-2.5 text-sm font-bold"
                >
                    처리 중…
                </button>
            </div>
        </section>
    )
}
