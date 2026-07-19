import classNames from '@/utils/classNames'
import { itemArt } from '../lib/itemArt'
import { itemTypeLabel } from '../lib/itemCode'
import { elementLabelOf } from '../lib/element'
import './itemOutline.css'
import type { ArtSize, ItemArtInput } from '../lib/itemArt'

/**
 * 아이템 카드 아트 슬롯 (FC-058 → 재작업 2차).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **아웃라인은 아트에 밀착한다. 카드 테두리가 아니다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `docs/ux/design-system.md §5.12` 가 못박는다 — *"적용 위치 = 아이템 아트 프레임(아트 박스
 * 안쪽). 카드 외곽선이 아니다."* 원본 노트도 *"아이템 슬롯칸의 **아이템 테두리**에 gold.png
 * 적용"* 이다. **카드 테두리에 두르는 안은 원본 문서가 이미 기각했다.**
 *
 * 그래서 프레임(`fc-art-frame`)이 **`<img>` 를 직접 감싸고**, 링은 `padding`·`border` 로
 * **안쪽으로만** 자란다. 바깥으로 번질 수 없으므로 아트와 링 사이에 틈이 생기지 않고,
 * 카드 면·버튼·헤더에 닿을 수도 없다 — 규칙이 아니라 **기하로 보장**된다.
 *
 * 슬롯 바탕(`bg-gray-100 dark:bg-gray-700`, 여백)은 프레임 **바깥** 요소다.
 * 즉 [슬롯 여백] → [금 링(밀착)] → [아트] 순이라 링과 그림 사이에 간격이 없다.
 *
 * ★ 2겹 구조·색값·두께 공식은 전부 §5.12 실측치이며 CSS 는 `itemOutline.css` 가 갖는다
 *   (구현 함정 2건을 어떻게 피했는지도 거기 적혀 있다).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **아웃라인을 전부 제거해도 정보 손실이 없다** — §5.12 접근성 합격선.
 * ══════════════════════════════════════════════════════════════════════════════
 * 사용자가 속성·종류·레벨 태그를 지우라 했으므로 골드포스가 **색에만** 실리면
 * 그 순간 색 단독 전달(WCAG 1.4.1)이 된다. 세 경로로 글자를 남긴다:
 *   ① 카드 본문의 **`GoldforceChip`**(칩 + 금 도트 + "골드포스" 텍스트)
 *   ② 아트 **`alt`** 에 "골드포스 적용" 한 조각
 *   ③ 레벨은 `alt` 의 "N레벨" + 아트 위 레벨 칩
 *
 * ★★ **레벨 칩 — 태그를 지우면서 유일하게 사라지는 정보를 여기에 남긴다.**
 *    속성·종류는 `nameSnapshot`("물의 검")이 이미 말한다. **레벨만 이름에 없다.**
 *    ※ 등급 배지(D-073)가 아니다 — 등급은 S/A/B 같은 **평가**고 레벨은 인스턴스 **사실**이다.
 *
 * ★ `image-rendering: pixelated` 는 취향이 아니라 정확성(정수배 확대와 짝), `width`/`height`
 *   속성은 CLS 방지.
 */

interface ItemArtSlotProps {
    item: ItemArtInput
    /** 원본 자산 크기. `l` = 50×93, `s` = 26×28 */
    size?: ArtSize
    /** 정수배 확대율. **아웃라인 두께가 여기서 파생된다**(§5.12 `--art-scale`) */
    scale?: number
    /**
     * 좁은 화면(<480px)에서 쓸 배율. 생략하면 `scale` 과 같다.
     *
     * ★ **왜 JS 가 아니라 CSS 변수로 넘기는가** — 자바스크립트로 화면 폭을 재서 배율을 고르면
     *   (a) 첫 렌더가 항상 틀린 값으로 한 번 그려지고 (b) resize 리스너가 카드마다 붙는다.
     *   미디어쿼리는 두 문제가 다 없고, **아트와 링이 같은 변수에서 파생**되므로 둘이
     *   어긋날 수 없다(모바일에서 아웃라인 비율이 무너졌던 원인이 바로 그 어긋남이다).
     */
    scaleNarrow?: number
    /** 표시명(스냅샷). 대체 텍스트에 쓴다 */
    name?: string
    /** 골드포스 활성 여부 — 아웃라인을 금/블랙으로 가른다(파생은 `lib/goldforce.ts`) */
    goldforce?: boolean
    /** 레벨 칩 표시. 아트가 너무 작은 자리에서는 끈다 */
    showLevel?: boolean
    className?: string
}

/** 슬롯 = 아트 주변 여백면. 링은 이 안쪽의 프레임이 갖는다. */
const SURFACE_CLASS =
    'relative flex shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700'

const ItemArtSlot = ({
    item,
    size = 'l',
    scale = 2,
    scaleNarrow,
    name,
    goldforce = false,
    showLevel = false,
    className,
}: ItemArtSlotProps) => {
    // 경로·원본 치수는 배율과 무관하다. 배율은 CSS 가 곱한다(아래 --art-w/--art-h).
    const art = itemArt(item, size, 1)

    /*
     * 자산이 없는 조합(범위 밖 레벨·미등록 코드)은 **깨진 이미지 대신 글자**를 낸다.
     * 계약 §3.3 폴백 의무의 화면 쪽 절반이다. 아웃라인은 아트에 붙는 것이므로 여기엔 없다.
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
     * ★ alt 는 "아이템 이미지"가 아니라 **그림이 실제로 무엇인지**를 적는다.
     *   태그를 지운 지금 **이 문장이 스크린리더 사용자에게 유일한 속성 정보**다 — 줄이지 마라.
     *   골드포스도 여기에 글자로 들어간다(아웃라인이 색이라서).
     */
    const alt = [
        name,
        `${elementLabelOf(item.element)} 속성`,
        itemTypeLabel(item.subGroup, item.kind),
        `${item.level}레벨`,
        goldforce ? '골드포스 적용' : null,
    ]
        .filter(Boolean)
        .join(', ')

    return (
        <div
            className={classNames(SURFACE_CLASS, className)}
            data-testid="item-art-slot"
            data-goldforce={goldforce}
        >
            {/* 프레임이 <img> 를 직접 감싼다 = 링이 아트에 밀착한다(위 ★★). */}
            <div
                className={classNames(
                    'fc-art-frame rounded-[3px]',
                    goldforce ? 'fc-outline-gold' : 'fc-outline-black',
                )}
                style={
                    {
                        // 아트 크기·링 두께가 **이 두 값에서 함께** 파생된다(itemOutline.css).
                        '--art-scale-wide': scale,
                        '--art-scale-narrow': scaleNarrow ?? scale,
                        '--art-w': art.width,
                        '--art-h': art.height,
                    } as React.CSSProperties
                }
                data-testid="item-art-frame"
            >
                {/*
                 * 흰 셰인은 **골드포스에만** 흐른다. 원본이 `bcard_twingkle` 을 골드포스
                 * 카드에만 합성하고, 모든 카드가 반짝이면 희소성이 사라진다.
                 */}
                {goldforce && (
                    <span
                        aria-hidden="true"
                        className="fc-art-shine"
                        data-testid="goldforce-shine"
                    />
                )}

                <div className="fc-art-bevel">
                    {/*
                     * 크기는 `.fc-art-img` 가 `--art-scale` 로 계산한다. `width`/`height` 속성은
                     * **원본 치수**를 그대로 실어 종횡비를 알린다(CLS 는 CSS 가 이미 막는다).
                     */}
                    <img
                        className="fc-art-img"
                        src={art.src}
                        alt={alt}
                        width={art.width}
                        height={art.height}
                        loading="lazy"
                        decoding="async"
                    />
                </div>
            </div>

            {showLevel && (
                <span
                    // 대체 텍스트가 이미 "9레벨"을 말한다 — 중복해 읽히지 않게 숨긴다.
                    aria-hidden="true"
                    data-testid="item-level-chip"
                    className="absolute bottom-1 right-1 z-10 rounded-md bg-gray-900/90 px-1.5 py-0.5 text-[0.6875rem] font-bold leading-none tabular-nums text-white dark:bg-gray-950/90"
                >
                    Lv.{item.level}
                </span>
            )}
        </div>
    )
}

export default ItemArtSlot
