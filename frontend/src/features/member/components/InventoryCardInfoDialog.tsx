import CardInfoDialog from '@/features/item/components/CardInfoDialog'
import { decodeTypeCode } from '@/features/item/lib/itemCode'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 카드정보 모달 — **아이템 마켓 `ShopCardInfoDialog` 와 동일 셸**(FC-178 · 승인 목업
 * `sell-flow-mockup.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **셸(`CardInfoDialog`) 소비자**다(EPIC-CARD-SYSTEM T4). 헤더·썸네일·속성표·특수스킬·모달
 *   배선은 셸이 소유하므로 마켓과 픽셀 단위로 같은 톤이다(과거 `ShopCardInfoDialog.css` 손복사
 *   포크 → 셸 공유로 대체, member→shop 교차 임포트 제거).
 * ★ 마켓과 다른 점: **판매자 행·판매가·구매확인 서브뷰가 없고**, 하단 CTA 가 **'판매 등록'** 이다
 *   (내 보유 아이템 → 마켓에 올린다). 클릭 시 부모가 `/sell?item=<itemInstancePublicId>` 로 이동한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **데이터 매핑**: 요약(`summary`)은 4축을 `typeCode` 로 싣는다(계약 §4.2) → `decodeTypeCode` 로
 *   분해해 셸에 축 props 로 넘긴다. 채널제한·속성·골드포스 등 파생은 셸이 한다. **스킬명(skill1Name/
 *   skill2Name)은 계약 v1.21(FC-179) 델타로 요약에 실린다** → 그대로 넘겨 모달 스킬 섹션이 실제
 *   이름을 표시한다(마켓과 동일 배선). 이름이 null 이면 셸이 코드 폴백(`스킬 #코드`)한다.
 */

interface InventoryCardInfoDialogProps {
    item: InventoryItem
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
    /** 판매 등록 — 부모가 `/sell?item=<itemInstancePublicId>` 로 이동한다. */
    onSell: (item: InventoryItem) => void
    onClose: () => void
}

function InventoryCardInfoDialog({
    item,
    now,
    onSell,
    onClose,
}: InventoryCardInfoDialogProps) {
    const { summary } = item
    const axes = decodeTypeCode(summary.typeCode)

    // 하단 액션: 안내 + '판매 등록'(판매자·판매가·구매확인 없음).
    const footer = (
        <>
            <p className="min-w-0 text-[13px] font-medium leading-snug text-gray-500">
                내 인벤토리 아이템입니다. 판매 등록으로 마켓에 올려보세요.
            </p>
            <button
                type="button"
                className="ci-buy"
                onClick={() => onSell(item)}
            >
                판매 등록
            </button>
        </>
    )

    return (
        <CardInfoDialog
            subGroup={axes.subGroup}
            kind={axes.kind}
            element={axes.element}
            level={summary.level}
            goldforceExpireAt={summary.goldforceExpireAt}
            name={summary.displayName}
            skill1={summary.skill1Code}
            skill2={summary.skill2Code}
            skill1Name={summary.skill1Name}
            skill2Name={summary.skill2Name}
            skillPercent={summary.skillPercent}
            now={now}
            footer={footer}
            onClose={onClose}
        />
    )
}

export default InventoryCardInfoDialog
