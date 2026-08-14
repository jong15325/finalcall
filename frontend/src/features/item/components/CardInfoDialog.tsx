import { useEffect, useRef, type ReactNode } from 'react'
import { TbId, TbX } from 'react-icons/tb'
import CardInfoContent from './CardInfoContent'
import './CardInfoDialog.css'

/**
 * 카드정보 모달 **셸 정본** (EPIC-CARD-SYSTEM T4 · 제안 §2.2·§3 단계2).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **카드정보 모달의 chrome·배선을 한 곳으로.** 마켓(`ShopCardInfoDialog`)·인벤토리
 *   (`InventoryCardInfoDialog`)가 헤더·썸네일·속성표·특수스킬 + 모달 배선(초점트랩·스크롤락·
 *   Esc·backdrop·role=dialog)을 ~50줄 복붙 포크했다(제안 §1.4). 셸은 그 공통 표면과 배선을
 *   **정본으로 소유**하고, feature 고유 부분은 슬롯으로 소비자가 주입한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **슬롯 seam**(제안 §2.4 — 과설계 경계):
 *   - `belowScroll` : 특수스킬 아래(스크롤 영역 내) 추가 행 — 마켓 판매자 행 등.
 *   - `footer`      : 하단 액션(`.ci-foot`) 내용 — 판매가+구매 CTA / 판매 등록 CTA 등.
 *   - `overlay`     : 다이얼로그 내부 오버레이 — 마켓 구매 확인/성공/실패 서브뷰.
 *   - `backgroundInert` : 오버레이가 뜰 때 배경(제목·본문·푸터)을 `inert` 처리(초점 누출 차단).
 *   **구매 뮤테이션·잔액·isOwn 등 feature 결합은 셸에 올리지 않는다** — 소비자가 슬롯에 주입한다
 *   (FC-178 포크 사유를 슬롯 seam 으로 해소, 제안 §2.4).
 * ★ **속성표/스킬은 셸이 아이템 데이터(축)로 직접 렌더**한다 — 소비자는 도메인 shape 를 축 props 로
 *   매핑만 한다(마켓=`item` 필드, 인벤토리=`decodeTypeCode` 결과). 파생(프레임·채널제한·속성·골드
 *   포스·아트·스킬)은 셸이 한 번만 계산해 복붙 파생을 없앤다.
 * ★ **모달 배선**은 `ShopCardInfoDialog` 원본에서 그대로 이식했다 — 열릴 때만 마운트되므로 초기화
 *   effect 의존은 마운트(`[]`)뿐(부모 리렌더가 초점을 강탈하지 않음). 초점 트랩은 `[inert]` 하위와
 *   `disabled` 를 건너뛰어 오버레이 서브뷰로도 초점이 새지 않는다.
 */

interface CardInfoDialogProps {
    /** 4축(마켓=item 필드, 인벤토리=decodeTypeCode). 속성표·아트 파생 입력. */
    subGroup: number
    kind: number
    element: number
    level: number
    /** 골드포스 만료(ISO) — 프레임/남은일수/썸네일 파생. */
    goldforceExpireAt: string | null
    /** 명칭(속성표·썸네일 alt). 마켓=nameSnapshot · 인벤토리=displayName. */
    name: string
    /** 특수스킬 슬롯 코드(1·2)와 % — resolveSkillSlots 입력. */
    skill1: number | null
    skill2: number | null
    skillPercent: number
    /** 스킬명(인스턴스 상세만 보유 — 마켓). 없으면 중립 표기(`스킬 #코드`)로 폴백. */
    skill1Name?: string | null
    skill2Name?: string | null
    /** 골드포스·프레임 파생 기준 시각. 미주입이면 Date.now(). */
    now?: number
    /** 특수스킬 아래(스크롤 영역 내) 추가 행 — 마켓 판매자 행 등. */
    belowScroll?: ReactNode
    /** 하단 액션 영역(`.ci-foot`) 내용 — 가격+CTA / 판매 등록 CTA 등 소비자 주입. */
    footer: ReactNode
    /** 배경(제목·본문·푸터) inert — 오버레이 서브뷰 활성 시 초점 누출 차단. */
    backgroundInert?: boolean
    /** 다이얼로그 내부 오버레이(구매 확인/성공/실패 서브뷰 등). */
    overlay?: ReactNode
    onClose: () => void
}

function CardInfoDialog({
    subGroup,
    kind,
    element,
    level,
    goldforceExpireAt,
    name,
    skill1,
    skill2,
    skillPercent,
    skill1Name,
    skill2Name,
    now,
    belowScroll,
    footer,
    backgroundInert = false,
    overlay,
    onClose,
}: CardInfoDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    /** 최신 onClose — effect 의존에서 빼기 위한 콜백 ref */
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    // ── 초점 트랩 · 스크롤 잠금 · Esc(원본 ShopCardInfoDialog 이식) ────────────────
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
                aria-labelledby="cardInfoTitle"
                className="shop-cardinfo"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="ci-title" inert={backgroundInert}>
                    <span aria-hidden className="ci-mark">
                        <TbId className="size-[18px]" />
                    </span>
                    <h2 id="cardInfoTitle">
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
                    <CardInfoContent
                        {...{
                            subGroup,
                            kind,
                            element,
                            level,
                            goldforceExpireAt,
                            name,
                            skill1,
                            skill2,
                            skillPercent,
                            skill1Name,
                            skill2Name,
                            now,
                        }}
                    />

                    {belowScroll}
                </div>

                {/* 하단 액션 영역 — 소비자 주입(가격+구매 CTA / 판매 등록 CTA 등) */}
                <div className="ci-foot" inert={backgroundInert}>
                    {footer}
                </div>

                {/* 다이얼로그 내부 오버레이(구매 확인/성공/실패 서브뷰 등) */}
                {overlay}
            </div>
        </div>
    )
}

export default CardInfoDialog
