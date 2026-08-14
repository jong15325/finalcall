import { Link, useSearchParams } from 'react-router'
import SellPageCandidate, {
    SELL_STUDY_VARIANTS,
} from '../candidates/SellPageCandidate'
import type { SellStudyVariant } from '../candidates/SellPageCandidate'
import type { WorkbenchFixture } from '../types'

const LABELS: Record<SellStudyVariant, string> = {
    balanced: '균형형 2열',
    guided: '가이드형 세로',
    console: '판매자 콘솔형',
    'time-first': '시간 중심형',
    'review-first': '검토 중심형',
    'vertical-flow': '세로 통합형',
    'horizontal-flow': '가로 통합형',
}

// eslint-disable-next-line react-refresh/only-export-components
export const fixture = {
    shellState: { authSession: null },
} satisfies WorkbenchFixture

export default function SellPageStudiesScenario() {
    const [params] = useSearchParams()
    const requested = params.get('variant')
    const variant = SELL_STUDY_VARIANTS.includes(requested as SellStudyVariant)
        ? (requested as SellStudyVariant)
        : 'balanced'
    return (
        <div className="w-full min-w-0 max-w-full">
            <header className="mb-5">
                <h1 className="text-2xl font-bold text-content-fg">
                    판매 등록 페이지 디자인 7안
                </h1>
                <p className="mt-2 text-sm leading-6 text-content-muted">
                    동일한 판매 계약을 유지하면서 아이템 상세, 시간 설정, 최종
                    검토의 우선순위를 비교합니다.
                </p>
                <nav
                    aria-label="판매 등록 디자인 후보"
                    className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1"
                >
                    {SELL_STUDY_VARIANTS.map((id) => (
                        <Link
                            key={id}
                            to={`/__design/sell-page-studies?variant=${id}`}
                            aria-current={id === variant ? 'page' : undefined}
                            className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border bg-content-surface px-3 text-sm font-bold ${id === variant ? 'border-control-action text-control-action-hover' : 'border-content-line text-content-fg'}`}
                        >
                            {LABELS[id]}
                        </Link>
                    ))}
                </nav>
            </header>
            <SellPageCandidate variant={variant} />
        </div>
    )
}
