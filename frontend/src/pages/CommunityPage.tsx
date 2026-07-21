import { TbMessageCircle } from 'react-icons/tb'
import ComingSoonScaffold from '@/components/common/ComingSoonScaffold'

/**
 * 커뮤니티 `/community` — [준비 중] 커뮤니티 CRUD 미구현(rebuild-contract-map §5).
 *   Notice 는 읽기전용 참조구현이라 사용자 게시판이 아니다.
 *
 * ★ 목업 `board()` 헤더 골격(툴바 + 게시글 목록)만 비활성 skeleton 으로 남긴다.
 *   게시판 엔드포인트를 호출하지 않고 가짜 게시글을 렌더하지 않는다(정직성·FC-048).
 */
export default function CommunityPage() {
    return (
        <ComingSoonScaffold
            icon={TbMessageCircle}
            title="커뮤니티"
            description="거래 후기와 정보를 나누는 게시판이에요."
            note="커뮤니티 게시판은 준비 중이에요."
        >
            {/* 툴바 자리(글쓰기·검색) */}
            <div className="mb-4 flex items-center justify-between gap-2">
                <div className="h-8 w-24 rounded-lg bg-gray-100" />
                <div className="h-8 w-40 rounded-lg bg-gray-100" />
            </div>
            {/* 게시글 목록 자리 */}
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {Array.from({ length: 5 }).map((_, index) => (
                    <li
                        key={index}
                        className="flex items-center gap-3 px-4 py-3"
                    >
                        <div className="h-3 flex-1 rounded bg-gray-100" />
                        <div className="h-3 w-16 rounded bg-gray-100" />
                    </li>
                ))}
            </ul>
        </ComingSoonScaffold>
    )
}
