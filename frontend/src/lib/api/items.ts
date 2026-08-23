import { apiClient } from './client'
import type { CardInfoResponse } from './cardInfo'
import type { ItemTemplate } from './itemTemplates'

/**
 * 아이템 인스턴스 상세 API (계약 §4.1 `GET /items/{id}`) — FC-077.
 *
 * ★ **계약/백엔드 DTO(`ItemInstanceDetailResponse`)와 1:1.** 개명·병합·필드 추가 금지
 *   (`types/api.ts` 상단 규칙). `template` 은 카탈로그 템플릿(`ItemTemplate`)과 동형이라 재사용한다.
 *
 * ★★ **스킬 이름은 여기서만 내려온다.** 경매 item 블록(`AuctionItemBlock`)은 스킬 **코드(정수)**
 *    만 싣고 이름이 없어 `스킬 #{code}` 중립 표기가 계약 준수다(§2.5). 인스턴스 상세만
 *    `{skillCode, name}` 객체를 주므로, 이 맥락에서만 실제 스킬 이름을 표시한다.
 *
 * ★ **위치(location) 실측 enum 은 INVENTORY·TEMP·LISTED 3값이다.** design-brief 초안의 "AUCTION"
 *   은 실측 enum 명이 아니다 — 출품(에스크로) 상태의 실제 이름은 `LISTED`다(백엔드 `ItemLocation`).
 *   서버가 `@Enumerated(STRING)` 으로 이름 그대로 직렬화하므로 그 이름을 정본으로 삼는다.
 */

/**
 * 아이템 위치(계약 §4.1 · 백엔드 `ItemLocation` 3값).
 *
 * ★ 알려진 값을 유니온으로 좁히되 `(string & {})` 를 열어둔다 — 서버가 새 위치를 먼저 배포할 수
 *   있고, 그때 타입 에러 대신 폴백 경로로 흘러야 한다(§3.3 태도, `AuctionStatus` 와 동일).
 */
export type ItemLocation =
    'INVENTORY' | 'TEMP' | 'LISTED' | (string & Record<never, never>)

/**
 * 스킬 슬롯 응답(백엔드 `ItemSkillResponse` 실측 — 코드 + 표시명).
 * ★ 슬롯이 비면 상위에서 null 이다(마법 subGroup 3 은 구조적으로 skill1 부재).
 */
export interface ItemSkill {
    skillCode: number
    /** ★ 스킬 표시 이름 — **인스턴스 상세에서만** 존재(경매 맥락엔 없음, §2.5). */
    name: string
}

/** `GET /items/{id}` 200 (계약 §4.1 / `ItemInstanceDetailResponse` 실측 — 10필드). */
export interface ItemInstanceDetail {
    cardInfo: CardInfoResponse
    itemInstancePublicId: string
    /** 카탈로그 템플릿(축·표시명). `ItemTemplate` 과 동형 */
    template: ItemTemplate
    /** 표시 레벨 1~9(0-based 보정 금지, C-2). 아트 경로 파생에 그대로 쓴다 */
    level: number
    skill1: ItemSkill | null
    skill2: ItemSkill | null
    skillPercent: number
    /** 골드포스 만료 시각(ISO-8601 UTC). 미적용이면 null. 활성/잔여는 클라 파생 */
    goldforceExpireAt: string | null
    location: ItemLocation
    /** 소유자 nickname 마스킹(앞 2자 + `***`). 소유자 public_id 는 노출하지 않는다 */
    ownerMasked: string
    /** ★ **요청 주체가 소유자이고 위치가 INVENTORY 일 때만** 존재. 그 외 null(사생활 보호) */
    slotNo: number | null
}

/**
 * `GET /items/{id}` — **인증 불요(공개 범위)이되 인증 시 소유자 부가정보(slotNo)를 얻는다.**
 *
 * ★ 그래서 `auth: false` 를 쓰지 **않는다.** 기본(`auth: true`)은 토큰이 있으면 붙이고 없으면 안
 *   붙인다 — 손님은 공개 범위만, 소유자는 slotNo 까지 받는다. 없으면 `ITEM_001`(404).
 */
export function getItemInstance(
    itemInstancePublicId: string,
    signal?: AbortSignal,
): Promise<ItemInstanceDetail> {
    return apiClient.get<ItemInstanceDetail>(`/items/${itemInstancePublicId}`, {
        signal,
    })
}
