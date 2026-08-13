import { useMemo, useState } from 'react'
import { TbCheck, TbX } from 'react-icons/tb'
import type { DeliverySummary } from '@/lib/api/deliveries'

/**
 * 게임 도착(APPLIED) 알림 배너 — 인벤토리 상단 (FC-190 · 디자인 승인 "세션 1회 dismiss").
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **세션당 1회 노출 후 닫기 가능**(디자인 승인, 2026-08-05). 상시 요약이 아니다 — 닫으면
 *   이 세션에서는 다시 뜨지 않는다. 닫은 배송 id 를 `sessionStorage` 에 적재해 기억한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ APPLIED 아이템은 `IN_GAME` 으로 이동해 웹 인벤에서 빠지므로(계약 §4.6), 인벤 목록엔 없고
 *   이 배너 + 거래내역에만 "게임 도착" 으로 남는다. 배너는 그 전이를 사용자에게 한 번 알린다.
 * ★ 닫기 전까지만 노출. 표시할 도착이 없거나 전부 닫혔으면 아무것도 그리지 않는다.
 */

const DISMISS_KEY = 'delivery.arrived.dismissed'

/** 세션에 저장된 닫은 배송 id 집합(파싱 실패는 빈 집합). */
function readDismissed(): Set<string> {
    try {
        const raw = sessionStorage.getItem(DISMISS_KEY)
        if (!raw) return new Set()
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed)
            ? new Set(parsed.filter((v): v is string => typeof v === 'string'))
            : new Set()
    } catch {
        return new Set()
    }
}

function persistDismissed(ids: Set<string>): void {
    try {
        sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]))
    } catch {
        // sessionStorage 불가(프라이빗 모드 등)면 조용히 무시 — 배너는 이 세션 렌더 동안만 유지.
    }
}

interface DeliveredBannerProps {
    /** APPLIED(게임 도착) 배송 목록. 상위(InventoryPage)가 배송 lookup 에서 필터해 넘긴다. */
    arrived: DeliverySummary[]
}

export default function DeliveredBanner({ arrived }: DeliveredBannerProps) {
    // 마운트 시 1회 스냅샷 — 렌더 중 sessionStorage 를 다시 읽지 않는다(안정).
    const [dismissed, setDismissed] = useState<Set<string>>(readDismissed)

    const visible = useMemo(
        () => arrived.filter((d) => !dismissed.has(d.deliveryPublicId)),
        [arrived, dismissed],
    )

    if (visible.length === 0) return null

    const dismiss = () => {
        const next = new Set(dismissed)
        for (const d of visible) next.add(d.deliveryPublicId)
        persistDismissed(next)
        setDismissed(next)
    }

    const names = visible.map((d) => d.item.displayName)
    const lead =
        names.length === 1
            ? `${names[0]}`
            : `${names[0]} 외 ${names.length - 1}건`

    return (
        <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-success/40 bg-success-soft px-4 py-3 text-[13px] leading-relaxed text-success-ink"
        >
            <TbCheck aria-hidden className="mt-0.5 size-[18px] shrink-0" />
            <div className="min-w-0 flex-1">
                <b className="font-bold">{lead}</b>
                {'이(가) 게임에 도착했어요. '}
                캐릭터 인벤토리에서 확인하세요. 웹 인벤토리에서는 이제 보이지
                않고, 거래 내역에 <b className="font-bold">게임 도착</b>으로
                남습니다.
            </div>
            <button
                type="button"
                aria-label="게임 도착 알림 닫기"
                className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-success-ink hover:bg-success/10"
                onClick={dismiss}
            >
                <TbX aria-hidden className="size-4" />
            </button>
        </div>
    )
}
