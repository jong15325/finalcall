import { wrap28 } from '@/features/memo/lib/memoBytes'

/**
 * "게임에서 이렇게 보여요" 미리보기 (FC-172) — 28바이트 폭 자동 줄바꿈을 게임 boundary 와 동일
 * 규칙(`wrap28`)으로 재현한다.
 *
 * ★ 게임 인게임 쪽지창을 표현하는 자리라 **다크 + 모노스페이스** 별도 스킨을 쓴다(디자인 게이트
 *   승인 범위 — 앱 UI 색과 구분되는 유일한 예외). 새 색을 만들지 않고 브랜드 `navy`/`gold` 토큰과
 *   그레이 스케일만 사용. 폭 계산·줄바꿈은 `memoBytes`(백엔드 규칙 1:1)에 위임한다.
 * ★ 실시간(작성) 미리보기는 `body` prop 변화에 따라 그대로 다시 그린다(내부 상태 없음).
 */
interface GamePreviewProps {
    body: string
    /** 헤더 라벨(기본 "게임에서 이렇게 보여요 · 28바이트 폭") */
    title?: string
    /** 눈금자 표시 여부(작성 화면에서 폭 감을 준다) */
    showRuler?: boolean
    /** 하단 캡션 설명 */
    caption?: string
}

function GamePreview({
    body,
    title = '게임에서 이렇게 보여요 · 28바이트 폭',
    showRuler = false,
    caption,
}: GamePreviewProps) {
    const lines = wrap28(body)

    return (
        <div className="overflow-hidden rounded-lg border border-navy-700 bg-navy-900">
            <div className="flex items-center gap-1.5 border-b border-navy-700 bg-navy-800 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gold-bright">
                <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-gold-bright"
                />
                {title}
            </div>
            {showRuler && (
                <div
                    aria-hidden
                    className="whitespace-pre px-3 pt-1.5 font-mono text-[10px] tracking-wide text-gray-500"
                >
                    ····5···10···15···20···25··│
                </div>
            )}
            <div className="px-3 py-2 font-mono text-[13px] leading-relaxed text-gray-100">
                {lines.map((line, index) => (
                    // 줄 내용은 순서가 곧 정체성이라 index 키가 안정적이다(줄 병합·삽입 없음).
                    <div key={index} className="whitespace-pre">
                        {line === '' ? ' ' : line}
                    </div>
                ))}
            </div>
            {caption && (
                <p className="px-3 pb-2.5 text-[10px] leading-snug text-gray-400">
                    {caption}
                </p>
            )}
        </div>
    )
}

export default GamePreview
