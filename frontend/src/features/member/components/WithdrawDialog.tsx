import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { useBalance } from '@/features/wallet/api/useWallet';
import { hasErrorCode } from '@/lib/api/errors';
import { ERROR_CODES } from '@/types/errorCodes';
import { useWithdraw } from '../api/useMember';

/**
 * 탈퇴 확인 다이얼로그 (spec §3.3 C · 디자인 게이트: Modal). D-080 4요소:
 * 1) 잔존 잔액 표시(useBalance 재사용) 2) 소멸·복구 불가 경고(danger)
 * 3) 명시 동의 Checkbox(미체크 시 버튼 disabled + 비활성 사유 병기) 4) MEMBER_002 차단 안내.
 * DELETE /me → 204 → clearSession + queryClient.clear(훅) → 부모가 홈 이동.
 */
interface WithdrawDialogProps {
  open: boolean;
  onClose: () => void;
  onWithdrawn: () => void;
}

const WARNING_ID = 'withdraw-forfeit-warning';

export function WithdrawDialog({ open, onClose, onWithdrawn }: WithdrawDialogProps) {
  const balance = useBalance();
  const withdraw = useWithdraw();
  const [acknowledged, setAcknowledged] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // 열릴 때마다 상태 초기화
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setAcknowledged(false);
      setBlockedMessage(null);
      setFormError(null);
    }
  }

  const onConfirm = (): void => {
    setBlockedMessage(null);
    setFormError(null);
    withdraw.mutate(undefined, {
      onSuccess: () => onWithdrawn(),
      onError: (error) => {
        if (hasErrorCode(error, ERROR_CODES.MEMBER_002)) {
          setBlockedMessage(
            '진행 중인 거래(경매·입찰·주문)가 있어 탈퇴할 수 없습니다. 거래를 정리한 뒤 다시 시도하세요.',
          );
          return;
        }
        setFormError(error instanceof Error ? error.message : '탈퇴 처리에 실패했습니다.');
      },
    });
  };

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={onClose}>
        취소
      </Button>
      <Button
        type="button"
        variant="danger"
        onClick={onConfirm}
        isLoading={withdraw.isPending}
        disabled={!acknowledged}
      >
        탈퇴하기
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="withdraw-dialog-title"
      title="회원 탈퇴"
      footer={footer}
    >
      {blockedMessage ? <Alert tone="danger">{blockedMessage}</Alert> : null}
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div>
        <p className="text-sm font-medium text-text-muted">탈퇴 시 소멸되는 잔여 자산</p>
        {balance.isLoading ? (
          <div className="mt-2 grid grid-cols-2 gap-4" aria-busy="true">
            <div className="h-12 animate-pulse rounded-md bg-surface-sunken" />
            <div className="h-12 animate-pulse rounded-md bg-surface-sunken" />
          </div>
        ) : balance.data ? (
          <div className="mt-2 grid grid-cols-2 gap-4">
            <MoneyAmount label="캐시" amount={balance.data.cashBalance} unit="캐시" size="sm" />
            <MoneyAmount
              label="게임머니"
              amount={balance.data.gameMoneyBalance}
              unit="G"
              size="sm"
            />
          </div>
        ) : (
          <p className="mt-2 text-sm text-text-subtle">잔액 정보를 불러오지 못했습니다.</p>
        )}
      </div>

      <p id={WARNING_ID} className="text-sm text-danger">
        탈퇴 시 잔여 캐시·게임머니는 소멸하며 복구·환불되지 않습니다. 이 작업은 되돌릴 수 없습니다.
      </p>

      <Checkbox checked={acknowledged} onChange={setAcknowledged} describedById={WARNING_ID}>
        위 내용을 확인했으며, 잔여 자산 소멸에 동의합니다.
      </Checkbox>

      {!acknowledged ? (
        <p className="text-sm text-text-subtle">동의해야 탈퇴할 수 있습니다.</p>
      ) : null}
    </Modal>
  );
}
