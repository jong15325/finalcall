import { Button } from '@/components/ui/Button';
import { ItemArtSlot } from '@/features/item/components/ItemArtSlot';
import { elementLabelOf } from '@/features/item/lib/element';
import { goldforceStateOf } from '@/features/item/lib/goldforce';
import { itemTypeLabel } from '@/features/item/lib/itemCode';
import { isApiError } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { ERROR_CODES } from '@/types/errorCodes';
import { toItemBlock } from '../lib/itemSummary';
import type { TempStorageItem } from '../types';

/**
 * 임시보관 행 (FC-054) — 계약 §4.2 `content[]` 항목 + relocate 액션.
 *
 * ★ **여기는 격자가 아니다.** 임시보관은 오버플로우라 건수가 적고, 각 행마다 **결정(옮길까)** 이
 *   붙는다. 결정이 붙은 목록은 그림 격자가 아니라 정보+액션 행이다 — 보관 시각·만료 기한처럼
 *   격자 셀에 들어가지 않는 문장이 판단 근거이기 때문이다. 그래서 데스크톱·모바일이 같은 행 구조를
 *   쓰고, 좁은 폭에서 버튼만 아래로 내려간다(이 화면은 구조를 나눌 이유가 없다).
 *
 * ★ 만료 기한은 **있을 때만** 적는다(계약이 `expireAt?`으로 두었다). 없는 기한을 "무기한"으로
 *   단정하지 않는다 — 정책을 화면이 지어내는 순간 거짓말이 된다.
 */
export function TempStorageRow({
  entry,
  onRelocate,
  isRelocating,
  error,
}: {
  entry: TempStorageItem;
  onRelocate: () => void;
  isRelocating: boolean;
  /** 이 행에서 발생한 relocate 실패. 다른 행의 실패는 넘어오지 않는다. */
  error?: unknown;
}) {
  const item = toItemBlock(entry.summary);
  const goldforce = goldforceStateOf(item.goldforceExpireAt);

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <span aria-hidden="true" className="flex-none">
        <ItemArtSlot item={item} variant="thumb" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-bold text-text">{item.nameSnapshot}</p>
        <p className="mt-1 text-micro text-text-muted">
          {elementLabelOf(item.element)} 속성 · {itemTypeLabel(item.subGroup, item.kind)} ·{' '}
          <span className="font-num">Lv.{item.level}</span>
          {goldforce.active ? ` · 골드포스 ${goldforce.remainingLabel} 남음` : null}
        </p>
        <p className="mt-1 text-micro text-text-subtle">
          <span className="font-num">{formatDateTime(entry.storedAt)}</span> 보관
          {entry.expireAt ? (
            <>
              {' · '}
              <span className="font-num">{formatDateTime(entry.expireAt)}</span> 까지
            </>
          ) : null}
        </p>
      </div>

      <div className="flex-none sm:w-[168px] sm:text-right">
        <Button
          variant="outline"
          onClick={onRelocate}
          isLoading={isRelocating}
          className="w-full sm:w-auto"
        >
          인벤토리로 옮기기
        </Button>
        {error ? (
          <p className="mt-2 text-micro text-danger sm:text-left" role="alert">
            {relocateErrorMessage(error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * relocate 실패 문구 (계약 §4.2 에러 목록).
 *
 * ★ 코드마다 **사용자가 할 일이 다르다.** 뭉뚱그리면 "다시 시도"만 반복하게 된다.
 *   - `INV_001` 만실: 칸을 비워야 풀린다(판매·소진). 재시도는 무의미하다.
 *   - `ITEM_003` TEMP 아님 / `ITEM_001` 없음: 이미 옮겨졌거나 사라졌다 → 목록이 낡았다(새로고침).
 *   - `ITEM_002` 소유자 아님: 내 것이 아니다. 재시도로 바뀌지 않는다.
 *   - `INV_002` 슬롯 점유: **우리는 slotNo를 보내지 않으므로 실질적으로 나올 수 없다.** 그래도 적어
 *     둔다 — 서버 자동 배정과 동시 요청이 경합하면 이론상 도달 가능하고, 그때 원문만 뜨면 원인을
 *     추적할 수 없다.
 */
function relocateErrorMessage(error: unknown): string {
  if (!isApiError(error)) return '옮기지 못했습니다. 잠시 후 다시 시도해 주세요.';

  switch (error.code) {
    case ERROR_CODES.INV_001:
      return '정규 인벤토리가 가득 찼습니다. 칸을 비운 뒤 다시 옮겨 주세요.';
    case ERROR_CODES.INV_002:
      return '배정하려던 칸이 방금 채워졌습니다. 다시 시도해 주세요.';
    case ERROR_CODES.ITEM_003:
    case ERROR_CODES.ITEM_001:
      return '이 아이템은 이미 임시보관에 없습니다. 목록을 새로고침해 주세요.';
    case ERROR_CODES.ITEM_002:
      return '내 아이템이 아닙니다.';
    default:
      return error.message;
  }
}
