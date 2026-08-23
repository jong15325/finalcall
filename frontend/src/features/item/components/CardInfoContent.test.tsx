import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { cardInfoFixture } from '@/test/cardInfoFixture'
import CardInfoContent from './CardInfoContent'

const axes = { subGroup: 1, kind: 3, element: 2, level: 9 }

describe('<CardInfoContent>', () => {
    it('서버 통용명·채널·BLACK 0일과 두 스킬 슬롯을 그대로 표시한다', () => {
        render(
            <CardInfoContent
                {...axes}
                cardInfo={cardInfoFixture({
                    shortName: 'Lv.3 불검',
                    formalName: '3레벨 칼',
                    kind: { code: 3, label: '칼', abbreviation: '검' },
                    skills: [
                        {
                            slot: 1,
                            code: 101,
                            name: '공격력 증가',
                            percent: null,
                        },
                        { slot: 2, code: null, name: null, percent: null },
                    ],
                })}
            />,
        )

        expect(screen.getByText('3레벨 칼')).toBeInTheDocument()
        expect(
            screen.getByRole('img', { name: 'Lv.3 불검' }),
        ).toBeInTheDocument()
        expect(screen.getByText('초보채널 이상')).toBeInTheDocument()
        expect(screen.getByText('0')).toBeInTheDocument()
        expect(screen.getByText('공격력 증가')).toBeInTheDocument()
        expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('일반필·스필 명칭과 GOLD 잔여 일수를 서버 응답 그대로 표시한다', () => {
        const { rerender } = render(
            <CardInfoContent
                {...axes}
                cardInfo={cardInfoFixture({
                    shortName: 'Lv.4 불필',
                    formalName: '4레벨 마법',
                })}
            />,
        )
        expect(screen.getByText('4레벨 마법')).toBeInTheDocument()

        rerender(
            <CardInfoContent
                {...axes}
                cardInfo={cardInfoFixture({
                    shortName: 'Lv.9 바스필',
                    formalName: '9레벨 스페셜필',
                    frame: {
                        type: 'GOLD',
                        label: '골드',
                        remainingGoldforceDays: 999,
                    },
                })}
            />,
        )
        expect(screen.getByText('9레벨 스페셜필')).toBeInTheDocument()
        expect(screen.getByText('999')).toBeInTheDocument()
    })
})
