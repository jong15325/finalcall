import { Link, useParams } from 'react-router'
import { TbAlertTriangle, TbArrowLeft, TbSearchOff } from 'react-icons/tb'
import { paths } from '@/app/paths'
import ItemInstanceDetail from '@/features/item/components/ItemInstanceDetail'
import { hasErrorCode } from '@/lib/api/errors'
import { useItemInstance } from '@/lib/queries/items'
import { ERROR_CODES } from '@/types/errorCodes'
import ElementDetailBackground from '@/features/item/components/ElementDetailBackground'

/**
 * 보유 아이템 인스턴스 상세 `/items/{id}` (FC-077 — 목업 `itemDetail()` · design-brief B-11).
 *
 * ★ 인벤토리·임시보관이 이미 링크를 걸어둔 목적지다(마이 축 스토리지). 실연동은 계약이 준
 *   `GET /items/{id}` 하나 — 스킬 **이름**이 내려오는 유일한 화면이다(§2.5).
 * ★ 없음(`ITEM_001` 404)은 전용 빈상태로, 전송 실패는 재시도로 나눈다. 데모 하드코딩 없음.
 */
export default function ItemDetailPage() {
    const { id = '' } = useParams()
    const detailQuery = useItemInstance(id)
    if (detailQuery.isPending) {
        return <DetailSkeleton />
    }

    if (detailQuery.isError || !detailQuery.data) {
        const notFound = hasErrorCode(detailQuery.error, ERROR_CODES.ITEM_001)
        return (
            <div className="flex flex-col gap-5">
                <Link
                    to={paths.inventory}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-content-subtle hover:text-brand-structure"
                >
                    <TbArrowLeft aria-hidden className="size-4" />
                    인벤토리
                </Link>
                <div className="rounded-2xl border border-content-line bg-content-surface px-6 py-16 text-center">
                    {notFound ? (
                        <TbSearchOff
                            aria-hidden
                            className="mx-auto size-10 text-content-line"
                        />
                    ) : (
                        <TbAlertTriangle
                            aria-hidden
                            className="mx-auto size-10 text-content-line"
                        />
                    )}
                    <p className="mt-4 text-base font-bold text-content-fg">
                        {notFound
                            ? '아이템을 찾을 수 없습니다'
                            : '아이템을 불러오지 못했습니다'}
                    </p>
                    <p className="mt-1 text-sm text-content-subtle">
                        {notFound
                            ? '이미 사라졌거나 주소가 잘못되었습니다.'
                            : '잠시 후 다시 시도해 주세요.'}
                    </p>
                    <div className="mt-5">
                        {notFound ? (
                            <Link
                                to={paths.inventory}
                                className="inline-flex rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                            >
                                인벤토리로
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                                onClick={() => void detailQuery.refetch()}
                            >
                                다시 시도
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <ElementDetailBackground element={detailQuery.data.template.element}>
            <ItemInstanceDetail item={detailQuery.data} />
        </ElementDetailBackground>
    )
}

/** 로딩 스켈레톤 — 아트 + 스펙 카드 자리를 비워 CLS 를 막는다(상세 그리드와 동형). */
function DetailSkeleton() {
    return (
        <div aria-hidden className="flex flex-col gap-5">
            <div className="h-5 w-24 animate-pulse rounded bg-content-soft" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="h-[280px] animate-pulse rounded-2xl bg-content-soft lg:h-[430px]" />
                <div className="h-[430px] animate-pulse rounded-2xl bg-content-soft" />
            </div>
        </div>
    )
}
