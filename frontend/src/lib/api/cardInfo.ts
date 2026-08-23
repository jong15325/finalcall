export interface CardInfoCodeLabel {
    code: number
    label: string
}

export interface CardInfoCodeLabelAbbreviation extends CardInfoCodeLabel {
    abbreviation: string
}

export interface CardInfoSkill {
    slot: 1 | 2
    code: number | null
    name: string | null
    percent: number | null
}

export interface CardInfoResponse {
    level: number
    shortName: string
    formalName: string
    category: CardInfoCodeLabel
    kind: CardInfoCodeLabelAbbreviation
    element: CardInfoCodeLabelAbbreviation
    channelLimit: {
        code: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT'
        label: string
    }
    frame: {
        type: 'BLACK' | 'GOLD'
        label: string
        remainingGoldforceDays: number
    }
    skills: [CardInfoSkill, CardInfoSkill]
    calculatedAt: string
    validUntil: string | null
}
