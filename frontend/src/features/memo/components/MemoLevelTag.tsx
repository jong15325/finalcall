import { genderLabel } from '@/features/memo/lib/memoView'

/**
 * 레벨/성별 골드 태그 (FC-172) — 게임 캐릭터 메타(발신자 스냅샷).
 *
 * ★ 게임 캐릭터 메타라 브랜드 **골드**(강조색)를 소면적으로 쓴다(가격 강조와 같은 축). 새 색을
 *   만들지 않고 `gold`/`gold-bright`/`gold-deep` 토큰만 사용. 값이 없으면(미지) 렌더하지 않는다.
 */
interface MemoLevelTagProps {
    level: number | undefined
    gender: number | undefined
}

function MemoLevelTag({ level, gender }: MemoLevelTagProps) {
    if (level === undefined) return null
    const g = genderLabel(gender)
    return (
        <span className="inline-flex flex-none items-center gap-1 rounded-full border border-gold-deep bg-gradient-to-br from-gold-bright to-gold px-2 py-px text-[11px] font-extrabold leading-tight text-gray-900">
            Lv.{level}
            {g && (
                <span className="border-l border-gray-900/25 pl-1 font-bold">
                    {g}
                </span>
            )}
        </span>
    )
}

export default MemoLevelTag
