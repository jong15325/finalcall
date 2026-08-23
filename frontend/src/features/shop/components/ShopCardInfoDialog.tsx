import { useState } from 'react'
import { Link } from 'react-router'
import AppModal from '@/components/common/AppModal'
import AppModalButton from '@/components/common/AppModalButton'
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
 * ★ **구매 확인 서브뷰**는 별도 공통 `AppModal`을 중첩한다. 확인창이 뜨면 부모 카드정보를
 *   `inert` 처리하고, 공통 모달 스택이 최상단 초점·Escape·스크롤 잠금을 관리한다.
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
    const purchaseMutation = usePurchaseShop(shop.shopPublicId)
    /** 'info' = 카드정보 · 'confirm' = 구매 확인/성공/실패 서브뷰 */
    const [step, setStep] = useState<'info' | 'confirm'>('info')

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
                <AppModalButton
                    disabled
                    type="button"
                    variant="primary"
                    className="ci-buy"
                >
                    {shopStatusLabelOf(shop.status)}
                </AppModalButton>
            ) : isOwn ? (
                <AppModalButton
                    disabled
                    type="button"
                    variant="primary"
                    className="ci-buy"
                >
                    내 상품입니다
                </AppModalButton>
            ) : !isAuthed ? (
                <Link
                    to={loginHref}
                    className="app-modal-button ci-buy"
                    data-modal-button="primary"
                >
                    로그인하고 구매
                </Link>
            ) : (
                <AppModalButton
                    type="button"
                    variant="primary"
                    className="ci-buy"
                    onClick={openConfirm}
                >
                    바로 구매
                </AppModalButton>
            )}
        </>
    )

    return (
        <>
            <CardInfoDialog
                cardInfo={item.cardInfo}
                subGroup={item.subGroup}
                kind={item.kind}
                element={item.element}
                level={item.level}
                belowScroll={sellerRow}
                footer={footer}
                backgroundInert={step === 'confirm'}
                onClose={onClose}
            />
            <AppModal
                open={step === 'confirm'}
                role="alertdialog"
                size="sm"
                title={
                    purchaseMutation.isSuccess
                        ? '구매 완료'
                        : errorView
                          ? errorView.title
                          : item.cardInfo.formalName
                }
                eyebrow="아이템 마켓"
                closeDisabled={isSubmitting}
                actions={
                    purchaseMutation.isSuccess
                        ? [
                              {
                                  id: 'done',
                                  label: '확인',
                                  variant: 'primary',
                                  autoFocus: true,
                                  onClick: onClose,
                              },
                          ]
                        : errorView
                          ? [
                                {
                                    id: 'back',
                                    label: '돌아가기',
                                    variant: 'primary',
                                    autoFocus: true,
                                    onClick: backToInfo,
                                },
                            ]
                          : [
                                {
                                    id: 'cancel',
                                    label: '취소',
                                    variant: 'secondary',
                                    disabled: isSubmitting,
                                    onClick: backToInfo,
                                },
                                {
                                    id: 'confirm',
                                    label: '구매 확정',
                                    pendingLabel: '전송 중…',
                                    variant: 'primary',
                                    pending: isSubmitting,
                                    autoFocus: true,
                                    onClick: handlePurchase,
                                },
                            ]
                }
                onClose={
                    purchaseMutation.isSuccess || errorView
                        ? onClose
                        : backToInfo
                }
            >
                {purchaseMutation.isSuccess ? (
                    <div className="space-y-4 text-sm text-content-muted">
                        <p>
                            <b className="text-content-fg">
                                {item.cardInfo.formalName}
                            </b>{' '}
                            을(를) 구매했습니다. 아이템은 인벤토리에서
                            확인하세요.
                        </p>
                        <div className="flex items-center justify-between rounded-xl bg-content-soft p-4">
                            <span>결제 금액</span>
                            <CodeAmount
                                value={
                                    purchaseMutation.data?.finalPrice ??
                                    shop.price
                                }
                                mode="full"
                                className="font-bold text-content-fg"
                            />
                        </div>
                    </div>
                ) : errorView ? (
                    <p role="alert" className="text-sm text-danger-ink">
                        {errorView.description ??
                            '구매를 완료하지 못했습니다. 다시 확인해 주세요.'}
                    </p>
                ) : (
                    <div className="space-y-4 text-sm text-content-muted">
                        <p>
                            아래 금액으로 즉시 구매됩니다. 게임머니가 바로
                            차감되고 아이템은 인벤토리로 들어옵니다.
                        </p>
                        <dl className="space-y-2 rounded-xl bg-content-soft p-4">
                            <div className="flex items-center justify-between">
                                <dt>판매가</dt>
                                <dd>
                                    <CodeAmount
                                        value={shop.price}
                                        mode="full"
                                        className="font-bold text-content-fg"
                                    />
                                </dd>
                            </div>
                            {remainingAfter !== null && (
                                <div className="flex items-center justify-between">
                                    <dt>구매 후 잔액</dt>
                                    <dd>
                                        <CodeAmount
                                            value={remainingAfter}
                                            mode="full"
                                            className={
                                                remainingAfter < 0
                                                    ? 'font-bold text-danger-ink'
                                                    : 'font-bold text-content-fg'
                                            }
                                        />
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                )}
            </AppModal>
        </>
    )
}

export default ShopCardInfoDialog
