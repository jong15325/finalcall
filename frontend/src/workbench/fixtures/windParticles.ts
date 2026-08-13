import { WIND_PARTICLE_VARIANTS } from '../scenarioMetadata'
import type { WindParticleVariantId } from '../scenarioMetadata'
import type { WorkbenchFixture } from '../types'

export type WindRenderer =
    | 'streamline'
    | 'silk-ribbon'
    | 'curl-noise'
    | 'smoke'
    | 'gust-bands'
    | 'vortex'
    | 'feathered'
    | 'dust'
    | 'pressure'
    | 'hybrid'

export interface WindParticleOption {
    id: WindParticleVariantId
    rank: number
    name: string
    renderer: WindRenderer
    principle: string
    performance: '낮음' | '중간' | '높음'
    recommendation: string
    tradeoff: string
    particleCount: number
    seed: number
    recommended: boolean
}

export const WIND_PARTICLE_COLORS = {
    bright: '#E4FFFB',
    flow: '#8DE9DC',
    mist: '#A9CED7',
    depth: '#36788A',
} as const

export const WIND_PARTICLE_OPTIONS = [
    {
        id: WIND_PARTICLE_VARIANTS.streamline,
        rank: 3,
        name: '유선 궤적형',
        renderer: 'streamline',
        principle:
            '속도장을 따라 이동한 점의 이전 위치를 짧은 곡선 꼬리로 연결합니다.',
        performance: '낮음',
        recommendation:
            '방향과 속도가 가장 즉시 읽혀 운영 배경으로 안전합니다.',
        tradeoff: '선이 많아지면 기술 시각화처럼 보일 수 있습니다.',
        particleCount: 28,
        seed: 1103,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.silkRibbon,
        rank: 1,
        name: '겹친 비단 리본형',
        renderer: 'silk-ribbon',
        principle:
            '서로 다른 위상의 넓은 Bézier 리본을 screen 합성해 깊이를 만듭니다.',
        performance: '중간',
        recommendation:
            '바람 그림처럼 읽히면서 게임 배경의 회화적 질감과 가장 잘 맞습니다.',
        tradeoff:
            '불투명도를 높이면 콘텐츠보다 먼저 보일 수 있어 절제가 필요합니다.',
        particleCount: 12,
        seed: 2207,
        recommended: true,
    },
    {
        id: WIND_PARTICLE_VARIANTS.curlNoise,
        rank: 6,
        name: '컬 노이즈 흐름장',
        renderer: 'curl-noise',
        principle:
            '삼각함수 기반 curl field의 국소 벡터로 입자를 휘어 보내 난류를 만듭니다.',
        performance: '중간',
        recommendation: '자연스러운 불규칙성이 있어 반복 패턴이 덜 드러납니다.',
        tradeoff: '방향성이 약해지면 연기나 수류로 오해될 수 있습니다.',
        particleCount: 30,
        seed: 3301,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.smoke,
        rank: 7,
        name: '옅은 연무 이류형',
        renderer: 'smoke',
        principle:
            'blur 필터를 건 반투명 타원을 수평 속도장에 실어 부드럽게 이류시킵니다.',
        performance: '중간',
        recommendation: '선 없이도 공기의 층과 흐름을 부드럽게 표현합니다.',
        tradeoff:
            '저사양 환경에서 blur 비용이 있고 대비가 낮으면 존재감이 약합니다.',
        particleCount: 18,
        seed: 4409,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.gustBands,
        rank: 4,
        name: '돌풍 펄스 밴드형',
        renderer: 'gust-bands',
        principle:
            '간격이 다른 넓은 파동 띠가 주기적으로 통과하며 순간 돌풍을 표현합니다.',
        performance: '낮음',
        recommendation: '적은 도형으로도 강약과 진행 방향이 분명합니다.',
        tradeoff: '주기가 짧으면 배너 애니메이션처럼 보여 피로할 수 있습니다.',
        particleCount: 8,
        seed: 5501,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.vortex,
        rank: 8,
        name: '후류 와류형',
        renderer: 'vortex',
        principle:
            '가상의 지형 뒤로 교차하는 소용돌이를 흘려 보내 vortex shedding을 묘사합니다.',
        performance: '높음',
        recommendation: '지형을 타고 흐르는 바람이라는 서사가 가장 강합니다.',
        tradeoff: '국소 회전이 많아 선택 영역이 복잡해질 수 있습니다.',
        particleCount: 24,
        seed: 6607,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.feathered,
        rank: 5,
        name: '깃털 대시형',
        renderer: 'feathered',
        principle:
            '짧은 대시와 양옆 잔선을 속도에 따라 벌려 가벼운 깃털 결을 만듭니다.',
        performance: '낮음',
        recommendation: '모바일에서도 작은 비용으로 바람의 결이 또렷합니다.',
        tradeoff: '확대 화면에서는 입자 단위가 눈에 띌 수 있습니다.',
        particleCount: 32,
        seed: 7703,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.dust,
        rank: 9,
        name: '발광 먼지 흐름형',
        renderer: 'dust',
        principle:
            'radial gradient 점을 lighter 합성으로 겹쳐 공기 중 빛먼지의 흐름을 만듭니다.',
        performance: '중간',
        recommendation: '판타지 분위기와 원소성을 가장 선명하게 전달합니다.',
        tradeoff: '바람보다 마법 파티클로 읽힐 가능성이 큽니다.',
        particleCount: 36,
        seed: 8807,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.pressure,
        rank: 10,
        name: '기압 등고선형',
        renderer: 'pressure',
        principle:
            '움직이는 압력 중심 주변의 등고선과 표식 입자를 함께 이동시킵니다.',
        performance: '중간',
        recommendation: '다른 안과 확실히 구분되는 전략 지도 같은 표현입니다.',
        tradeoff: '자연풍보다 기상 데이터 시각화에 가깝습니다.',
        particleCount: 20,
        seed: 9901,
        recommended: false,
    },
    {
        id: WIND_PARTICLE_VARIANTS.hybrid,
        rank: 2,
        name: '리본·미스트 혼합형',
        renderer: 'hybrid',
        principle:
            '저밀도 리본 위에 blur 미스트를 얹어 방향성과 공기감을 동시에 확보합니다.',
        performance: '높음',
        recommendation:
            '추천안보다 풍부하고 부드러워 고사양 대표 화면에 적합합니다.',
        tradeoff: '두 렌더링을 함께 써 비용과 조율 난도가 가장 높습니다.',
        particleCount: 20,
        seed: 10103,
        recommended: false,
    },
] as const satisfies readonly WindParticleOption[]

export interface WindParticleFixture extends WorkbenchFixture {
    options: typeof WIND_PARTICLE_OPTIONS
    colors: typeof WIND_PARTICLE_COLORS
}

export const windParticleFixture = {
    options: WIND_PARTICLE_OPTIONS,
    colors: WIND_PARTICLE_COLORS,
    shellState: { authSession: null },
} satisfies WindParticleFixture
