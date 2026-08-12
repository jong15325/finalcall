import type { DeliveryStatus } from '@/lib/api/deliveries'

/**
 * 배송 상태 → 표시 매핑 정본 (FC-190 · 승인 목업 `template-delivery-status.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **5값(계약 §4.6)을 3버킷으로 통일**(디자인 승인, 2026-08-05):
 *   - `SHIPPING`(배송중)  = PENDING · CLAIMED · DEFERRED — 오렌지. **세분 서브텍스트 없음**.
 *   - `ARRIVED`(게임 도착) = APPLIED — 그린.
 *   - `FAILED`(문제)      = FAILED — 레드.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 미등록 상태값(배포 시차·향후 확장)은 **배송중으로 폴백**한다 — 진행 중으로 보수 처리해
 *   재판매를 잠그는 쪽이 안전하다(오배송·이중존재 회피, 계약 §3.3 중립 폴백 태도).
 * ★ 색은 index.css 팔레트 정본(navy/gold/orange + success/danger)만 쓴다([[palette-source-of-truth]]).
 *   Tailwind 유틸 문자열은 정적 리터럴로 둔다(런타임 조합 금지 — JIT 퍼지 방지).
 */

/** 표시 버킷(3표현). */
export type DeliveryBucket = 'SHIPPING' | 'ARRIVED' | 'FAILED'

/** 버킷별 배지 시각·문구(정적 Tailwind 클래스). */
export interface DeliveryBadgeStyle {
    bucket: DeliveryBucket
    /** 짧은 배지 라벨(카드 오버레이용) */
    shortLabel: string
    /** 긴 라벨(거래내역 행·상세용) */
    longLabel: string
    /** 배지 컨테이너 클래스(subtle 배경 + 진한 텍스트 + 경계) */
    badgeClass: string
    /** 상태 도트 클래스 */
    dotClass: string
}

const SHIPPING: DeliveryBadgeStyle = {
    bucket: 'SHIPPING',
    shortLabel: '배송중',
    longLabel: '게임으로 배송중',
    badgeClass:
        'bg-control-action-soft text-control-action-hover border border-control-action/40',
    dotClass: 'bg-control-action',
}

const ARRIVED: DeliveryBadgeStyle = {
    bucket: 'ARRIVED',
    shortLabel: '게임 도착',
    longLabel: '게임 도착',
    badgeClass:
        'bg-success-soft text-success-ink border border-success/40',
    dotClass: 'bg-success',
}

const FAILED: DeliveryBadgeStyle = {
    bucket: 'FAILED',
    shortLabel: '문제',
    longLabel: '문제 발생 · 문의',
    badgeClass: 'bg-danger-soft text-danger-ink border border-danger/40',
    dotClass: 'bg-danger',
}

/** 상태 → 버킷(미등록·배송 계열은 배송중으로 보수 폴백). */
export function deliveryBucketOf(status: DeliveryStatus): DeliveryBucket {
    switch (status) {
        case 'APPLIED':
            return 'ARRIVED'
        case 'FAILED':
            return 'FAILED'
        // PENDING · CLAIMED · DEFERRED · 미등록값 → 배송중
        default:
            return 'SHIPPING'
    }
}

/** 상태 → 배지 스타일(정본). */
export function deliveryBadgeStyleOf(
    status: DeliveryStatus,
): DeliveryBadgeStyle {
    switch (deliveryBucketOf(status)) {
        case 'ARRIVED':
            return ARRIVED
        case 'FAILED':
            return FAILED
        default:
            return SHIPPING
    }
}

/** 배송 진행 중(재판매 잠금 대상)인가 = 배송중 버킷. */
export function isShipping(status: DeliveryStatus): boolean {
    return deliveryBucketOf(status) === 'SHIPPING'
}

/** 게임 도착(APPLIED)인가 — 웹 인벤에서 제외 + 도착 배너 대상. */
export function isArrived(status: DeliveryStatus): boolean {
    return deliveryBucketOf(status) === 'ARRIVED'
}

/** 지급 실패(FAILED)인가 — 문의 안내 대상. */
export function isFailed(status: DeliveryStatus): boolean {
    return deliveryBucketOf(status) === 'FAILED'
}
