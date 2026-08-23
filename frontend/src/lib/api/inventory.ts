import { apiClient } from './client'
import type { CardInfoResponse } from './cardInfo'

/**
 * 인벤토리 API (계약 §4.2 `GET /me/inventory`) — FC-073.
 *
 * ★ 계약 스키마와 1:1. 판매 화면이 출품할 아이템을 고르는 목록으로 재사용한다.
 *
 * ★★ **요약(`summary`)은 4축을 개별 필드로 내리지 않고 `typeCode` 하나만 싣는다**(백엔드
 *    `ItemSummaryResponse` 실측). 목록/상세의 item 블록(§3.3)과 형태가 다르다 —
 *    아트·배지를 만들려면 클라가 `decodeTypeCode` 로 분해한다(계약 §3.3.1 산식이 정본,
 *    서버 필드 추가 사안 아님). 개명·병합 금지(`types/api.ts` 상단 규칙).
 */

/** 인벤토리·임시보관 공용 아이템 요약 (백엔드 `ItemSummaryResponse` 실측). */
export interface ItemSummary {
    /** 4축 합성 코드(§3.3.1). subGroup/element/kind 는 `decodeTypeCode` 로 분해 */
    typeCode: number
    /** 등록 시점 표시명(D-045 스냅샷) — 표시 정본 */
    displayName: string
    level: number
    /** 슬롯이 비면 null. 마법(subGroup 3)은 구조적으로 skill1 이 없다 */
    skill1Code: number | null
    skill2Code: number | null
    /** 스킬명(계약 v1.21/FC-179 델타). 출처 `skill_definition.name`. 코드가 null이면 각각 null */
    skill1Name?: string | null
    skill2Name?: string | null
    skillPercent: number
    /** 골드포스 만료 시각(ISO-8601 UTC). 미적용이면 null. 활성 여부는 클라 파생 */
    goldforceExpireAt: string | null
    cardInfo: CardInfoResponse
}

/** 인벤토리 슬롯 항목 (계약 §4.2). */
export interface InventoryItem {
    itemInstancePublicId: string
    slotNo: number
    summary: ItemSummary
}

/** `GET /me/inventory` 200 (계약 §4.2 — 96칸 상한, 비페이지네이션). */
export interface InventoryResponse {
    capacity: number
    used: number
    items: InventoryItem[]
}

/**
 * `GET /me/inventory` — **인증 필요**. 비로그인 호출은 401 이므로 훅에서 `enabled` 로 막는다.
 *
 * ★ `sort=slotNo,asc` 가 서버 기본이라 파라미터를 보내지 않는다(계약 §4.2).
 */
export function getMyInventory(
    signal?: AbortSignal,
): Promise<InventoryResponse> {
    return apiClient.get<InventoryResponse>('/me/inventory', { signal })
}
