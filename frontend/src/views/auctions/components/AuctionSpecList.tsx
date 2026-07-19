import { formatGameMoney } from '@/features/auction/lib/auctionPrice'
import { elementBadgeLabelOf } from '@/features/item/lib/element'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import { goldforceStateOf } from '@/features/item/lib/goldforce'
import { useNow } from '@/features/auction/lib/useNow'
import type { AuctionDetail } from '@/lib/api/auctions'
import type { ReactNode } from 'react'

/**
 * 아이템 스펙 (계약 §3.3 `item` 블록) — FC-064.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`specSnapshot` 이 드디어 쓰인다 — 여기가 그 자리다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * FC-058·FC-059 는 카드라서 한 줄 이름밖에 실을 수 없어 이 필드를 남겨뒀다. 상세는
 * "무엇을 사는가" 를 끝까지 말해야 하는 화면이고, `specSnapshot`(등록 시점 스냅샷, D-045)이
 * 그 문장이다. **코드 사전보다 스냅샷이 우선한다** — 사전은 서버 템플릿이 바뀌면 어긋나지만
 * 스냅샷은 이 매물이 등록될 때의 사실이다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **스킬은 이름을 모른다 — 코드 중립 표기로 폴백한다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `GET /items/{itemInstancePublicId}` 가 스킬 이름을 내리지만 **`AuctionItemView` 에
 * `itemInstancePublicId` 가 없어 링크가 끊겨 있다.** 이름을 얻을 경로가 없으므로 계약 §3.3 이
 * 의무화한 *"사전에 없는 코드는 중립 표기로 폴백"* 을 그대로 따른다 — `스킬 #119` + 수치.
 * **코드→이름 표를 클라에 지어내지 마라**(FC-059 가 같은 이유로 스킬 필터를 만들지 않았다).
 *
 * ★ 마법(`subGroup=3`)은 **구조적으로** `skill1` 이 없다(계약 §3.3). 빈 슬롯을
 *   "없음" 으로 적으면 결함처럼 읽히므로 **줄 자체를 내지 않는다.**
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **즉시구매가는 정보 표기다. 버튼이 아니다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `POST /auctions/{id}/purchase` 는 계약 §3.1 에 완전 명세돼 있으나 **백엔드에 매핑이 없다**
 * (404). 여기에 값을 적되 누를 것을 만들지 않는다.
 */

interface AuctionSpecListProps {
    auction: AuctionDetail
}

interface SpecRow {
    label: string
    value: ReactNode
}

/** `스킬 #119 · 18%` — 이름이 없어도 **무엇이 얼마나** 는 전달된다. */
function skillRowsOf(auction: AuctionDetail): SpecRow[] {
    const { item } = auction
    const codes = [item.skill1, item.skill2].filter(
        (code): code is number => code !== null,
    )

    return codes.map((code, index) => ({
        label: `스킬 ${index + 1}`,
        // `skillPercent` 는 정수이며 항상 존재한다(계약 §3.3).
        value: `스킬 #${code} · ${item.skillPercent}%`,
    }))
}

const AuctionSpecList = ({ auction }: AuctionSpecListProps) => {
    const now = useNow()
    const { item } = auction
    const goldforce = goldforceStateOf(item.goldforceExpireAt, now)

    const rows: SpecRow[] = [
        { label: '종류', value: itemTypeLabel(item.subGroup, item.kind) },
        { label: '속성', value: elementBadgeLabelOf(item.element) },
        { label: '레벨', value: `Lv.${item.level}` },
        ...skillRowsOf(auction),
        {
            label: '골드포스',
            /*
             * ★ '만료' 와 '미적용' 을 구분해 적는다 — `goldforce.ts` 가 세 상태를 나눠 둔 이유가
             *   상세의 이 줄이다. 만료는 "한때 있었다" 는 뜻이라 시세 판단에 쓰이는 정보다.
             */
            value:
                goldforce === 'active'
                    ? '적용 중'
                    : goldforce === 'expired'
                      ? '만료됨'
                      : '미적용',
        },
        { label: '시작가', value: `${formatGameMoney(auction.startPrice)} GM` },
        ...(auction.buyNowPrice !== null
            ? [
                  {
                      label: '즉시구매가',
                      value: `${formatGameMoney(auction.buyNowPrice)} GM`,
                  },
              ]
            : []),
        { label: '판매자', value: auction.sellerNickname },
    ]

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {item.specSnapshot && (
                <p
                    className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
                    data-testid="auction-spec-snapshot"
                >
                    {item.specSnapshot}
                </p>
            )}

            {/*
             * ★ `<dl>` 이다 — 라벨과 값의 쌍이라는 관계가 마크업에 있다. div 두 개로 그리면
             *   스크린리더는 글자 나열만 듣고 무엇의 값인지 모른다.
             * ★ **`grid-cols-[auto_1fr]`** — 라벨 열은 내용만큼만, 값이 남은 폭을 전부 쓴다.
             *   고정 폭을 주면 320px 에서 값이 눌려 두 줄로 접힌다.
             */}
            <dl
                className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"
                data-testid="auction-spec-list"
            >
                {rows.map((row) => (
                    <div key={row.label} className="contents">
                        <dt className="text-gray-500 dark:text-gray-400">
                            {row.label}
                        </dt>
                        <dd className="min-w-0 break-words font-semibold text-gray-900 dark:text-gray-100">
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

export default AuctionSpecList
