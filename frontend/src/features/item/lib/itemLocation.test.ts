import { describe, expect, it } from 'vitest'
import { itemLocationLabel } from './itemLocation'

/**
 * 위치 표기 테스트 (FC-077).
 * ★ 실측 enum 은 INVENTORY·TEMP·LISTED 3값(백엔드 `ItemLocation`) — "AUCTION" 이 아니다.
 * ★ 폴백 의무(§3.3): 사전에 없는 값은 값 자체를 노출(무음 실패 방지).
 */
describe('itemLocationLabel', () => {
    it('INVENTORY 는 인벤토리 보관으로 표기', () => {
        expect(itemLocationLabel('INVENTORY')).toBe('인벤토리 보관 중')
    })

    it('TEMP 는 임시 보관으로 표기', () => {
        expect(itemLocationLabel('TEMP')).toBe('임시 보관 중')
    })

    it('LISTED(출품) 는 경매 출품 중으로 표기', () => {
        expect(itemLocationLabel('LISTED')).toBe('경매 출품 중')
    })

    it('미등록 값은 중립 표기로 흘린다(서버가 새 위치를 먼저 배포할 수 있다)', () => {
        expect(itemLocationLabel('ARCHIVED')).toBe('위치 ARCHIVED')
    })
})
