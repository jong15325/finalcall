import {
    AuctionInfoGroup,
    AuctionInfoRail,
    AuctionTimeDisplay,
} from '@/components/common/AuctionTimeDisplay'
import VuexyBadge from '@/components/common/VuexyBadge'
import { TbClock, TbGavel } from 'react-icons/tb'
import type { ReactNode } from 'react'

export type CountdownFamily =
    'mini-timecode' | 'auction-info-rail' | 'split-status-time'

export interface CountdownTagVariant {
    id: string
    number: number
    name: string
    family: CountdownFamily
    structure: string
    reference: string
    rationale: string
}

// eslint-disable-next-line react-refresh/only-export-components -- 워크벤치 메타데이터를 회귀 테스트와 공유한다.
export const AUCTION_COUNTDOWN_TAG_VARIANTS: readonly CountdownTagVariant[] = [
    {
        id: 'timecode-clock',
        number: 1,
        name: '시계 타임코드',
        family: 'mini-timecode',
        structure: 'icon + time',
        reference: 'NFT timer-as-data',
        rationale: '가장 작은 면적에서 시간임을 아이콘으로 즉시 식별',
    },
    {
        id: 'timecode-labeled',
        number: 2,
        name: '라벨 타임코드',
        family: 'mini-timecode',
        structure: 'label + time',
        reference: 'Carbon compact read-only',
        rationale: '남은 시간이라는 데이터 의미를 문자로 명시',
    },
    {
        id: 'timecode-segmented',
        number: 3,
        name: '분초 분절',
        family: 'mini-timecode',
        structure: 'minute / second',
        reference: 'sports live timer',
        rationale: '분과 초 단위를 분리해 빠른 스캔을 지원',
    },
    {
        id: 'timecode-deadline',
        number: 4,
        name: '마감 시각 병기',
        family: 'mini-timecode',
        structure: 'relative + absolute',
        reference: 'auction timer-as-data',
        rationale: '잔여 시간과 절대 마감 시각을 함께 제공',
    },
    {
        id: 'rail-bid-time',
        number: 5,
        name: '입찰·시간 레일',
        family: 'auction-info-rail',
        structure: 'bid count | time',
        reference: 'NFT auction card rail',
        rationale: '하단 레일에서 거래 밀도와 시간을 동급 정보로 비교',
    },
    {
        id: 'rail-status-time',
        number: 6,
        name: '상태·시간 레일',
        family: 'auction-info-rail',
        structure: 'status badge | time',
        reference: 'Atlassian status separation',
        rationale: '상태만 badge로 두고 시간은 독립 데이터로 유지',
    },
    {
        id: 'rail-price-time',
        number: 7,
        name: '현재가·시간 레일',
        family: 'auction-info-rail',
        structure: 'price | time',
        reference: 'commerce auction card',
        rationale: '구매 판단의 두 핵심 데이터인 현재가와 시간을 연결',
    },
    {
        id: 'rail-soft-ledger',
        number: 8,
        name: '소프트 거래 장부',
        family: 'auction-info-rail',
        structure: 'auction cue + labeled time',
        reference: 'Carbon read-only + Vuexy',
        rationale: '밝은 surface에서 경매 단서와 시간 위계를 절제',
    },
    {
        id: 'split-corners',
        number: 9,
        name: '대각 분리',
        family: 'split-status-time',
        structure: 'status top-right / time bottom-right',
        reference: 'Atlassian lozenge role',
        rationale: '상태와 시간을 공간적으로 분리해 역할 혼동 제거',
    },
    {
        id: 'split-top-bottom',
        number: 10,
        name: '상단 상태·하단 시간',
        family: 'split-status-time',
        structure: 'status top / time bottom',
        reference: 'marketplace card overlay',
        rationale: '시선 이동 순서를 상태에서 마감 데이터로 고정',
    },
    {
        id: 'split-dot-time',
        number: 11,
        name: '진행점·타임코드',
        family: 'split-status-time',
        structure: 'status dot badge / bare time',
        reference: 'Atlassian status + timer data',
        rationale: '상태 신호는 최소화하고 시간 대비를 우선',
    },
    {
        id: 'split-label-time',
        number: 12,
        name: '상태 라벨·마감 데이터',
        family: 'split-status-time',
        structure: 'outlined status / labeled time',
        reference: 'Carbon compact status',
        rationale: '조용한 outline 상태와 명시적 마감 데이터를 분리',
    },
]

const clock = <TbClock aria-hidden />

export default function AuctionCountdownTagCandidate({
    variant,
}: {
    variant: CountdownTagVariant
}) {
    return (
        <span
            aria-label="진행중, 경매 마감까지 12분 48초"
            className="pointer-events-none absolute inset-0"
            data-countdown-candidate={variant.id}
            data-family={variant.family}
            data-structure-id={variant.structure}
        >
            {renderCandidate(variant.number)}
        </span>
    )
}

function renderCandidate(number: number): ReactNode {
    switch (number) {
        case 1:
            return (
                <span className="absolute bottom-2 right-2">
                    <AuctionTimeDisplay leading={clock}>
                        12:48
                    </AuctionTimeDisplay>
                </span>
            )
        case 2:
            return (
                <span className="absolute bottom-2 right-2">
                    <AuctionTimeDisplay label="남은 시간">
                        12:48
                    </AuctionTimeDisplay>
                </span>
            )
        case 3:
            return (
                <span className="absolute bottom-2 right-2">
                    <AuctionTimeDisplay>
                        <span>12분</span> <span>48초</span>
                    </AuctionTimeDisplay>
                </span>
            )
        case 4:
            return (
                <span className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
                    <AuctionTimeDisplay>12:48</AuctionTimeDisplay>
                    <AuctionTimeDisplay tone="bare">
                        21:30 마감
                    </AuctionTimeDisplay>
                </span>
            )
        case 5:
            return (
                <span className="absolute inset-x-0 bottom-0">
                    <AuctionInfoRail>
                        <AuctionInfoGroup>
                            <TbGavel aria-hidden />
                            <span>입찰 18</span>
                        </AuctionInfoGroup>
                        <AuctionTimeDisplay tone="bare">
                            12:48
                        </AuctionTimeDisplay>
                    </AuctionInfoRail>
                </span>
            )
        case 6:
            return (
                <span className="absolute inset-x-0 bottom-0">
                    <AuctionInfoRail>
                        <VuexyBadge variant="solid">진행중</VuexyBadge>
                        <AuctionTimeDisplay tone="bare">
                            12:48
                        </AuctionTimeDisplay>
                    </AuctionInfoRail>
                </span>
            )
        case 7:
            return (
                <span className="absolute inset-x-0 bottom-0">
                    <AuctionInfoRail>
                        <AuctionInfoGroup>
                            <span>현재가</span>
                            <strong>98,500</strong>
                        </AuctionInfoGroup>
                        <AuctionTimeDisplay tone="bare">
                            12:48
                        </AuctionTimeDisplay>
                    </AuctionInfoRail>
                </span>
            )
        case 8:
            return (
                <span className="absolute inset-x-0 bottom-0">
                    <AuctionInfoRail tone="soft">
                        <AuctionInfoGroup>
                            <TbGavel aria-hidden />
                            <span>실시간 경매</span>
                        </AuctionInfoGroup>
                        <AuctionTimeDisplay label="마감까지" tone="quiet">
                            12:48
                        </AuctionTimeDisplay>
                    </AuctionInfoRail>
                </span>
            )
        case 9:
            return (
                <>
                    <span className="absolute right-2 top-2">
                        <VuexyBadge variant="solid">진행중</VuexyBadge>
                    </span>
                    <span className="absolute bottom-2 right-2">
                        <AuctionTimeDisplay>12:48</AuctionTimeDisplay>
                    </span>
                </>
            )
        case 10:
            return (
                <>
                    <span className="absolute inset-x-0 top-2 flex justify-center">
                        <VuexyBadge variant="outlined">마감 임박</VuexyBadge>
                    </span>
                    <span className="absolute bottom-2 right-2">
                        <AuctionTimeDisplay label="남은">
                            12:48
                        </AuctionTimeDisplay>
                    </span>
                </>
            )
        case 11:
            return (
                <>
                    <span className="absolute right-2 top-2">
                        <VuexyBadge dot>진행</VuexyBadge>
                    </span>
                    <span className="absolute bottom-2 right-2">
                        <AuctionTimeDisplay tone="bare">
                            12:48
                        </AuctionTimeDisplay>
                    </span>
                </>
            )
        case 12:
            return (
                <>
                    <span className="absolute right-2 top-2">
                        <VuexyBadge variant="outlined">진행중</VuexyBadge>
                    </span>
                    <span className="absolute bottom-2 right-2">
                        <AuctionTimeDisplay label="마감까지" tone="quiet">
                            12:48
                        </AuctionTimeDisplay>
                    </span>
                </>
            )
        default:
            return null
    }
}
