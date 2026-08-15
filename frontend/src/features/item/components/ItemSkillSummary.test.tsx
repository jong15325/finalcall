import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ItemSkillSummary from './ItemSkillSummary'
import { resolveSkillSlots } from './skillSlots'

/**
 * 스킬 요약 검증 (rebuild-contract-map §2.5·§3.3 폴백).
 * 슬롯 번호를 먼저 매기고 걸러라 — 마법(skill1 부재)의 skill2 를 "슬롯 1" 로 오표기하지 않는다.
 */

describe('resolveSkillSlots', () => {
    it('위치 슬롯을 매긴 뒤 null 을 거른다', () => {
        expect(resolveSkillSlots(11, 22)).toEqual([
            { slot: 1, code: 11, name: null },
            { slot: 2, code: 22, name: null },
        ])
    })

    it('마법: skill1 이 구조적으로 없으면 skill2 는 슬롯 2 그대로(재번호 금지)', () => {
        expect(resolveSkillSlots(null, 7)).toEqual([
            { slot: 2, code: 7, name: null },
        ])
    })

    it('스킬이 하나도 없으면 빈 배열', () => {
        expect(resolveSkillSlots(null, null)).toEqual([])
        expect(resolveSkillSlots(undefined, undefined)).toEqual([])
    })

    it('이름은 인스턴스 상세 맥락에서만 실린다', () => {
        expect(
            resolveSkillSlots(11, 22, {
                skill1Name: '화염',
                skill2Name: null,
            }),
        ).toEqual([
            { slot: 1, code: 11, name: '화염' },
            { slot: 2, code: 22, name: null },
        ])
    })
})

describe('<ItemSkillSummary>', () => {
    it('슬롯 라벨과 스킬 이름 사이에 접근 가능한 공백을 둔다', () => {
        render(
            <ItemSkillSummary
                skill1={11}
                skill2={null}
                skill1Name="공격시간 3 감소"
            />,
        )

        expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(
            '스킬 1 공격시간 3 감소',
        )
    })

    it('경매 맥락(이름 없음)은 스킬 #{code} 중립 표기', () => {
        render(<ItemSkillSummary skill1={11} skill2={22} />)
        expect(screen.getByText('스킬 #11')).toBeInTheDocument()
        expect(screen.getByText('스킬 #22')).toBeInTheDocument()
    })

    it('이름이 있으면(인스턴스 상세) 이름을 표기', () => {
        render(
            <ItemSkillSummary
                skill1={11}
                skill2={null}
                skill1Name="화염 강타"
            />,
        )
        expect(screen.getByText('화염 강타')).toBeInTheDocument()
        expect(screen.queryByText('스킬 #11')).not.toBeInTheDocument()
    })

    it('마법(skill1 부재)은 skill2 만 표기하고 "스킬 #{skill1}" 을 만들지 않는다', () => {
        render(<ItemSkillSummary skill1={null} skill2={7} />)
        expect(screen.getByText('스킬 #7')).toBeInTheDocument()
        const items = screen.getAllByRole('listitem')
        expect(items).toHaveLength(2)
        expect(items[0]).toHaveTextContent('스킬 1 -')
        expect(items[1]).toHaveTextContent('스킬 2 스킬 #7')
    })

    it('스킬이 없으면 두 슬롯 모두 대시로 표시한다', () => {
        render(<ItemSkillSummary skill1={null} skill2={null} />)
        const items = screen.getAllByRole('listitem')
        expect(items).toHaveLength(2)
        expect(items[0]).toHaveTextContent('스킬 1 -')
        expect(items[1]).toHaveTextContent('스킬 2 -')
    })

    it('스킬명을 두 줄로 낸다(스킬1 줄 / 스킬2 줄)', () => {
        render(
            <ItemSkillSummary
                skill1={131}
                skill2={202}
                skill1Name="공격시간 3 감소"
                skill2Name="트리플샷"
            />,
        )
        expect(screen.getByText('공격시간 3 감소')).toBeInTheDocument()
        expect(screen.getByText('트리플샷')).toBeInTheDocument()
        expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('발동확률(%)은 스킬2 줄에만 붙는다', () => {
        render(
            <ItemSkillSummary
                skill1={131}
                skill2={202}
                skill1Name="공격시간 3 감소"
                skill2Name="트리플샷"
                skillPercent={33}
            />,
        )
        // 스킬2 줄(트리플샷)이 %를 포함, 스킬1 줄은 아님
        const items = screen.getAllByRole('listitem')
        expect(items[0]).toHaveTextContent('공격시간 3 감소')
        expect(items[0]).not.toHaveTextContent('%')
        expect(items[1]).toHaveTextContent('트리플샷')
        expect(items[1]).toHaveTextContent('33%')
    })

    it('마법(스킬2만·스킬1 부재)은 스킬2 줄에 % — 슬롯2 유지', () => {
        render(
            <ItemSkillSummary
                skill1={null}
                skill2={202}
                skill2Name="트리플샷"
                skillPercent={33}
            />,
        )
        const items = screen.getAllByRole('listitem')
        expect(items).toHaveLength(2)
        expect(items[0]).toHaveTextContent('스킬 1 -')
        expect(items[1]).toHaveTextContent('스킬 2 트리플샷')
        expect(items[1]).toHaveTextContent('33%')
    })

    it('발동확률 0·부재면 요약에 %를 싣지 않는다', () => {
        render(
            <ItemSkillSummary
                skill1={131}
                skill2={202}
                skill1Name="공격시간 3 감소"
                skill2Name="트리플샷"
                skillPercent={0}
            />,
        )
        expect(screen.queryByText('0%')).not.toBeInTheDocument()
    })

    it('이름이 null 이면 중립 코드로 폴백(미등록·마법 스킬1 부재)', () => {
        render(
            <ItemSkillSummary
                skill1={950}
                skill2={202}
                skill1Name={null}
                skill2Name="트리플샷"
            />,
        )
        expect(screen.getByText('스킬 #950')).toBeInTheDocument()
        expect(screen.getByText('트리플샷')).toBeInTheDocument()
    })
})
