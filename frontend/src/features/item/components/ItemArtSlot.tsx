import classNames from '@/utils/classNames'
import { itemArt } from '../lib/itemArt'
import { itemTypeLabel } from '../lib/itemCode'
import { elementLabelOf } from '../lib/element'
import type { ArtSize, ItemArtInput } from '../lib/itemArt'

/**
 * 아이템 카드 아트 슬롯 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **슬롯 주변에 색을 덧입히지 않는다** (사용자 방침 2026-07-19).
 * ══════════════════════════════════════════════════════════════════════════════
 * 구 프론트의 슬롯은 속성별 **딥 글로우** 배경 + **골드포스 금색 아웃라인** + element 4색
 * 테두리를 얹었다. 전부 폐기됐다. 여기 남는 색은 **템플릿 그레이 토큰**뿐이다
 * (`bg-gray-100 dark:bg-gray-700` — 템플릿 `Skeleton`·`Tag` 가 쓰는 것과 같은 면).
 *
 * **아트 PNG 자체의 색은 그대로 나온다** — 그건 이미지 내용물이지 우리가 고른 색이 아니다.
 * 금지된 것은 **주변에 색을 두르는 일**이다. 이 구분을 흐리지 마라.
 *
 * ★ **왜 템플릿 컴포넌트가 아닌가**: 템플릿에는 "고정 픽셀 크기의 도트 아트를 정수배로
 *   확대해 담는 면"이 없다. 가장 가까운 `Avatar` 는 `rounded`·`object-cover` 로 **잘라내고**
 *   비율을 무시하는데, 50×93 세로 아트를 원형·정사각에 넣으면 잘린다. 그래서 슬롯 자체는
 *   만들되 **면·모서리·테두리는 전부 템플릿 토큰**으로 그린다.
 *
 * ★ `image-rendering: pixelated` 는 **취향이 아니라 정확성**이다. 브라우저 기본 보간은
 *   도트 아트를 흐리게 뭉갠다. 정수배 확대와 짝을 이룬다.
 *
 * ★ `width`/`height` 를 속성으로 싣는다 — 이미지 도착 전에도 자리를 차지해 카드가 흔들리지
 *   않는다(CLS).
 */

interface ItemArtSlotProps {
    item: ItemArtInput
    /** 원본 자산 크기. `l` = 50×93, `s` = 26×28 */
    size?: ArtSize
    /** 정수배 확대율 */
    scale?: number
    /** 표시명(스냅샷). 대체 텍스트에 쓴다 */
    name?: string
    className?: string
}

const SURFACE_CLASS =
    'flex shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700'

const ItemArtSlot = ({
    item,
    size = 'l',
    scale = 2,
    name,
    className,
}: ItemArtSlotProps) => {
    const art = itemArt(item, size, scale)

    /*
     * 자산이 없는 조합(범위 밖 레벨·미등록 코드)은 **깨진 이미지 대신 글자**를 낸다.
     * 계약 §3.3 폴백 의무의 화면 쪽 절반이다 — 서버가 우리가 모르는 코드를 먼저 보내도
     * 카드가 비어 보이지 않는다.
     */
    if (!art) {
        return (
            <div
                className={classNames(SURFACE_CLASS, 'p-2', className)}
                data-testid="item-art-placeholder"
            >
                <span className="text-center text-xs leading-tight text-gray-600 dark:text-gray-300">
                    {itemTypeLabel(item.subGroup, item.kind)}
                </span>
            </div>
        )
    }

    /*
     * ★ alt 는 "아이템 이미지"가 아니라 **그림이 실제로 무엇인지**를 적는다 —
     *   속성·종류·레벨. 스크린리더 사용자에게 이 그림의 정보 가치는 그 세 축이 전부다.
     */
    const alt = [
        name,
        `${elementLabelOf(item.element)} 속성`,
        itemTypeLabel(item.subGroup, item.kind),
        `${item.level}레벨`,
    ]
        .filter(Boolean)
        .join(', ')

    return (
        <div
            className={classNames(SURFACE_CLASS, className)}
            data-testid="item-art-slot"
        >
            <img
                src={art.src}
                alt={alt}
                width={art.width}
                height={art.height}
                loading="lazy"
                decoding="async"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    )
}

export default ItemArtSlot
