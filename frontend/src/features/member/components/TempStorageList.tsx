import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { TbAlertTriangle, TbArrowRight, TbClockHour4 } from 'react-icons/tb'
import { itemDetailPath } from '@/app/paths'
import ItemFrame from '@/features/item/components/ItemFrame'
import { itemArt } from '@/features/item/lib/itemArt'
import {
    expiryStateOf,
    hasImminentExpiry,
} from '@/features/member/lib/tempStorageExpiry'
import type { ExpiryState } from '@/features/member/lib/tempStorageExpiry'
import type { TempStorageItem } from '@/lib/api/tempStorage'

/**
 * 임시 보관함 목록 (FC-076 — 목업 `.storage-list`/`.storage-item`/`.storage-alert` · design-brief B-10).
 *
 * ★ **계약 §4.2의 `summary.cardInfo`가 카드 표시 정본**이다. 목록 응답만으로 아트·명칭·프레임·
 *   스킬 적용 여부를 표시하며 항목별 상세 재조회나 원시 필드 폴백을 두지 않는다.
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
        className: 'bg-danger-soft text-danger-ink',
    },
    imminent: {
        label: '만료 임박',
        className: 'bg-warning-soft text-warning',
    },
    safe: {
        label: '보관 중',
        className: 'bg-content-soft text-content-subtle',
    },
    none: {
        label: '보관 중',
        className: 'bg-content-soft text-content-subtle',
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
                    className="flex items-center gap-2 rounded-xl border border-warning-soft bg-warning-soft/40 px-4 py-3 text-sm font-semibold text-warning"
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
    const badge = EXPIRY_BADGE[expiryStateOf(item.expireAt, now)]

    return (
        <li className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-2xl border border-content-line bg-content-surface p-4 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:gap-5">
            {/* 아트 — 인스턴스 상세로 실제 이미지 파생(없으면 플레이스홀더). 상세로 링크 */}
            <Link
                to={detailTo}
                aria-label={`${item.summary.cardInfo.shortName} 상세 보기`}
                className="block"
            >
                <TempStorageArt item={item} />
            </Link>

            {/* 정보 — 서버 카드 명칭·보관일·만료 배지 */}
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
                    className="mt-1.5 block truncate text-base font-bold text-content-fg hover:text-brand-structure"
                >
                    {item.summary.cardInfo.shortName}
                </Link>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-content-subtle">
                    <TbClockHour4 aria-hidden className="size-3.5 shrink-0" />
                    {formatStoredAt(item.storedAt)} 보관 · 상세는 아이템
                    페이지에서
                </p>
            </div>

            {/* 이동 — 자동 배정. 진행 중이면 이 행만 비활성(DOM 속성) */}
            <button
                type="button"
                disabled={pending}
                className="col-span-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-structure bg-content-surface px-4 py-2.5 text-sm font-bold text-brand-structure hover:bg-brand-structure hover:text-on-strong disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1"
                onClick={() => onRelocate(id)}
            >
                <TbArrowRight aria-hidden className="size-4" />
                {pending ? '이동 중…' : '빈 슬롯으로 이동'}
            </button>
        </li>
    )
}

/**
 * 보관 항목 아트 — 인스턴스 상세를 조회해 실제 이미지를 파생한다(§4.2 요약 미제공 보완).
 * 로딩·실패·자산부재 어느 경우든 ItemFrame 플레이스홀더로 폴백 → **깨진 이미지 0**(FC-085 #1).
 */
function TempStorageArt({ item }: { item: TempStorageItem }) {
    const { summary } = item
    const cardInfo = summary.cardInfo
    const typeCode = String(summary.typeCode).padStart(4, '0')
    const art = itemArt(
        {
            subGroup: Number(typeCode[1]),
            element: Number(typeCode[2]),
            kind: Number(typeCode[3]),
            level: cardInfo.level,
        },
        'l',
        1,
    )
    const hasSkill = cardInfo.skills.some((skill) => skill.code !== null)

    return (
        <span
            className="item-sprite-stage flex h-[150px] w-full items-center justify-center rounded-xl border border-[var(--item-stage-line)]"
            style={
                art?.src
                    ? ({
                          '--item-sprite': `url("${art.src}")`,
                      } as CSSProperties)
                    : undefined
            }
        >
            <ItemFrame
                imageUrl={art?.src ?? null}
                spriteUrl={art?.src ?? null}
                name={cardInfo.shortName}
                frame={cardInfo.frame}
                hasSkill={hasSkill}
                size="frame"
            />
        </span>
    )
}

export default TempStorageList
