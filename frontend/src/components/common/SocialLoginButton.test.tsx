import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SocialLoginButton from './SocialLoginButton'

/**
 * 소셜 로그인 버튼 (U-021 · design-system §5.11).
 *
 * 고정하는 것:
 *  1. provider 별 라벨(카카오/네이버 계속하기)을 텍스트로 노출한다(로고는 aria-hidden).
 *  2. 활성 시 클릭이 onClick 을 부른다.
 *  3. disabled 시 DOM 비활성 + "준비 중" 병기 + 클릭 미호출.
 */
describe('<SocialLoginButton>', () => {
    it('provider 라벨을 노출한다', () => {
        render(<SocialLoginButton provider="kakao" />)
        expect(
            screen.getByRole('button', { name: /카카오로 계속하기/ }),
        ).toBeInTheDocument()
    })

    it('활성 시 클릭이 onClick 을 부른다', () => {
        const onClick = vi.fn()
        render(<SocialLoginButton provider="naver" onClick={onClick} />)
        fireEvent.click(
            screen.getByRole('button', { name: /네이버로 계속하기/ }),
        )
        expect(onClick).toHaveBeenCalledOnce()
    })

    it('비활성 시 DOM 비활성이고 "준비 중"을 병기하며 클릭이 무시된다', () => {
        const onClick = vi.fn()
        render(
            <SocialLoginButton disabled provider="kakao" onClick={onClick} />,
        )
        const button = screen.getByRole('button', { name: /카카오로 계속하기/ })
        expect(button).toBeDisabled()
        expect(screen.getByText('준비 중')).toBeInTheDocument()
        fireEvent.click(button)
        expect(onClick).not.toHaveBeenCalled()
    })
})
