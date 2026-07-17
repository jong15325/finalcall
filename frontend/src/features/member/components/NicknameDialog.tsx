import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { hasErrorCode } from '@/lib/api/errors';
import { toFieldErrorMap } from '@/lib/api/fieldErrors';
import { ERROR_CODES } from '@/types/errorCodes';
import { useUpdateNickname } from '../api/useMember';

/**
 * 닉네임 수정 다이얼로그 (spec §3.3 A · 디자인 게이트: 별도 다이얼로그).
 * PATCH /me → 성공 시 캐시 갱신 + 헤더 동기화(훅 담당) → 닫기 + 부모 성공 알림.
 * MEMBER_001(409 중복)·검증 400 → 필드 에러.
 */
interface NicknameDialogProps {
  open: boolean;
  currentNickname: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function NicknameDialog({ open, currentNickname, onClose, onUpdated }: NicknameDialogProps) {
  const [nickname, setNickname] = useState(currentNickname);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useUpdateNickname();

  // 다이얼로그가 열릴 때마다 현재 닉네임으로 초기화
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setNickname(currentNickname);
      setFieldError(undefined);
      setFormError(null);
    }
  }

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setFieldError(undefined);
    setFormError(null);
    mutation.mutate(nickname, {
      onSuccess: () => onUpdated(),
      onError: (error) => {
        if (hasErrorCode(error, ERROR_CODES.MEMBER_001)) {
          setFieldError('이미 사용 중인 닉네임입니다.');
          return;
        }
        const fe = toFieldErrorMap(error);
        if (fe.nickname) {
          setFieldError(fe.nickname);
          return;
        }
        setFormError(error instanceof Error ? error.message : '닉네임 수정에 실패했습니다.');
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} titleId="nickname-dialog-title" title="닉네임 수정">
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <Field
          label="닉네임"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          error={fieldError}
          autoComplete="nickname"
          required
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            type="submit"
            isLoading={mutation.isPending}
            disabled={nickname.trim() === '' || nickname === currentNickname}
          >
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
