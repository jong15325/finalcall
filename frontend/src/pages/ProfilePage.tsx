import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useLogout } from '@/features/auth/api/useAuth';
import { NicknameDialog } from '@/features/member/components/NicknameDialog';
import { WithdrawDialog } from '@/features/member/components/WithdrawDialog';
import { useMe } from '@/features/member/api/useMember';
import { BalanceCard } from '@/features/wallet/components/BalanceCard';
import { ROUTES } from '@/routes/paths';

/** Instant(UTC) ISO → 로컬 표시. 파싱 실패 시 원문 유지. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ko-KR');
}

/**
 * 마이페이지 (`/me/profile`, ProtectedLayout). FC-014 + FC-015.
 * 3블록: 프로필(GET /me·닉네임 수정) · 잔액 카드(GET /me/balance) · 계정(로그아웃·탈퇴).
 * COMMON_005/401 은 client.ts 가 삼켜 clearSession → ProtectedLayout 이 로그인 리다이렉트(특정 카피 없음).
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const { data: me, isLoading, isError, error, refetch } = useMe();
  const logout = useLogout();

  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [nicknameUpdated, setNicknameUpdated] = useState(false);

  const onLogout = (): void => {
    logout.mutate(undefined, {
      onSettled: () => navigate(ROUTES.home, { replace: true }),
    });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">마이페이지</h1>

      {/* 프로필 블록 */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-text">프로필</h2>
          {me ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNicknameUpdated(false);
                setNicknameOpen(true);
              }}
            >
              닉네임 수정
            </Button>
          ) : null}
        </div>

        {nicknameUpdated ? <Alert tone="success">닉네임이 변경되었습니다.</Alert> : null}

        {isLoading ? (
          <LoadingState label="프로필 불러오는 중" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : me ? (
          <dl className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-text-muted">닉네임</dt>
              <dd className="flex items-center gap-2 text-base font-medium text-text">
                {me.nickname}
                {me.isAdmin ? (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                    관리자
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-text-muted">회원 ID</dt>
              <dd className="font-num text-sm text-text-subtle">{me.userPublicId}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-text-muted">가입일</dt>
              <dd className="text-sm text-text-subtle">{formatDate(me.createdAt)}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      {/* 잔액 카드 (FC-015) */}
      <BalanceCard />

      {/* 계정 블록 */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold text-text">계정</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">로그아웃</p>
            <p className="text-sm text-text-subtle">현재 기기에서 로그아웃합니다.</p>
          </div>
          <Button variant="outline" onClick={onLogout} isLoading={logout.isPending}>
            로그아웃
          </Button>
        </div>
        <hr className="border-border" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">회원 탈퇴</p>
            <p className="text-sm text-text-subtle">
              탈퇴 시 잔여 자산이 소멸하며 복구되지 않습니다.
            </p>
          </div>
          <Button variant="danger" onClick={() => setWithdrawOpen(true)}>
            회원 탈퇴
          </Button>
        </div>
      </section>

      {me ? (
        <NicknameDialog
          open={nicknameOpen}
          currentNickname={me.nickname}
          onClose={() => setNicknameOpen(false)}
          onUpdated={() => {
            setNicknameOpen(false);
            setNicknameUpdated(true);
          }}
        />
      ) : null}

      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onWithdrawn={() => navigate(ROUTES.home, { replace: true })}
      />
    </div>
  );
}
