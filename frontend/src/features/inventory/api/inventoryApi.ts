import { apiClient } from '@/lib/api/client';
import type { CursorPage } from '@/types/api';
import type { InventoryResponse, RelocateResponse, TempStorageItem } from '../types';

/**
 * 인벤토리·임시보관 함수층 (계약 §4.2). `me` 접두라 **전부 인증 필요**(`auth` 기본 true).
 * 경로에 사용자 식별자를 받지 않는다 — 주체는 서버가 토큰에서 얻는다(IDOR 구조적 차단, §1.2).
 */

/** GET /me/inventory — 96칸 단일 응답. 페이징이 없다(계약이 상한을 96으로 못 박았다). */
export function getInventory(): Promise<InventoryResponse> {
  return apiClient.get<InventoryResponse>('/me/inventory', {
    // 서버 기본값과 같지만 명시한다 — 슬롯 순서가 화면의 전제(격자 배열)라 정렬을 우연에 맡기지 않는다.
    query: { sort: 'slotNo,asc' },
  });
}

/** GET /me/temp-storage — cursor 페이지. `size` 미지정 시 서버 기본(10). */
export function getTempStorage(cursor?: string): Promise<CursorPage<TempStorageItem>> {
  return apiClient.get<CursorPage<TempStorageItem>>('/me/temp-storage', { query: { cursor } });
}

/**
 * POST /me/temp-storage/{id}/relocate — 임시보관 → 정규 슬롯 이동.
 *
 * ★ **`slotNo`를 보내지 않는다 → 서버 자동 배정**(계약 §4.2 "미지정 시 빈 슬롯 자동 배정").
 *   정규 인벤토리 안에서 칸을 옮기는 엔드포인트가 계약에 **없으므로**, 여기서 고른 칸 번호는 이후
 *   바꿀 수 없고 정렬·장착 같은 후속 의미도 없다. 의미 없는 선택을 96지선다로 강요하지 않는다.
 *   (칸 지정이 실제로 필요해지는 시점은 "정규 내 재배치"가 계약에 생길 때다 — 그때 게이트2 사안.)
 *
 * 경로 세그먼트는 `encodeURIComponent`로 감싼다(auctionApi가 세운 관례 — 경로 구조 탈출 방지).
 */
export function relocateFromTempStorage(itemInstancePublicId: string): Promise<RelocateResponse> {
  return apiClient.post<RelocateResponse>(
    `/me/temp-storage/${encodeURIComponent(itemInstancePublicId)}/relocate`,
    {},
  );
}
