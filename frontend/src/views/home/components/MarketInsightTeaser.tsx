import { PiChartLineUpDuotone, PiRobotDuotone } from 'react-icons/pi'
import Card from '@/components/ui/Card'

/**
 * AI 시세 영역 — **자리만 잡는다** (FC-058 재작업, 피드백 10).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **동작하지 않는 컨트롤을 만들지 않았다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 사용자가 *"추후 설계"* 라 했고 **계약에도 없다**(`/market-prices` 는 컨트롤러조차 없다).
 * FC-057 이 검색 바를 같은 이유로 만들지 않았던 선례를 따른다 —
 * 버튼·입력·차트를 그려두면 **누를 수 있어 보이는데 아무 일도 일어나지 않는다**.
 * 그건 §5.2 "사유 없는 비활성 금지" 위반이자, PRODUCT.md 가 금한 **과장**이다.
 *
 * 그래서 이 컴포넌트에는 **인터랙티브 요소가 하나도 없다.** 버튼도, 링크도, 입력도,
 * 가짜 스파크라인도 없다. 있는 것은 (a) 무엇이 올 자리인지 (b) 아직 없다는 정직한 표시뿐이다.
 *
 * ★ **가짜 데이터를 그리지 않은 것이 특히 중요하다.** 돈이 오가는 거래소에서 예시 차트는
 *   진짜 시세로 오인되면 곧바로 손해로 이어진다(PRODUCT.md: *"돈을 다루는 제품에서 압박은
 *   곧 불신"*, 같은 논리가 허위 데이터에 더 강하게 적용된다).
 *
 * ★ **레이아웃이 자리를 수용한다.** 지금은 한 줄짜리 띠지만 자리·폭·수직 리듬이 확정돼 있어,
 *   계약이 생기면 이 `Card` 안을 채우기만 하면 되고 홈을 재설계할 필요가 없다.
 *
 * ★ 구조가 위아래 섹션과 다르다(캐러셀도 격자도 아닌 **가로 띠**) — 피드백 9 "밋밋하다"에
 *   대한 답이기도 하다. 같은 리듬을 세 번 반복하지 않는다.
 */
const MarketInsightTeaser = () => {
    return (
        <Card
            bodyClass="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
            data-testid="market-insight-teaser"
        >
            <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-2xl text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
                <PiChartLineUpDuotone />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        AI 시세 분석
                    </h2>
                    {/*
                     * 상태를 글자로 못박는다. 아이콘·색만으로 "준비 중"을 암시하면
                     * 사용자는 로딩 실패로 읽는다.
                     */}
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold leading-none text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        <PiRobotDuotone aria-hidden="true" />
                        준비 중
                    </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    거래 기록을 학습해 아이템별 적정가와 최근 낙찰 추이를
                    알려드릴 예정입니다. 아직 제공하지 않는 기능이라 지금은
                    자리만 잡아 두었습니다.
                </p>
            </div>
        </Card>
    )
}

export default MarketInsightTeaser
