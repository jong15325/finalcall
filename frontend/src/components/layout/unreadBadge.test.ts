import { describe, expect, it } from 'vitest'
import { UNREAD_BADGE_CLASS } from './unreadBadge'

describe('읽지 않은 쪽지 배지 대비', () => {
    it('orange 배경에서 작은 숫자에 dark foreground를 사용한다', () => {
        expect(UNREAD_BADGE_CLASS).toContain('bg-control-action')
        expect(UNREAD_BADGE_CLASS).toContain('text-control-action-ink')
        expect(UNREAD_BADGE_CLASS).not.toContain('text-on-strong')
    })
})
