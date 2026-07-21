import { TbDeviceMobile, TbMail, TbShieldCheck } from 'react-icons/tb'

/**
 * 본인 인증 카드 (FC-074 — 목업 `.account-status-card`) — **준비 중 자리**.
 *
 * ★ 이메일·휴대폰 본인 인증 **백엔드 미구현**(rebuild-contract-map §5) → 목업의 "인증 완료"·
 *   진행률 100% 는 **하드코딩 금지**. 구조는 유지하되 상태는 "준비 중"으로 자리보류하고,
 *   섹션에 `aria-disabled` 를 실어 보조기술에도 비활성으로 전달한다(WCAG 4.1.2).
 * ★ 발송/확인 버튼은 만들지 않는다 — 클릭 시 404 나는 경로를 그리지 않는다(FC-048).
 */

const CHECKS = [
    { icon: TbMail, label: '이메일 인증' },
    { icon: TbDeviceMobile, label: '휴대폰 인증' },
] as const

function VerificationCard() {
    return (
        <section
            aria-disabled="true"
            className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6"
        >
            <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                    <TbShieldCheck aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900">
                        본인 인증
                    </h3>
                    <p className="text-xs text-gray-500">
                        안전한 거래를 위한 인증 상태
                    </p>
                </div>
                <span className="ms-auto rounded-full bg-gold-subtle px-2.5 py-0.5 text-xs font-bold text-gold-deep">
                    준비 중
                </span>
            </div>

            <ul className="mt-4 flex flex-col gap-2">
                {CHECKS.map(({ icon: Icon, label }) => (
                    <li
                        key={label}
                        className="flex items-center justify-between rounded-lg bg-surface-sunken px-3.5 py-2.5 text-sm"
                    >
                        <span className="flex items-center gap-2 text-gray-600">
                            <Icon
                                aria-hidden
                                className="size-4 text-gray-400"
                            />
                            {label}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">
                            준비 중
                        </span>
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-xs text-gray-400">
                본인 인증은 준비 중입니다. 연결되면 이 자리에서 진행 상태를
                확인할 수 있습니다.
            </p>
        </section>
    )
}

export default VerificationCard
