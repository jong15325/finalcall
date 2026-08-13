import {
    FIRE_PARTICLE_VARIANTS,
    WATER_PARTICLE_VARIANTS,
} from '../scenarioMetadata'
import type {
    FireParticleVariantId,
    WaterParticleVariantId,
} from '../scenarioMetadata'
import type { WorkbenchFixture } from '../types'

export type ElementParticlePerformance = '낮음' | '중간' | '높음'

export interface ElementParticleOption<
    TId extends string,
    TRenderer extends string,
> {
    id: TId
    rank: number
    name: string
    renderer: TRenderer
    principle: string
    performance: ElementParticlePerformance
    recommendation: string
    particleCount: number
    seed: number
}

export type FireRenderer =
    | 'ember-plume'
    | 'flame-tongues'
    | 'heat-shimmer'
    | 'combustion-wave'
    | 'spark-fountain'
    | 'cinder-vortex'
    | 'lava-crack'
    | 'smoke-ember'
    | 'flare-pulse'
    | 'hybrid-inferno'

export type WaterRenderer =
    | 'rain-impact'
    | 'expanding-ripples'
    | 'stream-ribbons'
    | 'mist-advection'
    | 'caustic-shimmer'
    | 'bubble-rise'
    | 'droplet-trails'
    | 'wavelets'
    | 'refractive-beads'
    | 'hybrid-current'

export type FireParticleOption = ElementParticleOption<
    FireParticleVariantId,
    FireRenderer
>
export type WaterParticleOption = ElementParticleOption<
    WaterParticleVariantId,
    WaterRenderer
>

export const FIRE_PARTICLE_COLORS = {
    core: '#FFF1B8',
    flame: '#FF9B30',
    ember: '#FF4F1F',
    smoke: '#6C493C',
    depth: '#6F2318',
} as const

export const WATER_PARTICLE_COLORS = {
    bright: '#E1FAFD',
    flow: '#64DCFF',
    mid: '#3C9DC9',
    mist: '#B5E9F2',
    depth: '#225C82',
} as const

export const FIRE_PARTICLE_OPTIONS = [
    {
        id: FIRE_PARTICLE_VARIANTS.emberPlume,
        rank: 3,
        name: '불씨 상승 기둥형',
        renderer: 'ember-plume',
        principle: '크기가 다른 불씨를 열 상승류에 실어 위로 휘어 올립니다.',
        performance: '낮음',
        recommendation: '불의 방향과 온도가 작은 입자만으로 또렷하게 읽힙니다.',
        particleCount: 30,
        seed: 1201,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.flameTongues,
        rank: 1,
        name: '겹친 불꽃 혀형',
        renderer: 'flame-tongues',
        principle:
            '가늘어지는 복수 Bézier 면을 겹쳐 불꽃 혀의 흔들림을 만듭니다.',
        performance: '중간',
        recommendation:
            '작은 영역에서도 불의 실루엣과 유기적인 움직임이 가장 분명합니다.',
        particleCount: 14,
        seed: 2303,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.heatShimmer,
        rank: 6,
        name: '열기 아지랑이형',
        renderer: 'heat-shimmer',
        principle:
            '얇은 굴절 파동선을 수직으로 흘려 뜨거운 공기층을 암시합니다.',
        performance: '낮음',
        recommendation: '입자 과잉 없이도 높은 온도를 절제해 전달합니다.',
        particleCount: 12,
        seed: 3407,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.combustionWave,
        rank: 5,
        name: '연소 파동형',
        renderer: 'combustion-wave',
        principle:
            '타원형 화염 전선이 중심에서 퍼지며 연소의 압력 변화를 표현합니다.',
        performance: '중간',
        recommendation: '정적인 배경 위에서도 불이 확장되는 순간이 읽힙니다.',
        particleCount: 10,
        seed: 4513,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.sparkFountain,
        rank: 4,
        name: '불티 분수형',
        renderer: 'spark-fountain',
        principle:
            '포물선으로 솟은 불티가 양옆으로 갈라지며 중력에 따라 떨어집니다.',
        performance: '낮음',
        recommendation:
            '화면 우상단에 생동감을 주면서 움직임의 출발점이 명확합니다.',
        particleCount: 26,
        seed: 5609,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.cinderVortex,
        rank: 8,
        name: '재 와류형',
        renderer: 'cinder-vortex',
        principle: '식어가는 재가 상승축을 감싸는 나선 궤도로 이동합니다.',
        performance: '중간',
        recommendation: '불꽃과 다른 깊은 잔화 분위기를 만들 수 있습니다.',
        particleCount: 24,
        seed: 6701,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.lavaCrack,
        rank: 9,
        name: '용암 균열 발광형',
        renderer: 'lava-crack',
        principle:
            '불규칙 분기선의 밝은 중심과 어두운 외곽으로 균열 열광을 만듭니다.',
        performance: '낮음',
        recommendation: '입자 없이도 강한 화염 원소성을 전달합니다.',
        particleCount: 10,
        seed: 7817,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.smokeEmber,
        rank: 7,
        name: '연기·불씨 혼합형',
        renderer: 'smoke-ember',
        principle:
            'blur 연기층 사이로 작은 불씨를 올려 연소 후류를 표현합니다.',
        performance: '높음',
        recommendation: '불꽃뿐 아니라 공기의 부피와 깊이까지 함께 보입니다.',
        particleCount: 22,
        seed: 8903,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.flarePulse,
        rank: 2,
        name: '섬광 펄스형',
        renderer: 'flare-pulse',
        principle:
            '짧은 시간창에만 방사형 섬광이 커졌다 사라져 화염 강약을 만듭니다.',
        performance: '낮음',
        recommendation:
            '절제된 빈도로 사용하면 작은 비용 대비 인지가 가장 빠릅니다.',
        particleCount: 8,
        seed: 9011,
    },
    {
        id: FIRE_PARTICLE_VARIANTS.hybridInferno,
        rank: 10,
        name: '불꽃·연무 복합형',
        renderer: 'hybrid-inferno',
        principle:
            '불꽃 혀, 불씨, 낮은 연기층을 한 장면에 제한적으로 합성합니다.',
        performance: '높음',
        recommendation:
            '대표 장면의 풍부함은 가장 크지만 운영 비용 비교에 유용합니다.',
        particleCount: 20,
        seed: 10133,
    },
] as const satisfies readonly FireParticleOption[]

export const WATER_PARTICLE_OPTIONS = [
    {
        id: WATER_PARTICLE_VARIANTS.rainImpact,
        rank: 3,
        name: '빗방울 충돌형',
        renderer: 'rain-impact',
        principle:
            '짧은 낙하선이 수면에 닿는 순간 작은 타원 파문으로 전환됩니다.',
        performance: '낮음',
        recommendation: '물의 낙하와 표면 반응을 한눈에 이해할 수 있습니다.',
        particleCount: 28,
        seed: 1301,
    },
    {
        id: WATER_PARTICLE_VARIANTS.expandingRipples,
        rank: 1,
        name: '겹친 확산 파문형',
        renderer: 'expanding-ripples',
        principle: '서로 다른 위상의 타원 파문이 감쇠하며 반복 확장됩니다.',
        performance: '낮음',
        recommendation:
            '절제된 선만으로 물의 영역과 깊이가 가장 안정적으로 읽힙니다.',
        particleCount: 18,
        seed: 2411,
    },
    {
        id: WATER_PARTICLE_VARIANTS.streamRibbons,
        rank: 2,
        name: '수류 리본형',
        renderer: 'stream-ribbons',
        principle: '가느다란 Bézier 리본이 층을 이루며 수평 수류를 만듭니다.',
        performance: '중간',
        recommendation:
            '넓은 물 영역에서 흐르는 방향성과 회화적 질감이 조화롭습니다.',
        particleCount: 12,
        seed: 3511,
    },
    {
        id: WATER_PARTICLE_VARIANTS.mistAdvection,
        rank: 7,
        name: '물안개 이류형',
        renderer: 'mist-advection',
        principle: '얕은 blur 타원을 수면 위 속도장으로 천천히 이동시킵니다.',
        performance: '중간',
        recommendation: '선 없이도 습도와 차가운 공기층을 표현합니다.',
        particleCount: 18,
        seed: 4613,
    },
    {
        id: WATER_PARTICLE_VARIANTS.causticShimmer,
        rank: 5,
        name: '수중 광망형',
        renderer: 'caustic-shimmer',
        principle:
            '휘어진 짧은 광선 망이 교차하며 수면 아래 굴절무늬를 만듭니다.',
        performance: '중간',
        recommendation: '배경색을 과하게 밝히지 않고도 수중 느낌이 분명합니다.',
        particleCount: 20,
        seed: 5717,
    },
    {
        id: WATER_PARTICLE_VARIANTS.bubbleRise,
        rank: 6,
        name: '기포 상승형',
        renderer: 'bubble-rise',
        principle: '크기가 다른 투명 원이 좌우로 흔들리며 위로 부상합니다.',
        performance: '낮음',
        recommendation: '작은 화면에서도 물 원소라는 인지가 빠릅니다.',
        particleCount: 24,
        seed: 6823,
    },
    {
        id: WATER_PARTICLE_VARIANTS.dropletTrails,
        rank: 4,
        name: '물방울 꼬리형',
        renderer: 'droplet-trails',
        principle:
            '둥근 물방울 뒤에 길이와 투명도가 다른 낙하 꼬리를 붙입니다.',
        performance: '낮음',
        recommendation: '기존 빗방울보다 속도감과 수직 흐름이 또렷합니다.',
        particleCount: 26,
        seed: 7907,
    },
    {
        id: WATER_PARTICLE_VARIANTS.wavelets,
        rank: 8,
        name: '잔물결 군집형',
        renderer: 'wavelets',
        principle:
            '짧은 사인 곡선을 여러 높이에 배치해 잔잔한 표면 흔들림을 만듭니다.',
        performance: '낮음',
        recommendation: '애니메이션 피로가 가장 낮아 장시간 노출에 안전합니다.',
        particleCount: 16,
        seed: 8011,
    },
    {
        id: WATER_PARTICLE_VARIANTS.refractiveBeads,
        rank: 9,
        name: '굴절 구슬형',
        renderer: 'refractive-beads',
        principle:
            'radial gradient 구슬의 밝은 가장자리로 물방울 굴절을 흉내 냅니다.',
        performance: '중간',
        recommendation: '광택과 부피가 선명해 원소 장식으로 눈에 띕니다.',
        particleCount: 22,
        seed: 9137,
    },
    {
        id: WATER_PARTICLE_VARIANTS.hybridCurrent,
        rank: 10,
        name: '수류·물안개 복합형',
        renderer: 'hybrid-current',
        principle:
            '수류 리본 아래 물안개와 소형 파문을 낮은 밀도로 합성합니다.',
        performance: '높음',
        recommendation: '고사양 대표 화면의 깊이 상한을 판단하기 좋습니다.',
        particleCount: 20,
        seed: 10243,
    },
] as const satisfies readonly WaterParticleOption[]

export interface FireParticleFixture extends WorkbenchFixture {
    options: typeof FIRE_PARTICLE_OPTIONS
    colors: typeof FIRE_PARTICLE_COLORS
}

export interface WaterParticleFixture extends WorkbenchFixture {
    options: typeof WATER_PARTICLE_OPTIONS
    colors: typeof WATER_PARTICLE_COLORS
}

export const fireParticleFixture = {
    options: FIRE_PARTICLE_OPTIONS,
    colors: FIRE_PARTICLE_COLORS,
    shellState: { authSession: null },
} satisfies FireParticleFixture

export const waterParticleFixture = {
    options: WATER_PARTICLE_OPTIONS,
    colors: WATER_PARTICLE_COLORS,
    shellState: { authSession: null },
} satisfies WaterParticleFixture
