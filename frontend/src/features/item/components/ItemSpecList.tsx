import { formatDateTime } from '@/lib/format';
import type { ItemBlock } from '@/types/schema';
import { elementLabelOf } from '../lib/element';
import { goldforceStateOf } from '../lib/goldforce';
import { itemTypeLabel } from '../lib/itemCode';

/**
 * ItemSpecList — 아이템 스냅샷 스펙(계약 §3.3 item 블록 + §3.3.1 코드 사전).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 반응형 — **데스크톱 펼침 / 모바일 아코디언**(references [8-3] IA 대조표).
 * 좁은 폭에서 스펙 8칸이 펼쳐져 있으면 거래 정보(가격·마감)가 화면 아래로 밀려난다.
 * 그래서 `<details>` 로 감싸고 **≥sm 에서만 마커·커서를 죽여 항상 펼친 판**으로 만든다 —
 * 마크업이 하나라 두 벌을 동기화할 필요가 없다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 색은 쓰지 않는다: 여기는 커머스 정보 영역이라 element 색이 새면 Containment([1.2])가 깨진다.
 * 속성은 **이름 텍스트로만** 적고, 색 배지는 헤더·아트 슬롯이 담당한다.
 *
 * ★ 코드 축(`subGroup`·`kind`·`element`)을 **표시명으로 옮긴다**(계약 v1.10 §3.3.1이 값을 확정했다 —
 * 종전에는 "표시명 매핑이 없어 숫자는 노이즈"라며 감췄다). 원 코드는 보조 줄에 병기한다: 필터
 * 링크·문의에서 코드가 필요한 순간이 있고, 표시명만 남기면 그 경로가 끊긴다.
 */
export function ItemSpecList({ item }: { item: ItemBlock }) {
  const goldforce = goldforceStateOf(item.goldforceExpireAt);

  return (
    <details
      open
      className="group overflow-hidden rounded-lg border border-border bg-surface [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-4 text-value text-text hover:bg-surface-band sm:cursor-default sm:border-b sm:border-border-muted sm:hover:bg-transparent">
        아이템 스펙
        <span
          className="ml-auto text-text-muted transition-transform duration-fast group-open:rotate-180 sm:hidden"
          aria-hidden="true"
        >
          ▾
        </span>
      </summary>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-8 gap-y-5 px-5 pb-5 pt-5">
        <Spec
          label="타입"
          value={itemTypeLabel(item.subGroup, item.kind)}
          sub={`subGroup ${item.subGroup} · kind ${item.kind}`}
        />
        <Spec label="속성" value={elementLabelOf(item.element)} sub={`element ${item.element}`} />
        <Spec label="레벨" value={String(item.level)} />
        <Spec label="스킬 1" value={skillText(item.skill1)} empty={item.skill1 == null} />
        <Spec label="스킬 2" value={skillText(item.skill2)} empty={item.skill2 == null} />
        <Spec label="발동 확률" value={`${item.skillPercent}%`} meter={item.skillPercent} />
        <Spec
          label="골드포스"
          value={goldforce.active ? `${goldforce.remainingLabel} 남음` : '없음'}
          sub={
            goldforce.active && item.goldforceExpireAt
              ? `${formatDateTime(item.goldforceExpireAt)} 만료`
              : undefined
          }
          empty={!goldforce.active}
        />
        <Spec label="템플릿 코드" value={String(item.typeCode)} />
      </dl>
    </details>
  );
}

function Spec({
  label,
  value,
  sub,
  empty,
  meter,
}: {
  label: string;
  value: string;
  sub?: string;
  empty?: boolean;
  /** 0~100 확률만 미터로 그린다. */
  meter?: number;
}) {
  return (
    <div>
      <dt className="text-label text-text-subtle">{label}</dt>
      <dd
        className={`mt-2 block font-num text-value ${empty ? 'font-medium text-text-subtle' : 'text-text'}`}
      >
        {value}
      </dd>
      {sub ? (
        <span className="mt-0.5 block font-num text-micro text-text-subtle">{sub}</span>
      ) : null}
      {/*
       * 미터는 **계약이 0~100을 보장하는 유일한 수치**인 `skillPercent` 에만 쓴다.
       * 레벨은 계약에 상한이 없어 미터로 그리지 않는다 — 없는 최대치를 지어내면 막대가 거짓말을 한다.
       */}
      {meter !== undefined ? (
        <span
          className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-sunken"
          role="presentation"
        >
          <span
            className="block h-full rounded-full bg-text"
            style={{ width: `${Math.min(Math.max(meter, 0), 100)}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

/**
 * 스킬은 코드(`skill_definition.skill_code`)로만 내려온다 — 코드→이름 매핑 API가 계약에 아직 없다.
 * 이름을 지어내지 않고 코드를 그대로 밝힌다(무음 실패 방지).
 *
 * 빈 슬롯 판정은 `== null` 이다(`=== undefined` 아님) — 서버가 wire 에 `null` 을 그대로 싣는다(FC-038 M-1).
 */
function skillText(skillCode?: number | null): string {
  return skillCode == null ? '없음' : `코드 ${skillCode}`;
}
