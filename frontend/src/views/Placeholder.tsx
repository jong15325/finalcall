import { useParams } from 'react-router'

/**
 * 라우팅 골격 자리표시자 (FC-055).
 *
 * ★ **화면이 아니다.** 이 티켓의 DoD 는 "라우팅 골격이 우리 경로와 맞물린다(화면 내용은 비어
 * 있어도 된다)"이며, 실제 화면은 FC-057~062 가 만든다. 여기에 레이아웃·카피·컴포넌트를
 * 쌓지 마라 — 쌓는 순간 셸 확정(FC-057) 전에 디자인이 굳는다.
 *
 * 경로 파라미터를 그대로 노출해 `:auctionPublicId` 같은 동적 세그먼트가 실제로 잡히는지를
 * 눈으로 확인할 수 있게 한다(골격 검증용).
 */
const Placeholder = ({ title }: { title?: string }) => {
    const params = useParams()
    const paramEntries = Object.entries(params)

    return (
        <div className="p-6">
            <h3 className="mb-2">{title ?? '준비 중'}</h3>
            <p className="text-gray-500">
                FC-055 라우팅 골격 — 화면은 후속 티켓(FC-057~062)에서 만든다.
            </p>
            {paramEntries.length > 0 && (
                <dl className="mt-4 text-sm">
                    {paramEntries.map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                            <dt className="text-gray-500">{key}</dt>
                            <dd className="font-semibold">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    )
}

export default Placeholder
