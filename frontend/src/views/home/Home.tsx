import ClosingSoonSection from './components/ClosingSoonSection'
import MarketInsightTeaser from './components/MarketInsightTeaser'
import NewListingsSection from './components/NewListingsSection'

/**
 * 홈 — 첫 실화면 (FC-058 → 재작업).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **마케팅 랜딩이 아니라 거래소 첫 화면이다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 히어로 배너·슬로건·"지금 시작하세요" 버튼이 없다. 대신 **스크롤 0px 에 실제 카운트다운**이
 * 있다 — 이 사이트가 무엇을 하는 곳인지 **카피로 주장하지 않고 데이터로 증명**한다.
 *
 * ★ **섹션마다 구조가 다르다**(사용자가 이 배치를 칭찬해 유지한다). 같은 카드 격자를
 *   반복하면 스크롤이 무의미해진다:
 *     ① 마감 임박 = **캐러셀**(무대) + **행목록**(대기열)
 *     ② AI 시세 = **가로 띠**(자리만)
 *     ③ 새 매물 = **격자**
 *
 * ★ **섹션별로 쿼리가 따로다** → 한 섹션이 죽어도 나머지는 산다(에러 격리).
 *   이 파일이 상태를 전혀 모르는 것이 곧 격리다 — 전역 로딩·전역 에러 배너가 없는 이유.
 *
 * ★ **`/shops`(고정가)·`/market-prices`(시세) 데이터 섹션은 없다** — 계약에는 있으나
 *   백엔드 컨트롤러가 없다. FC-048 이 계약만 보고 넣었다가 홈에 에러 배너가 떴다.
 *   **계약에 있어도 구현이 없으면 화면에 올리지 않는다.** AI 시세는 그래서
 *   **데이터가 아니라 자리**만 잡았다(`MarketInsightTeaser`).
 *
 * ★ 폭·여백은 셸의 다른 화면(`NotFound`)과 같은 관례를 쓴다(`max-w-[1280px]`).
 *   섹션 간격은 모바일 `gap-8` → `lg:gap-10` — 좁은 화면에서 40px 간격은 스크롤만 늘린다.
 *
 * ★★ **`max-w-full overflow-x-hidden`** — 참고 대시보드(`EcommerceDashboard`)가 최상위에
 *    거는 가드를 그대로 가져왔다. 안쪽 어딘가가 폭을 넘겨도 **페이지 전체가 옆으로 밀리지
 *    않게** 막는 마지막 방어선이다. 원인을 고치는 것과 별개로(그건 각 컴포넌트가 했다),
 *    가로 스크롤은 모바일에서 가장 티나는 파손이라 그물을 하나 더 둔다.
 */
const Home = () => {
    return (
        <div className="mx-auto flex w-full max-w-full flex-col gap-8 overflow-x-hidden px-4 py-6 sm:px-6 lg:gap-10 lg:py-8 xl:max-w-[1280px]">
            <h1 className="sr-only">FinalCall 게임 아이템 경매</h1>
            <ClosingSoonSection />
            <MarketInsightTeaser />
            <NewListingsSection />
        </div>
    )
}

export default Home
