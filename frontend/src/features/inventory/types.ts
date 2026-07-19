/**
 * 인벤토리·임시보관 응답 스키마 (계약 v1.10 §4.2).
 *
 * ★ **`summary`는 목록/상세의 `item` 블록(§3.3)과 다른 물건이다.** 4개 코드 축을 개별 필드로 주지 않고
 * `typeCode` 하나로 접어 보내며, `specSnapshot`·`nameSnapshot`도 없다(`displayName`이 그 자리다).
 * 그래서 아트·배지를 그리려면 **클라이언트가 `typeCode`를 분해**해야 한다 — `lib/itemSummary.ts`.
 * 계약 스키마와 1:1이며 임의 필드 추가·개명 금지(types/schema.ts와 같은 규율).
 */

/** 인벤토리·임시보관 공용 아이템 요약(계약 §4.2 `ItemSummaryResponse`). */
export interface ItemSummary {
  /** 4자리 자리값 합성(§3.3.1). 축 분해는 `decodeTypeCode`. */
  typeCode: number;
  displayName: string;
  level: number;
  /** 스킬 코드. 슬롯이 비면 null — `=== undefined` 비교 금지(FC-038 M-1). */
  skill1Code?: number | null;
  skill2Code?: number | null;
  skillPercent: number;
  goldforceExpireAt?: string | null;
}

/** GET /me/inventory `items[]` 항목. */
export interface InventoryItem {
  itemInstancePublicId: string;
  /** 정규 슬롯 번호(1~capacity). 서버가 slotNo asc로 정렬해 내린다. */
  slotNo: number;
  summary: ItemSummary;
}

/** GET /me/inventory — 비페이지네이션 단일 응답(96칸 상한). */
export interface InventoryResponse {
  capacity: number;
  /** 사용 칸 수. **`items.length`로 대체 계산하지 않는다** — 서버가 내리는 값이 정본이다. */
  used: number;
  items: InventoryItem[];
}

/** GET /me/temp-storage `content[]` 항목(cursor 페이지). */
export interface TempStorageItem {
  itemInstancePublicId: string;
  storedAt: string;
  /** 보관 기한. 계약이 optional로 두므로 없을 수 있다. */
  expireAt?: string | null;
  summary: ItemSummary;
}

/** POST /me/temp-storage/{id}/relocate 응답 — 서버가 배정한 슬롯 번호. */
export interface RelocateResponse {
  slotNo: number;
}
