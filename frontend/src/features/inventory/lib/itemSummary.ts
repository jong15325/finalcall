import { decodeTypeCode } from '@/features/item/lib/itemCode';
import type { ItemBlock } from '@/types/schema';
import type { ItemSummary } from '../types';

/**
 * `ItemSummary`(계약 §4.2) → `ItemBlock`(§3.3) 어댑터.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **왜 어댑터인가** — 아트 슬롯·속성 배지·골드포스는 전부 `ItemBlock`을 받는 **공유 컴포넌트**다
 *   (`ItemArtSlot`·`ElementBadge`·`ItemArtLightbox`, FC-049). 인벤토리만 다른 타입을 받게 고치면
 *   그 컴포넌트들이 두 스키마를 알게 되고, 경매 화면과 공유하는 이유가 사라진다.
 *   **경계는 한 곳(이 파일)에서만 넘는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 필드 대응:
 * - 4개 코드 축 ← `typeCode` 자리값 분해(§3.3.1 산식. 서버가 축을 따로 싣지 않는다)
 * - `nameSnapshot` ← `displayName`. **인벤토리는 스냅샷이 아니라 템플릿 표시명이다** — 아직 출품되지
 *   않은 아이템이라 등록 시점 스냅샷(D-045)이 존재할 수 없다. 이름의 출처가 다르다는 사실은 여기서만
 *   흡수하고, 소비처는 구별하지 않는다(둘 다 "지금 보여줄 이름"이다).
 * - `skill1`/`skill2` ← `skill1Code`/`skill2Code`(같은 값, 이름만 다르다)
 * - `specSnapshot` ← **빈 문자열.** 계약이 인벤토리 요약에 이 필드를 주지 않는다. 서버에 없는 문장을
 *   조립해 채우면 화면이 근거 없는 스펙 문자열을 주장하게 된다 — 소비처(`ItemArtSlot`·라이트박스)는
 *   이 필드를 읽지 않으므로 빈 값이 안전하다.
 */
export function toItemBlock(summary: ItemSummary): ItemBlock {
  const axes = decodeTypeCode(summary.typeCode);

  return {
    typeCode: summary.typeCode,
    mainCategory: axes.mainCategory,
    subGroup: axes.subGroup,
    element: axes.element,
    kind: axes.kind,
    level: summary.level,
    skill1: summary.skill1Code ?? null,
    skill2: summary.skill2Code ?? null,
    skillPercent: summary.skillPercent,
    goldforceExpireAt: summary.goldforceExpireAt ?? null,
    nameSnapshot: summary.displayName,
    specSnapshot: '',
  };
}
