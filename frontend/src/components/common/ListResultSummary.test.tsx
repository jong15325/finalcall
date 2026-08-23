import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ListResultSummary from './ListResultSummary'

describe('<ListResultSummary>', () => {
    it('검색어와 결과 수를 분리된 위계와 live region으로 표시한다', () => {
        const { container } = render(
            <ListResultSummary
                count={1248}
                query="이빌아이"
                fallback="로딩 중"
            />,
        )

        const summary = container.querySelector('[data-list-result-summary]')
        expect(summary).toHaveAttribute('aria-live', 'polite')
        expect(summary).toHaveAttribute('aria-atomic', 'true')
        expect(screen.getByText('“이빌아이”')).toBeVisible()
        expect(screen.getByLabelText('1248건')).toHaveTextContent('1,248건')
    })

    it('결과 수가 아직 없으면 절제된 안내 문구를 표시한다', () => {
        render(<ListResultSummary fallback="목록을 확인하고 있어요" />)

        expect(screen.getByText('목록을 확인하고 있어요')).toBeVisible()
    })
})
