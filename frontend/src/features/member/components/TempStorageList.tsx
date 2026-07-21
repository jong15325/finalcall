import { Link } from 'react-router'
import { TbAlertTriangle, TbArrowRight, TbClockHour4 } from 'react-icons/tb'
import { itemDetailPath } from '@/app/paths'
import ItemFrame from '@/features/item/components/ItemFrame'
import {
    expiryStateOf,
    hasImminentExpiry,
} from '@/features/member/lib/tempStorageExpiry'
import type { ExpiryState } from '@/features/member/lib/tempStorageExpiry'
import type { TempStorageItem } from '@/lib/api/tempStorage'

/**
 * 임시 보관함 목록 (FC-076 — 목업 `.storage-list`/`.storage-item`/`.storage-alert` · design-brief B-10).
 *
 * ★ **계약 §4.2 는 세 필드만 내린다**(`itemInstancePublicId, storedAt, expireAt?`) — 요약(typeCode·
 *   이름·레벨)이 **없다.** 따라서 카드 아트·이름을 만들 수 없어 **아트는 플레이스홀더**로 두고,
 *   인스턴스 ID 로 아이템 상세(`/items/{id}`)에 링크한다(스킬·이름은 그 페이지에서). §2.1 링크 끊김 계열.
 * ★ **만료 임박은 클라 파생**(`tempStorageExpiry`). 임박·만료 항목이 하나라도 있으면 상단 경고를 보인다.
 * ★ 이동은 **자동 배정**(slotNo 미지정) — 목업 "빈 슬롯으로 이동". 결과/실패 문구는 상위(페이지)가 낸다.
 *   진행 중인 행의 버튼만 비활성(DOM `disabled`)한다.
 * ★ 순수 표시 컴포넌트 — 데이터·변이는 페이지가 주입한다(`ExchangeForm`·`WalletBalanceCard` 태도).
 */

const storedDateFormat = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
})

function formatStoredAt(iso: string): string {
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? storedDateFormat.format(ms) : '보관일 미상'
}

/** 만료 상태 → 배지 스타일·문구(색 단독 금지 → 문구 동반, 접근성). */
const EXPIRY_BADGE: Record<
    ExpiryState,
    { label: string; className: string } | null
> = {
    expired: {
        label: '만료됨',
        className: 'bg-danger-subtle text-danger',
    },
    imminent: {
        label: '만료 임박',
        className: 'bg-warning-subtle text-warning',
    },
    safe: {
        label: '보관 중',
        className: 'bg-surface-sunken text-gray-500',
    },
    none: {
        label: '보관 중',
        className: 'bg-surface-sunken text-gray-500',
    },
}

interface TempStorageListProps {
    items: TempStorageItem[]
    /** 이동 요청(부모가 변이 실행). slotNo 미지정 = 자동 배정. */
    onRelocate: (itemInstancePublicId: string) => void
    /** 현재 이동 중인 항목 ID — 해당 행 버튼만 비활성. 없으면 null. */
    pendingId: string | null
    /** 만료 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
}

function TempStorageList({
    items,
    onRelocate,
    pendingId,
    now,
}: TempStorageListProps) {
    const resolvedNow = now ?? Date.now()
    const showAlert = hasImminentExpiry(items, resolvedNow)

    return (
        <div className="flex flex-col gap-4">
            {/* 만료 임박 경고 — 클라 파생. 임박·만료 항목이 있을 때만 */}
            {showAlert && (
                <div
                    role="status"
                    className="flex items-center gap-2 rounded-xl border border-warning-subtle bg-warning-subtle/40 px-4 py-3 text-sm font-semibold text-warning"
                >
                    <TbAlertTriangle aria-hidden className="size-5 shrink-0" />
                    만료가 임박한 아이템은 우선 이동하는 것을 권장합니다.
                </div>
            )}

            <ul className="flex flex-col gap-3">
                {items.map((item) => (
                    <TempStorageItemRow
                        key={item.itemInstancePublicId}
                        item={item}
                        now={resolvedNow}
                        pending={pendingId === item.itemInstancePublicId}
                        onRelocate={onRelocate}
                    />
                ))}
            </ul>
        </div>
    )
}

/** 보관 항목 한 행 — 플레이스홀더 아트 + 정보 + 이동 버튼(목업 .storage-item). */
function TempStorageItemRow({
    item,
    now,
    pending,
    onRelocate,
}: {
    item: TempStorageItem
    now: number
    pending: boolean
    onRelocate: (id: string) => void
}) {
    const id = item.itemInstancePublicId
    const detailTo = itemDetailPath(id)
    const shortId = `#${id.slice(-6)}`
    const badge = EXPIRY_BADGE[expiryStateOf(item.expireAt, now)]

    return (
        <li className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[90px_minmax(0,1fr)_auto] sm:gap-5">
            {/* 아트 — 요약 데이터 없음 → 플레이스홀더. 상세로 링크 */}
            <Link
                to={detailTo}
                aria-label={`보관 아이템 ${shortId} 상세 보기`}
                className="justify-self-center"
            >
                <ItemFrame imageUrl={null} name={`보관 아이템 ${shortId}`} />
            </Link>

            {/* 정보 — ID·보관일·만료 배지 */}
            <div className="min-w-0">
                {badge && (
                    <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.className}`}
                    >
                        {badge.label}
                    </span>
                )}
                <Link
                    to={detailTo}
                    className="mt-1.5 block truncate text-base font-bold text-gray-900 hover:text-navy"
                >
                    보관 아이템 {shortId}
                </Link>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <TbClockHour4 aria-hidden className="size-3.5 shrink-0" />
                    {formatStoredAt(item.storedAt)} 보관 · 상세는 아이템
                    페이지에서
                </p>
            </div>

            {/* 이동 — 자동 배정. 진행 중이면 이 행만 비활성(DOM 속성) */}
            <button
                type="button"
                disabled={pending}
                className="col-span-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-navy bg-surface px-4 py-2.5 text-sm font-bold text-navy hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1"
                onClick={() => onRelocate(id)}
            >
                <TbArrowRight aria-hidden className="size-4" />
                {pending ? '이동 중…' : '빈 슬롯으로 이동'}
            </button>
        </li>
    )
}

export default TempStorageList
