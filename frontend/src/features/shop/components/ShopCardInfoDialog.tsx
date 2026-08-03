import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import CodeAmount from '@/components/common/CodeAmount'
import CardInfoDialog from '@/features/item/components/CardInfoDialog'
import { usePurchaseShop } from '@/lib/queries/shop'
import {
    isShopPurchasable,
    shopStatusLabelOf,
} from '@/features/shop/lib/shopStatus'
import { shopPurchaseErrorViewOf } from '@/features/shop/lib/shopErrors'
import type { ShopSummary } from '@/lib/api/shop'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 카드정보 스타일 즉시구매 모달 (FC-146 — 승인 목업 `market-quickbuy-cardinfo.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **마켓 목록에서 카드 영역 전체 클릭 → 이 모달로 바로 구매**한다(상세페이지 네비게이션 대체).
 *   **셸(`CardInfoDialog`) 소비자**다(EPIC-CARD-SYSTEM T4) — 헤더·썸네일·속성표·특수스킬·모달
 *   배선은 셸이 소유하고, 이 컴포넌트는 마켓 고유의 **판매자 행·판매가+구매 CTA·구매 확인 서브뷰**만
 *   슬롯으로 주입한다. **구매 뮤테이션·잔액·isOwn 은 셸에 올리지 않고 여기 잔류**한다(제안 §2.4 —
 *   FC-178 포크 사유를 슬롯 seam 으로 해소).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **상태 분기는 `ShopBuyPanel` 로직 재사용**: 판매종료→비활성 / 자기상품→비활성 / 비로그인→
 *   로그인 유도(returnUrl) / 판매 중→"바로 구매". 비활성은 DOM `disabled`(WCAG 4.1.2), 최종
 *   판정은 서버(SHOP_004·SHOP_006).
 * ★ 데이터는 목록 `ShopSummary`(item 블록 · price · endAt · sellerNickname)로 모두 채운다 —
 *   상세 추가 조회 없이 목록 흐름을 끊지 않는다. 구매 실패는 `code` 로 분기(`shopErrors`).
 * ★ **판매자는 특수스킬 하단 독립 행**(아바타 이니셜 + "판매자" 라벨 + 닉네임 + 거래 건수)으로
 *   노출한다. 거래 건수는 계약 신규 필드 `sellerCompletedSales`(FC-148 — 정산원장 실집계, 위조
 *   아님)를 실값으로 표시하며, 우측 신뢰 칩("거래 N회")에 배치한다. 이력 없으면(0) "신규 판매자".
 * ★ **구매 확인 서브뷰**는 셸 `overlay` 슬롯으로 주입한다. 서브뷰가 뜨면 `backgroundInert` 로
 *   배경(제목·본문·푸터 CTA)을 `inert` 처리해 Tab 초점이 배경 컨트롤로 새지 않게 한다(초점 트랩도
 *   `[inert]` 하위를 건너뛴다).
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
    const confirmRef = useRef<HTMLButtonElement>(null)

    const purchaseMutation = usePurchaseShop(shop.shopPublicId)
    /** 'info' = 카드정보 · 'confirm' = 구매 확인/성공/실패 서브뷰 */
    const [step, setStep] = useState<'info' | 'confirm'>('info')

    // 구매 확인 서브뷰로 진입하면 확정 버튼으로 초점을 옮긴다(질문 단계).
    useEffect(() => {
        if (step === 'confirm' && !purchaseMutation.isSuccess) {
            confirmRef.current?.focus()
        }
    }, [step, purchaseMutation.isSuccess])

    const { item } = shop
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

    // 판매자 — 특수스킬 하단 독립 행(아바타 이니셜 + 라벨 + 닉네임 + 거래 건수 칩).
    const sellerRow = (
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
    )

    // 하단 액션: 판매가 + 상태별 CTA.
    const footer = (
        <>
            <div className="ci-price">
                <span className="lbl">판매가</span>
                <CodeAmount value={shop.price} mode="full" className="amt" />
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
                <button type="button" className="ci-buy" onClick={openConfirm}>
                    바로 구매
                </button>
            )}
        </>
    )

    // 구매 확인 / 성공 / 실패 서브뷰(셸 overlay 슬롯).
    const confirmOverlay = step === 'confirm' && (
        <div className="confirm">
            <div className="confirm-box">
                {purchaseMutation.isSuccess ? (
                    <>
                        <div aria-hidden className="icon ok">
                            ✓
                        </div>
                        <h4>구매 완료</h4>
                        <p>
                            <b>{item.nameSnapshot}</b> 을(를) 구매했습니다.
                            <br />
                            아이템은 인벤토리에서 확인하세요.
                        </p>
                        <div className="confirm-price">
                            <span className="k">결제 금액</span>
                            <span className="v">
                                <CodeAmount
                                    value={
                                        purchaseMutation.data?.finalPrice ??
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
                        {errorView.description && <p>{errorView.description}</p>}
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
                            아래 금액으로 즉시 구매됩니다. 게임머니가 바로
                            차감되고
                            <br />
                            아이템은 인벤토리로 들어옵니다.
                        </p>
                        <div className="confirm-price">
                            <span className="k">판매가</span>
                            <span className="v">
                                <CodeAmount value={shop.price} mode="full" />
                            </span>
                        </div>
                        {remainingAfter !== null && (
                            <div className="confirm-price">
                                <span className="k">구매 후 잔액</span>
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
                                {isSubmitting ? '전송 중…' : '구매 확정'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )

    return (
        <CardInfoDialog
            subGroup={item.subGroup}
            kind={item.kind}
            element={item.element}
            level={item.level}
            goldforceExpireAt={item.goldforceExpireAt}
            name={item.nameSnapshot}
            skill1={item.skill1}
            skill2={item.skill2}
            skillPercent={item.skillPercent}
            skill1Name={item.skill1Name}
            skill2Name={item.skill2Name}
            now={now}
            belowScroll={sellerRow}
            footer={footer}
            backgroundInert={step === 'confirm'}
            overlay={confirmOverlay}
            onClose={onClose}
        />
    )
}

export default ShopCardInfoDialog
