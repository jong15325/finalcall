import CodeAmount from '@/components/common/CodeAmount'
import {
    FEE_BRACKETS,
    computeSellerFee,
} from '@/features/auction/lib/sellerFee'

/**
 * 판매 수수료 **예상** 블록 (FC-073 — 목업 `sellerFeeBlock` · fee-policy-spec v1.0).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **예상치임을 화면이 반드시 밝힌다.** 실제 수수료는 낙찰가 기준으로 정산 시 서버가
 *    확정한다(fee-policy-spec §3·§7, HANDOVER §16). 시작가가 낙찰가와 다르면 값도 달라진다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 목업 `sellerFeeBlock` DOM(안내표 + 시작가/예상수수료/정산예상 박스)을 1:1 옮기되, 금액은
 * `G` 텍스트 단위 대신 `CodeAmount`(mode=full, 거래 확정 맥락)로 표기한다(§3.1). 색은 브랜드 토큰.
 */
interface SellFeeEstimateProps {
    /** 시작가(정수). 미입력·0 이면 예상값 0 으로 흐른다 */
    startPrice: number
}

function SellFeeEstimate({ startPrice }: SellFeeEstimateProps) {
    const { fee, settle } = computeSellerFee(startPrice)

    return (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
                <h6 className="text-sm font-bold text-gray-900">
                    판매 수수료 안내
                </h6>
                <span className="rounded-full bg-orange-subtle px-2 py-0.5 text-[10px] font-bold text-orange-deep">
                    예상 · 정산 시 서버 확정
                </span>
            </div>

            <ul className="mt-2.5 flex flex-col gap-1">
                {FEE_BRACKETS.map((bracket) => (
                    <li
                        key={bracket.range}
                        className="flex items-center justify-between text-xs"
                    >
                        <span className="text-gray-500">{bracket.range}</span>
                        <strong className="font-semibold text-gray-700">
                            {bracket.rate}
                        </strong>
                    </li>
                ))}
            </ul>

            <dl className="mt-3 rounded-lg border border-line bg-surface-sunken p-3 text-sm">
                <div className="flex items-center justify-between">
                    <dt className="text-gray-500">시작가</dt>
                    <dd>
                        <CodeAmount
                            value={startPrice > 0 ? startPrice : null}
                            mode="full"
                            className="font-semibold text-gray-900"
                        />
                    </dd>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                    <dt className="text-gray-500">예상 수수료</dt>
                    <dd>
                        <CodeAmount
                            value={startPrice > 0 ? fee : null}
                            mode="full"
                            className="font-semibold text-danger"
                        />
                    </dd>
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
                    <dt className="font-medium text-gray-700">정산 예상</dt>
                    <dd>
                        <CodeAmount
                            value={startPrice > 0 ? settle : null}
                            mode="full"
                            className="font-bold text-gray-900"
                        />
                    </dd>
                </div>
            </dl>

            <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                구매자 수수료는 없습니다. 판매 수수료는 낙찰가 구간별로 정산 시
                차감됩니다.
            </p>
        </div>
    )
}

export default SellFeeEstimate
