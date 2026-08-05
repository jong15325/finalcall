import { apiClient } from './client'
import type { ItemSummary } from './inventory'
import type { CursorPage } from '@/types/api'

/**
 * 구매자 배송 상태 API (계약 §4.6 `GET /me/deliveries`) — FC-190.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **읽기 전용 신규 엔드포인트. 기존 인벤/주문 응답 형상은 불변**(형상 보존, 계약 §4.6).
 *   배송 상태는 오직 여기서만 오며, 프론트가 `itemInstancePublicId` 로 인벤/주문 항목과
 *   **교차 조회**한다(`lib/queries/deliveries.ts` 의 lookup).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 계약 스키마와 1:1. 클라 편의를 위한 필드 추가·개명 금지(`types/api.ts` 상단 규칙).
 * ★ `claimToken`·`claimedAt` 은 **미노출**(내부 리스 메커니즘, 구매자 무관, 계약 §4.6).
 *
 * ★★ **백엔드 읽기 API(GET /me/deliveries)는 FC-192 별도 착지 예정.** 이 계약 타입으로
 *    컴포넌트를 완성하고, 실 연동 검증은 API 착지 후 통합 단계로 미룬다(contract-first).
 */

/**
 * 배송 상태(계약 §4.6 · delivery-spec §9.1). 5값을 그대로 노출한다.
 *
 * ★ 알려진 값을 유니온으로 좁히되 `(string & {})` 를 열어둔다 — 서버·클라 배포 시차나 향후
 *   상태 확장 시 미등록 값이 타입 에러 대신 중립 폴백으로 흐르게 한다(계약 §3.3 태도).
 *   프론트 표시 3버킷 매핑은 `features/delivery/lib/deliveryView.ts` 가 소유한다.
 */
export type DeliveryStatus =
    | 'PENDING'
    | 'CLAIMED'
    | 'APPLIED'
    | 'DEFERRED'
    | 'FAILED'
    | (string & Record<never, never>)

/**
 * DeliverySummary (계약 §4.6 — `GET /me/deliveries` content 항목).
 *
 * ★ `item` = §3.3 item 블록 요약(typeCode·displayName·level·스킬·발동확률·골드포스). 인벤토리
 *   요약(`ItemSummary`)과 같은 컴팩트 형태라 그 타입을 재사용한다(4축은 `typeCode` 하나로 실림).
 * ★ `appliedAt` 은 APPLIED 상태에서만 존재(그 외 부재) — optional.
 */
export interface DeliverySummary {
    deliveryPublicId: string
    status: DeliveryStatus
    /** §3.3 item 블록 요약(인벤 요약과 동형 — typeCode 로 4축 실림) */
    item: ItemSummary
    /** 인벤/주문 항목과의 교차 키(계약 §4.6) */
    itemInstancePublicId: string
    createdAt: string
    /** APPLIED(게임 도착) 시각. 그 외 부재 */
    appliedAt?: string
}

/** 배송 상세(계약 §4.6 `GET /me/deliveries/{id}`) = 요약 + 수령 닉네임. */
export interface DeliveryDetail extends DeliverySummary {
    recipientNickname: string
}

/** 목록 필터·페이징(계약 §4.6 — status 필터 + cursor). */
export interface DeliveryListQuery {
    /** 상태 축으로 좁힘(대문자). 미지정=전체 */
    status?: DeliveryStatus
    cursor?: string
    size?: number
}

/**
 * `GET /me/deliveries` — **인증 필요**. `recipient_user_id=주체` 스코프(IDOR 설계 차단, `/me`
 * 접두). cursor 페이지 · `created_at desc`(계약 §4.6). 비로그인 호출은 401 이므로 훅에서
 * `enabled` 로 막는다.
 */
export function getMyDeliveries(
    query: DeliveryListQuery = {},
    signal?: AbortSignal,
): Promise<CursorPage<DeliverySummary>> {
    return apiClient.get<CursorPage<DeliverySummary>>('/me/deliveries', {
        query: { ...query },
        signal,
    })
}

/**
 * `GET /me/deliveries/{deliveryPublicId}` — **인증 필요**. 당사자(recipient=주체)만.
 * 미존재·비당사자는 `DELIVERY_001`(404, ULID라 열거 무해로 통일).
 */
export function getDelivery(
    deliveryPublicId: string,
    signal?: AbortSignal,
): Promise<DeliveryDetail> {
    return apiClient.get<DeliveryDetail>(
        `/me/deliveries/${deliveryPublicId}`,
        { signal },
    )
}
