import { apiClient } from './client'
import type { ItemSummary } from './inventory'
import type { CursorPage } from '@/types/api'

/**
 * 임시 보관함 API (계약 §4.2 `GET /me/temp-storage` · `POST …/relocate`) — FC-076.
 *
 * ★ **계약 스키마와 1:1.** 임시보관 목록도 인벤토리와 동형인 `summary`를 포함하며,
 *   카드 표시는 그 안의 서버 파생 `cardInfo`를 정본으로 사용한다.
 *
 * ★ **만료 임박은 클라 파생**이다(`expireAt` − now). 서버가 "임박" 플래그를 내리지 않는다.
 */

/** 임시보관 항목 (계약 §4.2). */
export interface TempStorageItem {
    itemInstancePublicId: string
    /** 임시보관에 들어온 시각(ISO-8601 UTC). */
    storedAt: string
    /** 만료 예정 시각(ISO-8601 UTC). 만료 개념이 없으면 null. */
    expireAt: string | null
    summary: ItemSummary
}

/** `POST /me/temp-storage/{id}/relocate` 200 (계약 §4.2). */
export interface RelocateResponse {
    /** 실제 배정된 정규 슬롯 번호(자동 배정 시 서버가 고른 값). */
    slotNo: number
}

/**
 * `GET /me/temp-storage` — **인증 필요**. cursor 페이지(계약 §1.3 · §4.2).
 * 비로그인 호출은 401 이므로 훅에서 `enabled` 로 막는다.
 */
export function getMyTempStorage(
    cursor?: string,
    signal?: AbortSignal,
): Promise<CursorPage<TempStorageItem>> {
    return apiClient.get<CursorPage<TempStorageItem>>('/me/temp-storage', {
        query: { cursor },
        signal,
    })
}

/**
 * `POST /me/temp-storage/{id}/relocate` — **인증 필요(소유자)**. 임시보관→정규 슬롯 이동.
 *
 * ★ **`slotNo` 미지정이면 서버가 빈 슬롯을 자동 배정**한다(계약 §4.2). 화면은 슬롯 선택 UI 를 두지
 *   않고 자동 배정만 쓴다(목업 "빈 슬롯으로 이동"). body 는 항상 객체로 보낸다(빈 객체 = 자동).
 * ★ 실패: `INV_001` 만실(409) · `INV_002` 슬롯 점유(409) · `ITEM_002` 소유자 아님(403) ·
 *   `ITEM_003` 대상이 임시보관(TEMP) 상태 아님(409). 문구 매핑은 `relocateErrors.ts`.
 */
export function relocateTempStorageItem(
    itemInstancePublicId: string,
    slotNo?: number,
): Promise<RelocateResponse> {
    return apiClient.post<RelocateResponse>(
        `/me/temp-storage/${itemInstancePublicId}/relocate`,
        slotNo != null ? { slotNo } : {},
    )
}
