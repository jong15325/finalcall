import { TbSpeakerphone, TbMessageCircle, TbGift } from 'react-icons/tb'
import type { ComponentType } from 'react'
import type { BoardResponse, BoardType } from '@/lib/api/boards'

/**
 * 게시판 유형별 표시 메타 + 쓰기 권한 판정 (계약 §6 · board-domain-spec §3~§4) — FC-202.
 *
 * ★ 여기서 정하는 것은 **표시 제어**뿐이다 — 실제 인가는 서버가 판정한다(계약 §1.2).
 *   글쓰기 버튼/FAB 노출, 수정·삭제 노출을 서버 권위와 어긋나지 않게 "미리 가리는" 용도.
 */

export interface BoardTypeMeta {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    /** 허브·목록 배지 문구 힌트 */
    label: string
}

/**
 * 유형 아이콘·라벨. 알 수 없는 유형은 일반(GENERAL)로 폴백한다 — 서버가 우리가 모르는 유형을
 * 먼저 배포해도 렌더가 깨지지 않게(계약 §3.3 태도).
 */
export function boardTypeMeta(boardType: BoardType): BoardTypeMeta {
    switch (boardType) {
        case 'NOTICE':
            return { icon: TbSpeakerphone, label: '공지' }
        case 'EVENT':
            return { icon: TbGift, label: '이벤트' }
        case 'GENERAL':
        default:
            return { icon: TbMessageCircle, label: '커뮤니티' }
    }
}

/** 유형이 이벤트인가 — 목록을 배너 카드로 그릴지 판단(EVENT 변주). */
export function isEventBoard(boardType: BoardType): boolean {
    return boardType === 'EVENT'
}

/**
 * 이 사용자가 이 게시판에 글을 쓸 수 있는가(표시 제어).
 * `ADMIN_ONLY`→관리자만 · `AUTHENTICATED`→로그인 회원 누구나. 서버가 최종 판정한다(§1.2).
 */
export function canWriteBoard(
    board: Pick<BoardResponse, 'writePolicy'>,
    isAuthenticated: boolean,
    isAdmin: boolean,
): boolean {
    if (board.writePolicy === 'ADMIN_ONLY') return isAdmin
    if (board.writePolicy === 'AUTHENTICATED') return isAuthenticated
    // 알 수 없는 정책은 보수적으로 숨긴다(서버가 어차피 막는다).
    return false
}

/** 글쓰기 버튼을 숨길 때의 안내 문구(비관리자에게 관리자 전용 게시판일 때 등). */
export function writeDisabledLabel(board: BoardResponse): string | null {
    if (board.writePolicy === 'ADMIN_ONLY') return '관리자만 작성'
    return null
}
