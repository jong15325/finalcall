import { Link, useSearchParams } from 'react-router'
import SellPageDirectionCandidate, {
    SELL_DIRECTION_VARIANTS,
} from '../candidates/SellPageDirectionCandidate'
import type { SellDirectionVariant } from '../candidates/SellPageDirectionCandidate'
import type { WorkbenchFixture } from '../types'

const LABELS: Record<SellDirectionVariant, string> = {
    canvas: 'A 작업 캔버스형',
    document: 'B 문서 편집형',
    guided: 'C 단계 안내형',
}
// eslint-disable-next-line react-refresh/only-export-components -- route loader가 워크벤치 fixture를 함께 소비한다.
export const fixture = {
    shellState: { authSession: null },
} satisfies WorkbenchFixture

export default function SellPageDirectionsScenario() {
    const [params] = useSearchParams()
    const requested = params.get('variant')
    const variant = SELL_DIRECTION_VARIANTS.includes(
        requested as SellDirectionVariant,
    )
        ? (requested as SellDirectionVariant)
        : 'canvas'
    return (
        <div className="w-full min-w-0 max-w-full">
            <header className="mb-5">
                <h1 className="text-2xl font-bold text-content-fg">
                    판매 등록 신규 디자인 3안
                </h1>
                <p className="mt-2 text-sm leading-6 text-content-muted">
                    가독성을 우선해 유명 제품 편집 패턴을 FinalCall의 실제
                    정보와 토큰으로 다시 구성했습니다.
                </p>
                <nav
                    aria-label="신규 판매 등록 디자인 후보"
                    className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1"
                >
                    {SELL_DIRECTION_VARIANTS.map((id) => (
                        <Link
                            key={id}
                            to={`/__design/sell-page-directions?variant=${id}`}
                            aria-current={id === variant ? 'page' : undefined}
                            className={`inline-flex min-h-11 shrink-0 items-center rounded-lg border bg-content-surface px-3 text-sm font-bold ${id === variant ? 'border-control-action text-control-action-hover' : 'border-content-line text-content-fg'}`}
                        >
                            {LABELS[id]}
                        </Link>
                    ))}
                </nav>
            </header>
            <SellPageDirectionCandidate variant={variant} />
        </div>
    )
}
