import { useState } from 'react'
import { useNavigate } from 'react-router'
import { TbAlertTriangle } from 'react-icons/tb'
import { paths } from '@/app/paths'
import ProfileCard from '@/features/member/components/ProfileCard'
import VerificationCard from '@/features/member/components/VerificationCard'
import WalletSummaryCard from '@/features/member/components/WalletSummaryCard'
import WithdrawDialog from '@/features/member/components/WithdrawDialog'
import { useMe, useUpdateNickname, useWithdraw } from '@/lib/queries/me'
import { useMyBalance } from '@/lib/queries/balance'
import { useAuthStore } from '@/store/authStore'

/**
 * 마이페이지 통합 홈 `/me` (FC-074 — 목업 accountHub('profile')=accountOverview · design-brief B-7).
 *
 * ★ **상단 탭 없음**(HANDOVER §13) — 프로필 카드 우측 액션 버튼이 인벤토리·임시보관 라우트로 링크.
 * ★ 실연동은 **계약이 준 것만**: `GET /me`(프로필 4필드) · `GET /me/balance`(잔액) ·
 *   `PATCH /me`(닉네임) · `DELETE /me`(탈퇴). 목업의 레벨·서버·거래건수·인증완료·충전은 드롭/자리보류.
 * ★ 탈퇴 성공 = 서버가 세션 전부 폐기(복구 불가, D-080) → 로컬 세션 정리 후 홈 이동.
 */
export default function MePage() {
    const navigate = useNavigate()
    const clearSession = useAuthStore((state) => state.clearSession)

    const meQuery = useMe()
    const balanceQuery = useMyBalance()
    const nicknameMutation = useUpdateNickname()
    const withdrawMutation = useWithdraw()

    const [withdrawOpen, setWithdrawOpen] = useState(false)

    const openWithdraw = () => {
        withdrawMutation.reset()
        setWithdrawOpen(true)
    }

    const handleWithdraw = () => {
        withdrawMutation.mutate(undefined, {
            onSuccess: () => {
                // 서버가 이미 세션을 폐기했다 — 로컬도 비우고 공개 홈으로 나간다.
                clearSession()
                navigate(paths.home, { replace: true })
            },
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>
                <p className="mt-1 text-sm text-gray-500">
                    계정 정보와 자산을 한 곳에서 관리하세요.
                </p>
            </header>

            {meQuery.isPending ? (
                <MeSkeleton />
            ) : meQuery.isError || !meQuery.data ? (
                <section className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                        <TbAlertTriangle aria-hidden className="size-7" />
                    </span>
                    <h2 className="mt-4 text-lg font-bold text-gray-900">
                        프로필을 불러오지 못했습니다
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        잠시 후 다시 시도해 주세요.
                    </p>
                    <button
                        type="button"
                        className="mt-5 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                        onClick={() => void meQuery.refetch()}
                    >
                        다시 시도
                    </button>
                </section>
            ) : (
                <>
                    <ProfileCard
                        profile={meQuery.data}
                        savePending={nicknameMutation.isPending}
                        saveError={nicknameMutation.error}
                        onSaveNickname={(nickname) =>
                            nicknameMutation.mutate(nickname)
                        }
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <VerificationCard />
                        <WalletSummaryCard
                            balance={balanceQuery.data}
                            isLoading={balanceQuery.isPending}
                            isError={balanceQuery.isError}
                        />
                    </div>

                    {/* 위험 구역 — 회원 탈퇴 */}
                    <section className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger-subtle/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">
                                회원 탈퇴
                            </h3>
                            <p className="mt-1 text-sm text-gray-600">
                                잔액과 계정 정보가 소멸하며 복구할 수 없습니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="shrink-0 rounded-lg border border-danger bg-surface px-4 py-2.5 text-sm font-bold text-danger hover:bg-danger-subtle"
                            onClick={openWithdraw}
                        >
                            탈퇴하기
                        </button>
                    </section>
                </>
            )}

            <WithdrawDialog
                open={withdrawOpen}
                isSubmitting={withdrawMutation.isPending}
                submitError={withdrawMutation.error}
                onClose={() => setWithdrawOpen(false)}
                onConfirm={handleWithdraw}
            />
        </div>
    )
}

/** 프로필 스켈레톤 — 영역만(전체 블러 금지). */
function MeSkeleton() {
    return (
        <div aria-hidden className="flex flex-col gap-4">
            <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-44 animate-pulse rounded-2xl bg-gray-100" />
                <div className="h-44 animate-pulse rounded-2xl bg-gray-100" />
            </div>
        </div>
    )
}
