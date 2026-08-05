import { TbAlertTriangle, TbCheck, TbTruckDelivery } from 'react-icons/tb'
import { deliveryBadgeStyleOf } from '@/features/delivery/lib/deliveryView'
import type { DeliveryStatus } from '@/lib/api/deliveries'

/**
 * 배송 상태 배지 — 인벤/구매내역 공유 컴포넌트 (FC-190 · 승인 목업 §배지 3표현).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **한 곳이 상태→색·문구·아이콘을 소유**([[shared-card-components]]). 인벤 카드 오버레이와
 *   구매내역 행이 이 배지를 재사용한다 — 페이지마다 재구현하지 않는다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 색/문구 매핑은 `deliveryView.deliveryBadgeStyleOf`(정본). 팔레트는 index.css 토큰만.
 * ★ `size`: `sm`(카드 오버레이·컴팩트) / `md`(거래내역 행). `long`=긴 라벨 사용.
 */

interface DeliveryBadgeProps {
    status: DeliveryStatus
    /** 배지 크기 프리셋. 기본 `sm`(카드 오버레이). */
    size?: 'sm' | 'md'
    /** 긴 라벨("게임으로 배송중" 등)을 쓸지. 기본 false(짧은 라벨). */
    long?: boolean
    className?: string
}

const ICON_BY_BUCKET = {
    SHIPPING: TbTruckDelivery,
    ARRIVED: TbCheck,
    FAILED: TbAlertTriangle,
} as const

export default function DeliveryBadge({
    status,
    size = 'sm',
    long = false,
    className = '',
}: DeliveryBadgeProps) {
    const style = deliveryBadgeStyleOf(status)
    const Icon = ICON_BY_BUCKET[style.bucket]
    const label = long ? style.longLabel : style.shortLabel
    const sizing =
        size === 'md'
            ? 'gap-1.5 px-2.5 py-1 text-xs'
            : 'gap-1 px-2 py-0.5 text-[10px]'

    return (
        <span
            className={`inline-flex items-center rounded-full font-bold leading-none whitespace-nowrap ${sizing} ${style.badgeClass} ${className}`.trim()}
        >
            <Icon
                aria-hidden
                className={size === 'md' ? 'size-3.5' : 'size-3'}
            />
            {label}
        </span>
    )
}
