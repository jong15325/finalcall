import { useState } from 'react'
import { TbClock, TbInfoCircle, TbShieldCheck } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import ItemFrame from '@/features/item/components/ItemFrame'
import '@/features/item/components/CardInfoDialog.css'

export const SELL_STUDY_VARIANTS = [
    'balanced',
    'guided',
    'console',
    'time-first',
    'review-first',
    'vertical-flow',
    'horizontal-flow',
] as const

export type SellStudyVariant = (typeof SELL_STUDY_VARIANTS)[number]

const VARIANT_COPY: Record<SellStudyVariant, { name: string; note: string }> = {
    balanced: {
        name: '균형형 2열',
        note: '아이템 상세와 판매 설정을 같은 비중으로 비교합니다.',
    },
    guided: {
        name: '가이드형 세로',
        note: '아이템, 가격, 시간, 검토 순서로 자연스럽게 진행합니다.',
    },
    console: {
        name: '판매자 콘솔형',
        note: '설정과 실시간 등록 요약을 한 화면에서 대조합니다.',
    },
    'time-first': {
        name: '시간 중심형',
        note: '정확한 종료 시각과 연장 조건을 가장 먼저 확인합니다.',
    },
    'review-first': {
        name: '검토 중심형',
        note: '입력과 최종 판매 조건의 불일치를 줄이는 구성입니다.',
    },
    'vertical-flow': {
        name: '세로 통합형',
        note: '카드정보, 판매조건, 등록을 한 줄의 작업 흐름으로 연결합니다.',
    },
    'horizontal-flow': {
        name: '가로 통합형',
        note: '카드정보, 판매조건, 등록을 왼쪽에서 오른쪽으로 연결합니다.',
    },
}

export default function SellPageCandidate({ variant }: { variant: SellStudyVariant }) {
    const [saleType, setSaleType] = useState<'auction' | 'fixed'>('auction')
    const [duration, setDuration] = useState(3)
    const [advanced, setAdvanced] = useState(false)
    const [softClose, setSoftClose] = useState(false)
    const endLabels: Record<number, string> = {
        1: '2026. 08. 15. 14:30:00 KST',
        3: '2026. 08. 17. 14:30:00 KST',
        7: '2026. 08. 21. 14:30:00 KST',
    }
    const layoutClass = variant === 'console' || variant === 'horizontal-flow' ? 'lg:grid-cols-3' : variant === 'guided' || variant === 'vertical-flow' ? 'grid-cols-1' : 'lg:grid-cols-2'
    const itemLayout = variant === 'time-first' || variant === 'review-first' ? 'order-2 lg:order-1' : 'order-1 lg:order-1'
    const settingsLayout = variant === 'time-first' ? 'order-1 lg:order-2' : 'order-2 lg:order-2'
    const summaryLayout = variant === 'console' ? 'lg:sticky lg:top-24' : variant === 'review-first' ? 'order-1 lg:order-1' : 'order-2 lg:order-2'

    return (
        <article className={`grid w-full min-w-0 max-w-full grid-cols-1 gap-5 ${layoutClass}`} data-sell-study={variant}>
            <header data-sell-region="header" className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-content-line bg-content-surface p-5 px-6 shadow-sm" style={{ gridColumn: '1 / -1' }}>
                <div><h2 className="text-lg font-bold text-content-fg">{VARIANT_COPY[variant].name}</h2><p className="mt-1 text-sm leading-6 text-content-muted">{VARIANT_COPY[variant].note}</p></div>
                <div className="flex items-center gap-3"><span className="text-xs font-semibold text-content-muted">아이템 확인 → 판매 조건 → 최종 검토</span><span className="inline-flex items-center gap-1 rounded-lg bg-content-soft px-3 py-2 text-xs font-bold text-success-ink"><TbShieldCheck aria-hidden /> 안전 거래</span></div>
            </header>

            <section data-sell-region="item" className={`shop-cardinfo min-w-0 shadow-lg ${itemLayout}`} style={{ maxWidth: 'none', maxHeight: 'none', overflow: 'visible' }} aria-labelledby={`${variant}-item-title`}>
                <div className="ci-title">
                    <span className="ci-mark"><TbShieldCheck aria-hidden /></span>
                    <div><h3 id={`${variant}-item-title`}>황혼의 수호자 갑옷 <small aria-hidden>ITEM DETAILS</small></h3></div>
                    <a className="ml-auto inline-flex min-h-11 items-center rounded-lg border border-content-line px-3 text-xs font-bold text-control-action-hover hover:border-control-action focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2" href="/me/inventory">다시 선택</a>
                </div>
                <div className="ci-scroll">
                    <div className="ci-head">
                        <div className="ci-thumb"><ItemFrame hasSkill imageUrl="/art/items/level1/l/earth/armor.png" name="황혼의 수호자 갑옷" visual={{ goldforceExpireAt: '2026-09-30T00:00:00Z' }} size="frame" now={Date.parse('2026-08-14T05:30:00Z')} /></div>
                        <dl className="ci-attrs"><ModalDetail label="아이템명" value="황혼의 수호자 갑옷" /><ModalDetail label="종류" value="대지 · 방어구" valueClass="el-earth" /><ModalDetail label="등급 / 채널" value="전설 · 전체 채널" /><ModalDetail label="핵심 속성" value="방어력 +128 · 체력 +340" /><ModalDetail label="골드포스" value="활성 · 47일 남음" /><ModalDetail label="보관함" value="12 / 40 · 판매 가능" /></dl>
                    </div>
                    <div className="ci-panel"><h3>특수 스킬</h3><ul className="skill-list"><li><span className="n">1</span><span>대지의 가호 · 피해 감소 <b className="pct">12%</b></span></li><li><span className="n">2</span><span>불굴 · 체력 20% 이하 방어력 증가</span></li></ul></div>
                </div>
            </section>

            <section data-sell-region="settings" className={`min-w-0 overflow-hidden rounded-2xl border border-content-line bg-content-surface shadow-sm ${settingsLayout}`} aria-labelledby={`${variant}-settings-title`}>
                <div className="flex min-w-0 items-center justify-between gap-3 border-b border-content-line px-5 py-4"><div><h3 className="text-base font-bold text-content-fg" id={`${variant}-settings-title`}>판매 조건 설정</h3><p className="mt-1 text-xs text-content-muted">가격과 거래 방식을 입력하세요.</p></div></div>
                <div className="mt-5 flex border-b border-content-line" role="tablist" aria-label="판매 방식">
                    <button className={`min-h-11 border-b-2 px-5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus ${saleType === 'auction' ? 'border-control-action text-control-action-hover' : 'border-transparent text-content-muted hover:text-content-fg'}`} role="tab" aria-selected={saleType === 'auction'} onClick={() => setSaleType('auction')}>경매</button>
                    <button className={`min-h-11 border-b-2 px-5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus ${saleType === 'fixed' ? 'border-control-action text-control-action-hover' : 'border-transparent text-content-muted hover:text-content-fg'}`} role="tab" aria-selected={saleType === 'fixed'} onClick={() => setSaleType('fixed')}>고정가</button>
                </div>
                {saleType === 'auction' ? (
                    <div className="grid gap-5 p-5">
                        <div className="grid gap-4 sm:grid-cols-2"><MoneyField label="시작가" value="120,000" /><MoneyField label="즉시 구매가 (선택)" value="280,000" /></div>
                        <div className="grid gap-3">
                            <div className="flex items-start gap-3 rounded-xl bg-content-soft p-4"><TbClock aria-hidden className="mt-1 shrink-0 text-control-action-hover" /><div><strong className="block text-sm text-content-fg">즉시 시작</strong><span className="mt-1 block text-xs leading-5 text-content-muted">등록이 완료되는 즉시 경매가 시작됩니다.</span></div></div>
                            <div className="grid grid-cols-3 gap-2" aria-label="경매 기간">
                                {[1, 3, 7].map((day) => <button key={day} aria-pressed={duration === day} className={`min-h-11 rounded-xl border px-3 py-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2 ${duration === day ? 'border-control-action bg-content-soft text-control-action-hover shadow-sm' : 'border-content-line bg-content-surface text-content-fg hover:border-control-action hover:bg-content-soft'}`} type="button" onClick={() => setDuration(day)}><strong className="block font-bold">{day}일</strong><span className="block text-xs text-content-muted">{day * 24}시간</span></button>)}
                            </div>
                            <div className="rounded-lg bg-content-soft p-3"><span className="block text-xs font-bold text-content-muted">예상 종료 시각</span><strong className="mt-1 block break-words text-base font-bold tabular-nums text-content-fg">{endLabels[duration]}</strong><small className="mt-1 block text-xs leading-5 text-content-muted">선택한 {duration}일 뒤 같은 시각에 종료됩니다.</small></div>
                            <button className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-content-line text-left text-sm font-bold text-content-fg hover:text-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2" type="button" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>고급 시간 설정 <span className="text-xs font-semibold text-content-muted">{advanced ? '접기' : '직접 설정 · 소프트클로즈'}</span></button>
                            {advanced && <div className="grid gap-3 rounded-lg border border-content-line p-3 text-sm"><label className="grid gap-2 font-bold text-content-fg">직접 종료 시각 (KST)<input className="w-full min-w-0 rounded-lg border border-content-line bg-content-surface px-3 py-2.5 text-sm text-content-fg focus:border-control-action focus:outline-none focus:ring-2 focus:ring-control-action/30" type="datetime-local" defaultValue="2026-08-17T14:30" /></label><label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={softClose} onChange={(event) => setSoftClose(event.target.checked)} /> 마감 직전 입찰 시 자동 연장</label>{softClose && <p>마감 60초 전 입찰 시 120초 연장 · 최대 2026. 08. 17. 15:30:00 KST</p>}</div>}
                        </div>
                    </div>
                ) : <div className="grid gap-5 p-5"><MoneyField label="판매가" value="240,000" /><div className="flex gap-2 rounded-lg bg-content-soft p-3 text-sm text-content-muted"><TbInfoCircle aria-hidden /><p><strong>판매 기한은 서버가 자동 결정합니다.</strong><span>현재 기본 7일이며, 정확한 종료 시각은 등록 응답에서 확정됩니다.</span></p></div></div>}
            </section>

            <aside data-sell-region="summary" className={`min-w-0 overflow-hidden rounded-2xl border border-content-line bg-content-surface shadow-sm lg:sticky lg:top-24 ${summaryLayout}`} aria-label="판매 등록 요약">
                <div className="border-b border-content-line px-5 py-4"><span className="block text-xs font-bold text-content-muted">등록 요약</span><strong className="mt-1 block text-sm text-content-fg">{saleType === 'auction' ? '경매 · 즉시 시작' : '고정가 판매'}</strong></div>
                <dl className="min-w-0 divide-y divide-content-line px-5 py-2"><Detail label={saleType === 'auction' ? '시작가' : '판매가'} value={saleType === 'auction' ? '120,000 코드' : '240,000 코드'} /><Detail label="예상 수수료" value={saleType === 'auction' ? '6,000 코드' : '12,000 코드'} />{saleType === 'auction' && <Detail label="종료" value={endLabels[duration]} />}</dl>
                <div className="min-w-0 border-t border-content-line bg-content-soft px-5 py-4"><span className="block text-xs font-bold text-content-muted">예상 정산액</span><CodeAmount value={saleType === 'auction' ? 114000 : 228000} mode="full" className="tabular-nums" /></div>
                <div className="grid gap-3 p-5"><button type="button" className="min-h-11 w-full rounded-lg bg-control-action px-4 py-3 text-sm font-bold text-control-action-ink shadow-sm hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2">{saleType === 'auction' ? '경매 등록 검토' : '고정가 판매 검토'}</button><p className="text-center text-xs leading-5 text-content-muted">등록 전 아이템과 판매 조건을 한 번 더 확인해 주세요.</p></div>
            </aside>
        </article>
    )
}

function Detail({ label, value }: { label: string; value: string }) {
    return <div className="grid min-w-0 grid-cols-[minmax(5.5rem,.7fr)_minmax(0,1.3fr)] gap-3 py-2"><dt className="text-xs font-bold text-content-muted">{label}</dt><dd className="min-w-0 break-words text-xs font-semibold tabular-nums text-content-fg">{value}</dd></div>
}

function ModalDetail({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
    return <div className="ci-row"><dt className="k">{label}</dt><dd className={`v ${valueClass}`}>{value}</dd></div>
}

function MoneyField({ label, value }: { label: string; value: string }) {
    return <label className="min-w-0 text-sm font-bold"><span className="mb-2 block text-xs font-bold text-content-fg">{label}</span><div className="flex min-w-0 items-center rounded-lg border border-content-line bg-content-surface focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-action/30"><input className="min-h-11 w-full min-w-0 bg-transparent px-3 py-2.5 text-sm font-bold tabular-nums text-content-fg outline-none placeholder:text-content-subtle" inputMode="numeric" defaultValue={value} aria-label={label} /><b className="shrink-0 px-3 text-xs text-content-muted">코드</b></div></label>
}
