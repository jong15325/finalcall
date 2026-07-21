import { apiClient } from './client'
import type { OffsetPage } from '@/types/api'

/**
 * 아이템 정의 카탈로그 (계약 §4.1 `GET /item-templates`) — FC-071.
 *
 * ★ **용도는 검색 필터 UI 구성 하나뿐이다**(계약 §4.1). 카탈로그가 소규모라 서버는 페이징
 *   제약을 두지 않으므로, 필터 선택지를 한 번에 받아 어떤 대분류·속성·종류가 **실제로 존재하는지**
 *   추린다(`features/auction/lib/filterOptions.ts`). 없는 조합의 필터를 지어내지 않기 위함이다.
 * ★ **스코프는 `mainCategory = 1`(아이템 카드)뿐**(§3.3.1). 그래서 기본 쿼리에 담지 않아도
 *   서버가 그 대역만 내려준다 — 클라가 추가로 거를 필요는 없다.
 * ★ `kind` 단독 필터는 다의적이다(§4.1) — 이 목록 자체를 `kind` 로 좁히지 않는다. 좁힘은
 *   화면 필터(`auctionFilters.ts`)가 `subGroup` 종속으로 처리한다.
 */

/** 카탈로그 템플릿 한 건(계약 §4.1 — 상품군·대분류·속성·종류·표시명·typeCode). */
export interface ItemTemplate {
    /** 외부 식별자 = `typeCode`(고정 시드·유일 조합, §4.1 비고). 별도 public_id 없음 */
    typeCode: number
    mainCategory: number
    subGroup: number
    element: number
    kind: number
    /** 표시명(원게임 시드 기준). 필터 라벨 우선순위는 로컬 코드 사전이 갖는다 */
    displayName: string
}

/** `GET /item-templates` 쿼리 — 전부 코드값(§3.3.1). 미지정 값은 client 가 쿼리스트링에서 뺀다. */
export interface ItemTemplateQuery {
    mainCategory?: number
    subGroup?: number
    element?: number
    kind?: number
    page?: number
    size?: number
}

/** `GET /item-templates` — **인증 불요**(공개 카탈로그). offset 페이지로 응답(§4.1). */
export function getItemTemplates(
    query: ItemTemplateQuery = {},
    signal?: AbortSignal,
): Promise<OffsetPage<ItemTemplate>> {
    return apiClient.get<OffsetPage<ItemTemplate>>('/item-templates', {
        query: { ...query },
        auth: false,
        signal,
    })
}
