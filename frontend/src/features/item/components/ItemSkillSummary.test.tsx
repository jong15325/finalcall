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
        expect(screen.getAllByRole('listitem')).toHaveLength(1)
    })

    it('스킬 없음이면 emptyLabel(행 높이 통일)', () => {
        render(<ItemSkillSummary skill1={null} skill2={null} />)
        expect(screen.getByText('스킬 없음')).toBeInTheDocument()
    })
})
