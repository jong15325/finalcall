import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { chatFixture } from '../fixtures/chat'
import ChatCandidate from './ChatCandidate'

describe('ChatCandidate', () => {
    it('Vuexy 연락처·대화·작성 anatomy를 한 화면에 노출한다', () => {
        const view = render(<ChatCandidate fixture={chatFixture} />)

        expect(
            screen.getByRole('region', { name: '채팅 디자인 게이트' }),
        ).toHaveAttribute('data-chat-workbench', 'FC_CHAT_WORKBENCH_317')
        expect(screen.getByLabelText('대화 목록')).toBeVisible()
        expect(
            screen.getAllByRole('button', { name: /대화 열기/ }),
        ).toHaveLength(4)
        expect(screen.getByRole('heading', { name: '루나상점' })).toBeVisible()
        expect(
            screen.getByText('네, 낙찰 확인 후 10분 안에 전달드릴게요.'),
        ).toBeVisible()
        expect(screen.getByRole('form', { name: '메시지 작성' })).toBeVisible()
        expect(
            view.container.querySelectorAll('[data-chat-message="outgoing"]'),
        ).not.toHaveLength(0)
        expect(
            view.container.querySelectorAll('[data-chat-message="incoming"]'),
        ).not.toHaveLength(0)
    })

    it('검색 결과가 없을 때 안내하고 전체 대화로 복귀한다', async () => {
        const user = userEvent.setup()
        render(<ChatCandidate fixture={chatFixture} />)

        const search = screen.getByRole('searchbox', { name: '대화 검색' })
        await user.type(search, '없는 판매자')

        expect(
            screen.getByRole('heading', { name: '일치하는 대화가 없어요' }),
        ).toBeVisible()
        expect(screen.queryByRole('button', { name: /대화 열기/ })).toBeNull()

        await user.click(screen.getByRole('button', { name: '전체 대화 보기' }))
        expect(search).toHaveValue('')
        expect(
            screen.getAllByRole('button', { name: /대화 열기/ }),
        ).toHaveLength(4)
        expect(search).toHaveFocus()
    })

    it('모바일 목록에서 대화를 열고 뒤로 돌아간다', async () => {
        const user = userEvent.setup()
        const view = render(<ChatCandidate fixture={chatFixture} />)
        const list = view.container.querySelector('[data-chat-list]')!
        const conversation = view.container.querySelector(
            '[data-chat-conversation]',
        )!

        expect(list).toHaveClass('flex')
        expect(conversation).toHaveClass('hidden')

        await user.click(
            screen.getByRole('button', { name: '바람길드상점 대화 열기' }),
        )
        expect(list).toHaveClass('hidden')
        expect(conversation).toHaveClass('flex')
        expect(
            screen.getByRole('heading', { name: '바람길드상점' }),
        ).toBeVisible()
        expect(
            screen.getByRole('textbox', { name: '메시지 입력' }),
        ).toHaveFocus()

        await user.click(screen.getByRole('button', { name: '대화 목록으로' }))
        expect(list).toHaveClass('flex')
        expect(conversation).toHaveClass('hidden')
    })

    it('작성한 메시지를 선택 대화 흐름에 즉시 추가한다', async () => {
        const user = userEvent.setup()
        render(<ChatCandidate fixture={chatFixture} />)

        const form = screen.getByRole('form', { name: '메시지 작성' })
        const input = within(form).getByRole('textbox', { name: '메시지 입력' })
        const send = within(form).getByRole('button', { name: '보내기' })
        expect(send).toBeDisabled()

        await user.type(input, '지금 접속하겠습니다.')
        expect(send).toBeEnabled()
        await user.click(send)

        expect(screen.getByText('지금 접속하겠습니다.')).toBeVisible()
        expect(input).toHaveValue('')
        expect(input).toHaveFocus()
        expect(send).toBeDisabled()
    })
})
