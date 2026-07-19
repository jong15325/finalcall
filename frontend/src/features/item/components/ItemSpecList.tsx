import { formatDateTime } from '@/lib/format';
import type { ItemBlock } from '@/types/schema';
import { elementLabelOf } from '../lib/element';

/**
 * ItemSpecList — 아이템 스냅샷의 스탯 표(계약 §3.3 item 블록).
 *
 * 정의 목록(`dl`)으로 둔다 — 라벨·값 쌍이라는 구조 자체가 시맨틱이고, 스크린리더가 항목 단위로 읽는다
 * (accessibility [5] 시맨틱). 색은 쓰지 않는다: 여기는 커머스 정보 영역이라 element 색이 새어 나오면
 * Game-Color Containment([1.2])가 깨진다. 속성은 **이름 텍스트로만** 적고, 색 배지는 헤더의
 * ElementBadge 한 곳이 담당한다.
 *
 * 표시하지 않는 것:
 * - `typeCode`·`mainCategory`·`subGroup`·`kind`: 정수 코드일 뿐 표시명 매핑이 아직 없다(EPIC-ITEM 소관).
 *   숫자를 그대로 노출하면 정보가 아니라 노이즈다.
 * - `specSnapshot`: 서버가 `"Lv.10 / skill1=-/skill2=- / 0% / GF=-"` 형태의 기계 문자열로 만든다
 *   (AuctionService#buildSpecSnapshot). 아래 구조화 값과 내용이 겹치므로 원문을 그대로 보여주지 않는다.
 */
interface ItemSpecListProps {
  item: ItemBlock;
}

export function ItemSpecList({ item }: ItemSpecListProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      <SpecRow label="레벨" value={`Lv.${item.level}`} />
      <SpecRow label="속성" value={elementLabelOf(item.element)} />
      <SpecRow label="스킬 수치" value={`${item.skillPercent}%`} />
      <SpecRow label="골드포스" value={goldforceText(item.goldforceExpireAt)} />
      <SpecRow label="스킬 1" value={skillText(item.skill1)} />
      <SpecRow label="스킬 2" value={skillText(item.skill2)} />
    </dl>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2">
      {/* 표 라벨은 라벨 축(11/700/+.12em), 표 본문은 문장 축(13)이다([3.2]). */}
      <dt className="text-label text-text-muted">{label}</dt>
      <dd className="font-num text-body font-medium text-text">{value}</dd>
    </div>
  );
}

/**
 * 스킬은 코드(`skill_definition.skill_code`)로만 내려온다 — 코드→이름 매핑 API가 계약에 아직 없다.
 * 이름을 지어내지 않고 코드를 그대로 밝힌다(무음 실패 방지, element 미등록 코드 폴백과 같은 태도).
 *
 * 빈 슬롯 판정은 `== null` 이다(`=== undefined` 아님) — 계약 §3.3 에서 `skill1`·`skill2` 는 nullable 이고
 * 서버가 wire 에 `null` 을 실어 보낸다. 엄격 비교로 두면 빈 슬롯이 "코드 null"로 새어 나온다(FC-038 M-1).
 */
function skillText(skillCode?: number | null): string {
  return skillCode == null ? '없음' : `코드 ${skillCode}`;
}

/** 골드포스 활성/잔여는 클라 파생이다(계약 §3.3 주) — 서버는 만료시각만 준다. */
function goldforceText(expireAt?: string | null): string {
  if (!expireAt) return '없음';
  const expireMs = new Date(expireAt).getTime();
  if (Number.isNaN(expireMs)) return expireAt;
  return expireMs > Date.now() ? `${formatDateTime(expireAt)}까지` : '만료됨';
}
