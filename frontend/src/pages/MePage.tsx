import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
    TbAlertTriangle,
    TbChevronRight,
    TbReceipt,
    TbUserCircle,
} from 'react-icons/tb'
import { paths } from '@/app/paths'
import ProfileCard from '@/features/member/components/ProfileCard'
import VerificationCard from '@/features/member/components/VerificationCard'
import WalletSummaryCard from '@/features/member/components/WalletSummaryCard'
import WithdrawDialog from '@/features/member/components/WithdrawDialog'
import MyShopsSection from '@/features/shop/components/MyShopsSection'
import {
    useMe,
    useUpdateNickname,
    useUpdateProfile,
    useWithdraw,
} from '@/lib/queries/me'
import { useMyBalance } from '@/lib/queries/balance'
import { resetSessionState } from '@/lib/api/session'
import PageIntro from '@/components/common/PageIntro'

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
    const queryClient = useQueryClient()

    const meQuery = useMe()
    const balanceQuery = useMyBalance()
    const nicknameMutation = useUpdateNickname()
    const profileMutation = useUpdateProfile()
    const withdrawMutation = useWithdraw()
    const [withdrawOpen, setWithdrawOpen] = useState(false)

    const openWithdraw = () => {
        withdrawMutation.reset()
        setWithdrawOpen(true)
    }

    const handleWithdraw = () => {
        withdrawMutation.mutate(undefined, {
            onSuccess: () => {
                // 서버가 이미 세션을 폐기했다 — 로컬 세션·캐시(잔액·인벤토리 등 전역키)까지
                // 원자적으로 비우고 공개 홈으로 나간다(FC-174, spec §3.3).
                // ★ React 핸들러이므로 캐시는 컨텍스트 클라이언트(`useQueryClient()`)로 축출한다
                //   (AuthProvider 와 동일 배선, spec §4.3-a). 프로덕션은 App 이 싱글턴을 주입해
                //   동일 인스턴스이지만, 이 경로가 원칙과 일치하고 테스트로 캐시 축출을 단언할 수 있다.
                resetSessionState()
                queryClient.clear()
                navigate(paths.home, { replace: true })
            },
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <PageIntro
                icon={TbUserCircle}
                eyebrow="MY ACCOUNT"
                title="마이페이지"
                description="계정 정보와 자산, 거래 활동을 한 곳에서 관리하세요."
            />

            {meQuery.isPending ? (
                <MeSkeleton />
            ) : meQuery.isError || !meQuery.data ? (
                <section className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-content-line bg-content-surface px-6 py-16 text-center">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-content-soft text-content-subtle">
                        <TbAlertTriangle aria-hidden className="size-7" />
                    </span>
                    <h2 className="mt-4 text-lg font-bold text-content-fg">
                        프로필을 불러오지 못했습니다
                    </h2>
                    <p className="mt-1 text-sm text-content-subtle">
                        잠시 후 다시 시도해 주세요.
                    </p>
                    <button
                        type="button"
                        className="mt-5 rounded-lg bg-brand-structure px-4 py-2 text-sm font-bold text-on-strong hover:bg-chrome-raised"
                        onClick={() => void meQuery.refetch()}
                    >
                        다시 시도
                    </button>
                </section>
            ) : (
                <>
                    <ProfileCard
                        characterSaveError={profileMutation.error}
                        characterSavePending={profileMutation.isPending}
                        profile={meQuery.data}
                        saveError={nicknameMutation.error}
                        savePending={nicknameMutation.isPending}
                        onSaveCharacter={(primaryCharacterId) =>
                            profileMutation.mutate({ primaryCharacterId })
                        }
                        onSaveNickname={(nickname) =>
                            nicknameMutation.mutate(nickname)
                        }
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <VerificationCard profile={meQuery.data} />
                        <WalletSummaryCard
                            balance={balanceQuery.data}
                            isLoading={balanceQuery.isPending}
                            isError={balanceQuery.isError}
                        />
                    </div>

                    {/* 내 판매 — 진행 중 고정가 리스팅 + 내리기 (FC-096) */}
                    <MyShopsSection />

                    {/* 거래 내역 진입점 (FC-090 실연동) */}
                    <Link
                        to={paths.orders}
                        className="flex items-center gap-3 rounded-2xl border border-content-line bg-content-surface p-5 hover:border-brand-structure sm:p-6"
                    >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-structure text-brand-highlight-bright">
                            <TbReceipt aria-hidden className="size-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-base font-bold text-content-fg">
                                거래 내역
                            </span>
                            <span className="block text-xs text-content-subtle">
                                구매·판매한 거래를 확인하세요.
                            </span>
                        </span>
                        <TbChevronRight
                            aria-hidden
                            className="ms-auto size-5 shrink-0 text-content-subtle"
                        />
                    </Link>

                    {/* 위험 구역 — 회원 탈퇴 */}
                    <section
                        data-withdraw-zone
                        className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                    >
                        <div>
                            <h3 className="text-base font-bold text-content-fg">
                                회원 탈퇴
                            </h3>
                            <p className="mt-1 text-sm text-content-muted">
                                잔액과 계정 정보가 소멸하며 복구할 수 없습니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            data-page-action="danger"
                            className="app-page-action shrink-0 rounded-lg border border-danger bg-content-surface px-4 py-2.5 text-sm font-bold text-danger-ink hover:bg-danger-soft"
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
            <div className="h-28 animate-pulse rounded-2xl bg-content-soft" />
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-44 animate-pulse rounded-2xl bg-content-soft" />
                <div className="h-44 animate-pulse rounded-2xl bg-content-soft" />
            </div>
        </div>
    )
}
