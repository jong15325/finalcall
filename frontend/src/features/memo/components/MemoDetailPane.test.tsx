import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MemoDetailPane from './MemoDetailPane'
import type { MemoResponse } from '@/lib/api/memos'

const memo: MemoResponse = {
    memoPublicId: 'M-1',
    type: 5,
    senderNickname: '발신자',
    senderPrimaryCharacterId: 2,
    senderLevel: 1,
    senderGender: 0,
    receiverNickname: '수신자',
    receiverPrimaryCharacterId: 25,
    body: '내용',
    isRead: true,
    createdAt: '2026-08-22T00:00:00Z',
}

function renderPane(box: 'received' | 'sent') {
    return render(
        <MemoDetailPane
            selectedId="M-1"
            box={box}
            memo={memo}
            isPending={false}
            isError={false}
            error={null}
            isDeleting={false}
            onRetry={vi.fn()}
            onBack={vi.fn()}
            onReply={vi.fn()}
            onDelete={vi.fn()}
        />,
    )
}

describe('MemoDetailPane 상대 avatar', () => {
    it('받은함은 발신자 캐릭터를 표시한다', () => {
        renderPane('received')
        expect(screen.getByAltText('발신자 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_02_shamoo.png',
        )
    })

    it('보낸함은 수신자 캐릭터를 표시한다', () => {
        renderPane('sent')
        expect(screen.getByAltText('수신자 프로필')).toHaveAttribute(
            'src',
            '/art/characters/profile/uc_13_avatar.png',
        )
    })
})
