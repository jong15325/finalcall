import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { TbId, TbX } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import ItemFrame from '@/features/item/components/ItemFrame'
import {
    goldforceRemainingDays,
    resolveFrameType,
} from '@/features/item/components/frame'
import {
    resolveSkillSlots,
    skillLabelOf,
} from '@/features/item/components/skillSlots'
import { itemArt } from '@/features/item/lib/itemArt'
import { toElementKey, elementLabelOf } from '@/features/item/lib/element'
import { subGroupLabelOf } from '@/features/item/lib/itemCode'
import { usePurchaseShop } from '@/lib/queries/shop'
import {
    isShopPurchasable,
    shopStatusLabelOf,
} from '@/features/shop/lib/shopStatus'
import { channelLimitOf } from '@/features/shop/lib/channelLimit'
import { shopPurchaseErrorViewOf } from '@/features/shop/lib/shopErrors'
import type { ShopSummary } from '@/lib/api/shop'
import type { BalanceResponse } from '@/lib/api/balance'
import './ShopCardInfoDialog.css'

/**
 * 카드정보 스타일 즉시구매 모달 (FC-146 — 승인 목업 `market-quickbuy-cardinfo.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **마켓 목록에서 카드 영역 전체 클릭 → 이 모달로 바로 구매**한다(상세페이지 네비게이션 대체).
 *   게임 카드정보의 **구조(헤더 → 썸네일|속성표 → 특수스킬 → 판매자 → 가격+구매)만 계승**하되,
 *   비주얼은 **게임 다크 네이비 패널·골드 금속프레임을 걷어내고 앱 라이트 커머스 문법**
 *   (흰 surface·헤어라인·부드러운 그림자·radius·여백)으로 재설계했다(FC-146 재디자인). 지배색은
 *   앱 웹 톤(surface/gray/line)이고 골드는 가격·포인트, 오렌지는 CTA로만 절제한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **썸네일 배경 제거**: 게임 네이비 비네트/스포트라이트/글로우를 걷고 라이트 뉴트럴 미디어
 *   패널에 픽셀아트 카드(프레임 PNG 포함)만 크롭·왜곡 없이 올린다(`.ci-thumb` 스코프 오버라이드).
 * ★ **속성표 5행 = 타입 · 명칭 · 채널제한 · 속성 · 남은 골드 포스**(참조 이미지 정합). 채널제한은
 *   계약에 없어 `level` 로부터 표시 파생한다(`channelLimitOf` — 표시 전용·계약 아님).
 * ★ 목업 대비 **랭크 뱃지·탭은 제거**했다(계약에 없는 연출) — 특수스킬 섹션만 탭 없이 직접 노출.
 * ★ **모달 배선(초점 트랩·스크롤 잠금·Esc·backdrop·role=dialog)은 `ShopPurchaseDialog` 에서
 *   이식**했다. 컴포넌트는 열릴 때만 마운트되므로 초기화 effect 의존은 마운트(`[]`)뿐이다 —
 *   부모(마켓 목록) 리렌더가 초점을 강탈하지 않는다.
 * ★ **상태 분기는 `ShopBuyPanel` 로직 재사용**: 판매종료→비활성 / 자기상품→비활성 / 비로그인→
 *   로그인 유도(returnUrl) / 판매 중→"바로 구매". 비활성은 DOM `disabled`(WCAG 4.1.2), 최종
 *   판정은 서버(SHOP_004·SHOP_006).
 * ★ 데이터는 목록 `ShopSummary`(item 블록 · price · endAt · sellerNickname)로 모두 채운다 —
 *   상세 추가 조회 없이 목록 흐름을 끊지 않는다. 구매 실패는 `code` 로 분기(`shopErrors`).
 * ★ **판매자는 특수스킬 하단 독립 행**(아바타 이니셜 + "판매자" 라벨 + 닉네임 + 거래 건수)으로
 *   노출한다. 거래 건수는 계약 신규 필드 `sellerCompletedSales`(FC-148 — 정산원장 실집계, 위조
 *   아님)를 실값으로 표시하며, 우측 신뢰 칩("거래 N회")에 배치한다. 이력 없으면(0) "신규 판매자".
 *   헤더 마크는 게임식 네이비 사각형을 걷고 앱 톤 아이콘(`TbId`)으로 재디자인했다.
 */

interface ShopCardInfoDialogProps {
    shop: ShopSummary
    /** 골드포스·구매가능 파생 기준 시각(목록에서 마운트 시각 1회 주입) */
    now: number
    /** 사용 가능 게임머니 출처(GET /me/balance). 비로그인·미확정이면 화면에서 null 처리 */
    balance: BalanceResponse | undefined
    isAuthed: boolean
    /** 판매자 본인 여부(닉네임 파생 표시 제어 — 인가는 서버) */
    isOwn: boolean
    /** 비로그인 시 이동할 로그인 경로(returnUrl 포함) */
    loginHref: string
    onClose: () => void
}

function ShopCardInfoDialog({
    shop,
    now,
    balance,
    isAuthed,
    isOwn,
    loginHref,
    onClose,
}: ShopCardInfoDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    /** 최신 onClose — effect 의존에서 빼기 위한 콜백 ref */
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    const purchaseMutation = usePurchaseShop(shop.shopPublicId)
    /** 'info' = 카드정보 · 'confirm' = 구매 확인/성공/실패 서브뷰 */
    const [step, setStep] = useState<'info' | 'confirm'>('info')

    // ── 초점 트랩 · 스크롤 잠금 · Esc(ShopPurchaseDialog 이식) ────────────────
    useEffect(() => {
        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusRaf = requestAnimationFrame(() => closeRef.current?.focus())

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCloseRef.current()
                return
            }
            if (event.key !== 'Tab') return

            const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            )
            if (!focusables || focusables.length === 0) return

            const list = Array.from(focusables).filter(
                (el) => !el.hasAttribute('disabled') && !el.closest('[inert]'),
            )
            const first = list[0]
            const last = list[list.length - 1]
            const active = document.activeElement

            if (event.shiftKey && active === first) {
                event.preventDefault()
                last?.focus()
            } else if (!event.shiftKey && active === last) {
                event.preventDefault()
                first?.focus()
            }
        }
        document.addEventListener('keydown', onKeyDown)

        return () => {
            cancelAnimationFrame(focusRaf)
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previousOverflow
            previousFocusRef.current?.focus()
        }
    }, [])

    // 구매 확인 서브뷰로 진입하면 확정 버튼으로 초점을 옮긴다(질문 단계).
    useEffect(() => {
        if (step === 'confirm' && !purchaseMutation.isSuccess) {
            confirmRef.current?.focus()
        }
    }, [step, purchaseMutation.isSuccess])

    const { item } = shop
    const isGoldforce =
        resolveFrameType({ goldforceExpireAt: item.goldforceExpireAt }, now) ===
        'GOLDFORCE'
    const frameLabel = isGoldforce ? '골드' : '블랙'
    const typeLine = `${frameLabel} - ${subGroupLabelOf(item.subGroup)}`
    const channelLimit = channelLimitOf(item.level)
    const elementLabel = elementLabelOf(item.element)
    const elementKey = toElementKey(item.element)
    const goldforceDays = goldforceRemainingDays(item.goldforceExpireAt, now)
    const art = itemArt(
        {
            subGroup: item.subGroup,
            kind: item.kind,
            element: item.element,
            level: item.level,
        },
        'l',
        2,
    )
    const skills = resolveSkillSlots(item.skill1, item.skill2, {
        skill1Name: item.skill1Name,
        skill2Name: item.skill2Name,
    })
    const purchasable = isShopPurchasable(shop.status, shop.endAt, now)
    /** 판매자 아바타 이니셜(닉네임 첫 글자 — 서러게이트 안전). */
    const sellerInitial = [...shop.sellerNickname][0] ?? '?'
    /**
     * 판매자 완료 판매 건수(계약 §3.3 `sellerCompletedSales`). 백엔드(FC-149) 병렬이라 런타임에
     * 아직 필드가 없을 수 있어 `?? 0` 으로 안전 폴백한다(0 == "신규 판매자" 로 정직 표기).
     */
    const completedSales = shop.sellerCompletedSales ?? 0
    const sellerTradeLabel =
        completedSales > 0
            ? `거래 ${completedSales.toLocaleString('ko-KR')}회`
            : '신규 판매자'
    const gameMoneyAvailable = isAuthed
        ? (balance?.gameMoneyAvailable ?? null)
        : null
    const remainingAfter =
        gameMoneyAvailable !== null ? gameMoneyAvailable - shop.price : null

    const openConfirm = () => {
        purchaseMutation.reset()
        setStep('confirm')
    }
    const backToInfo = () => {
        purchaseMutation.reset()
        setStep('info')
    }
    const handlePurchase = () => purchaseMutation.mutate()

    const isSubmitting = purchaseMutation.isPending
    const errorView = purchaseMutation.isError
        ? shopPurchaseErrorViewOf(purchaseMutation.error)
        : null
    /**
     * 구매 확인 오버레이가 뜨면 가려진 카드정보 배경(헤더·본문·푸터 CTA)을 `inert` 처리한다 —
     * Tab 초점이 배경 컨트롤(X·구매 버튼)로 새지 않게(초점 트랩도 `[inert]` 하위를 건너뛴다).
     */
    const backgroundInert = step === 'confirm'

    return (
        <div
            className="shop-cardinfo-overlay"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="shopCardInfoTitle"
                className="shop-cardinfo"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="ci-title" inert={backgroundInert}>
                    <span aria-hidden className="ci-mark">
                        <TbId className="size-[18px]" />
                    </span>
                    <h2 id="shopCardInfoTitle">
                        카드정보 <small>CARD INFO</small>
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        className="ci-x"
                        aria-label="닫기"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-4" />
                    </button>
                </div>

                <div className="ci-scroll" inert={backgroundInert}>
                    <div className="ci-head">
                        <div className="ci-thumb">
                            <ItemFrame
                                fill
                                showGoldforceDays
                                size="stage"
                                imageUrl={art?.src}
                                spriteUrl={art?.src}
                                name={item.nameSnapshot}
                                visual={{
                                    goldforceExpireAt: item.goldforceExpireAt,
                                }}
                                hasSkill={skills.length > 0}
                                now={now}
                                className="[--art-scale:2]"
                            />
                        </div>

                        <dl className="ci-attrs">
                            <div className="ci-row">
                                <dt className="k">타입</dt>
                                <dd className="v">{typeLine}</dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">명칭</dt>
                                <dd className="v">{item.nameSnapshot}</dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">채널제한</dt>
                                <dd className="v">{channelLimit}</dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">속성</dt>
                                <dd
                                    className={`v ${elementKey ? `el-${elementKey}` : ''}`.trim()}
                                >
                                    {elementLabel}
                                </dd>
                            </div>
                            <div className="ci-row">
                                <dt className="k">남은 골드 포스</dt>
                                <dd
                                    className={`v ${goldforceDays ? '' : 'gf-off'}`.trim()}
                                >
                                    {goldforceDays
                                        ? `${goldforceDays}일`
                                        : '없음'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    {/* 특수 스킬 — 탭 없이 직접 노출(랭크·탭 제거) */}
                    <div className="ci-panel">
                        <h3>특수 스킬</h3>
                        {skills.length > 0 ? (
                            <ul className="skill-list" aria-label="특수 스킬">
                                {skills.map((skill) => {
                                    const showPercent =
                                        skill.slot === 2 &&
                                        item.skillPercent > 0
                                    return (
                                        <li key={skill.slot}>
                                            <span aria-hidden className="n">
                                                {skill.slot}
                                            </span>
                                            <span>
                                                {skillLabelOf(skill)}
                                                {showPercent && (
                                                    <span className="pct">
                                                        {' '}
                                                        ({item.skillPercent}%)
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <p className="muted-note">
                                보유한 특수 스킬이 없습니다.
                            </p>
                        )}
                    </div>

                    {/* 판매자 — 특수스킬 하단 독립 행(아바타 이니셜 + 라벨 + 닉네임 + 거래 건수 칩). */}
                    <div className="ci-seller">
                        <span aria-hidden className="avatar">
                            {sellerInitial}
                        </span>
                        <div className="who">
                            <span className="lbl">판매자</span>
                            <span className="name">{shop.sellerNickname}</span>
                        </div>
                        {/* 신뢰 지표 = 완료 판매 건수 실값(계약 sellerCompletedSales). 0이면 "신규 판매자". */}
                        <span className="trade">{sellerTradeLabel}</span>
                    </div>
                </div>

                {/* 하단 액션: 판매가 + 상태별 CTA */}
                <div className="ci-foot" inert={backgroundInert}>
                    <div className="ci-price">
                        <span className="lbl">판매가</span>
                        <CodeAmount
                            value={shop.price}
                            mode="full"
                            className="amt"
                        />
                    </div>

                    {!purchasable ? (
                        <button disabled type="button" className="ci-buy">
                            {shopStatusLabelOf(shop.status)}
                        </button>
                    ) : isOwn ? (
                        <button disabled type="button" className="ci-buy">
                            내 상품입니다
                        </button>
                    ) : !isAuthed ? (
                        <Link to={loginHref} className="ci-buy">
                            로그인하고 구매
                        </Link>
                    ) : (
                        <button
                            type="button"
                            className="ci-buy"
                            onClick={openConfirm}
                        >
                            바로 구매
                        </button>
                    )}
                </div>

                {/* 구매 확인 / 성공 / 실패 서브뷰 */}
                {step === 'confirm' && (
                    <div className="confirm">
                        <div className="confirm-box">
                            {purchaseMutation.isSuccess ? (
                                <>
                                    <div aria-hidden className="icon ok">
                                        ✓
                                    </div>
                                    <h4>구매 완료</h4>
                                    <p>
                                        <b>{item.nameSnapshot}</b> 을(를)
                                        구매했습니다.
                                        <br />
                                        아이템은 인벤토리에서 확인하세요.
                                    </p>
                                    <div className="confirm-price">
                                        <span className="k">결제 금액</span>
                                        <span className="v">
                                            <CodeAmount
                                                value={
                                                    purchaseMutation.data
                                                        ?.finalPrice ??
                                                    shop.price
                                                }
                                                mode="full"
                                            />
                                        </span>
                                    </div>
                                    <div className="confirm-actions">
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={onClose}
                                        >
                                            확인
                                        </button>
                                    </div>
                                </>
                            ) : errorView ? (
                                <div role="alert">
                                    <div aria-hidden className="icon err">
                                        !
                                    </div>
                                    <h4>{errorView.title}</h4>
                                    {errorView.description && (
                                        <p>{errorView.description}</p>
                                    )}
                                    <div className="confirm-actions">
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={backToInfo}
                                        >
                                            돌아가기
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div aria-hidden className="icon q">
                                        ?
                                    </div>
                                    <h4>{item.nameSnapshot}</h4>
                                    <p>
                                        아래 금액으로 즉시 구매됩니다.
                                        게임머니가 바로 차감되고
                                        <br />
                                        아이템은 인벤토리로 들어옵니다.
                                    </p>
                                    <div className="confirm-price">
                                        <span className="k">판매가</span>
                                        <span className="v">
                                            <CodeAmount
                                                value={shop.price}
                                                mode="full"
                                            />
                                        </span>
                                    </div>
                                    {remainingAfter !== null && (
                                        <div className="confirm-price">
                                            <span className="k">
                                                구매 후 잔액
                                            </span>
                                            <span
                                                className={`v ${remainingAfter < 0 ? 'low' : ''}`.trim()}
                                            >
                                                <CodeAmount
                                                    value={remainingAfter}
                                                    mode="full"
                                                />
                                            </span>
                                        </div>
                                    )}
                                    <div className="confirm-actions">
                                        <button
                                            type="button"
                                            className="btn-ghost"
                                            disabled={isSubmitting}
                                            onClick={backToInfo}
                                        >
                                            취소
                                        </button>
                                        <button
                                            ref={confirmRef}
                                            type="button"
                                            className="btn-primary"
                                            disabled={isSubmitting}
                                            onClick={handlePurchase}
                                        >
                                            {isSubmitting
                                                ? '전송 중…'
                                                : '구매 확정'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ShopCardInfoDialog
