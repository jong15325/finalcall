import type { ComponentType, ReactNode } from 'react'

/**
 * 준비 중 화면 골격 (FC-080) — 미연동(백엔드 없음) 라우트의 정직한 자리.
 *
 * ★ 목업 페이지 헤더(제목·설명) 골격 + 명시적 "준비 중" 배지 + 비활성 skeleton 본문.
 *   실제처럼 보이는 가짜 데이터(상품·게시글·알림 텍스트)를 렌더하지 않는다
 *   (정직성, rebuild-contract-map §5 · FC-070-073 리뷰 M-1).
 * ★ 순수 표시 — 미구현 엔드포인트를 호출하지 않고 상호작용 요소(버튼·링크)를 두지 않는다
 *   (FC-048 · 404 방지). skeleton 본문은 장식이라 `aria-hidden`·`pointer-events-none` 으로
 *   보조기술·포인터에서 감춘다.
 */
interface ComingSoonScaffoldProps {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description: string
    /** 하단 안내(예: "고정가 마켓은 준비 중이에요."). */
    note: string
    /** 목업 레이아웃을 암시하는 비활성 skeleton(가짜 데이터 금지). */
    children: ReactNode
}

function ComingSoonScaffold({
    icon: Icon,
    title,
    description,
    note,
    children,
}: ComingSoonScaffoldProps) {
    return (
        <section className="flex flex-col gap-5">
            <header className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-navy text-gold-bright">
                    <Icon aria-hidden className="size-6" />
                </span>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-bold text-gray-900">
                            {title}
                        </h1>
                        <span className="rounded-full bg-gold-subtle px-2.5 py-0.5 text-xs font-bold text-gold-deep">
                            준비 중
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{description}</p>
                </div>
            </header>

            <div className="overflow-hidden rounded-2xl border border-dashed border-line bg-surface">
                <div
                    aria-hidden
                    className="pointer-events-none select-none p-5 opacity-60"
                >
                    {children}
                </div>
                <p className="border-t border-dashed border-line bg-surface-sunken px-5 py-3 text-center text-xs font-medium text-gray-400">
                    {note}
                </p>
            </div>
        </section>
    )
}

export default ComingSoonScaffold
