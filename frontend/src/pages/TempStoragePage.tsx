import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { CursorLoadMore } from '@/components/ui/CursorLoadMore';
import { useRelocate, useTempStorageList } from '@/features/inventory/api/useInventory';
import { TempStorageRow } from '@/features/inventory/components/TempStorageRow';
import { ROUTES } from '@/routes/paths';

/**
 * 임시보관 (`/me/temp-storage`, ProtectedLayout) — FC-054. 종전 `PagePlaceholder`를 대체한다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 왜 **별도 페이지**인가 (탭도, 인벤토리 하단 섹션도 아니다)
 * ══════════════════════════════════════════════════════════════════════════════
 * ① 임시보관은 **오버플로우**다 — 정상 상태가 "0건"이다. 인벤토리 안에 탭·섹션으로 상주시키면
 *    화면이 매일 빈 칸을 보고하고, 정작 아이템이 들어왔을 때의 신호가 그 노이즈에 묻힌다.
 * ② 계약상 **성격이 다른 목록**이다 — 정규는 96칸 단일 응답(비페이지네이션)이고 임시보관은
 *    cursor 페이지다(§4.2). 한 화면에 두면 "더 보기"가 어느 목록의 것인지 흐려진다.
 * ③ 라우트(`/me/temp-storage`)가 이미 IA에 있다(ux-flows §1) — 없는 화면을 지어낸 게 아니다.
 *
 * 대신 **발견 경로**를 보장한다: 인벤토리 상단 `TempStorageBanner`가 **0건이 아닐 때만** 뜬다.
 * 상시 내비(ME_NAV)에는 넣지 않았다 — 평소 비어 있는 화면을 상시 메뉴에 두면 같은 노이즈가 된다.
 *
 * relocate는 **목적 슬롯을 묻지 않는다**(서버 자동 배정) — 근거는 `inventoryApi.relocateFromTempStorage`.
 */
export function TempStoragePage() {
  const query = useTempStorageList();
  const relocate = useRelocate();

  /** 방금 옮긴 결과. 실패는 행이 자기 자리에서 말하고, 성공만 페이지 상단에서 알린다. */
  const [moved, setMoved] = useState<{ name: string; slotNo: number } | null>(null);

  const items = query.data?.pages.flatMap((page) => page.content) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={ROUTES.inventory}
          className="text-body font-medium text-text-muted no-underline hover:text-primary hover:underline"
        >
          ← 인벤토리
        </Link>
        <h1 className="mt-2 text-title text-text">임시보관</h1>
        <p className="mt-2 max-w-[52ch] text-body leading-relaxed text-text-muted">
          정규 인벤토리가 가득 찬 상태에서 받은 아이템이 이곳에 임시로 보관됩니다. 정규 칸에 여유가
          생기면 옮겨 두세요.
        </p>
      </div>

      {moved ? (
        <Alert tone="success">
          {moved.name}을(를) 인벤토리 <span className="font-num">{moved.slotNo}</span>번 칸으로
          옮겼습니다.
        </Alert>
      ) : null}

      {query.isError ? (
        <div className="rounded-lg border border-border bg-surface">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : query.isPending ? (
        <TempStorageSkeleton />
      ) : items.length === 0 ? (
        <TempStorageEmpty />
      ) : (
        <>
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {items.map((entry) => (
              <TempStorageRow
                key={entry.itemInstancePublicId}
                entry={entry}
                isRelocating={
                  relocate.isPending && relocate.variables === entry.itemInstancePublicId
                }
                error={
                  relocate.isError && relocate.variables === entry.itemInstancePublicId
                    ? relocate.error
                    : undefined
                }
                onRelocate={() => {
                  setMoved(null);
                  relocate.mutate(entry.itemInstancePublicId, {
                    onSuccess: (result) =>
                      setMoved({ name: entry.summary.displayName, slotNo: result.slotNo }),
                  });
                }}
              />
            ))}
          </div>

          <CursorLoadMore
            hasNext={query.hasNextPage}
            isLoading={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
            endLabel="임시보관의 마지막 아이템입니다"
          />
        </>
      )}
    </div>
  );
}

function TempStorageSkeleton() {
  return (
    <div
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">임시보관 불러오는 중</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-4 p-4">
          <div className="h-16 w-16 flex-none animate-pulse rounded-sm bg-surface-sunken" />
          <div className="flex-1">
            <div className="h-4 w-2/5 animate-pulse rounded-sm bg-surface-sunken" />
            <div className="mt-2 h-3 w-1/4 animate-pulse rounded-sm bg-surface-sunken" />
          </div>
          <div className="h-11 w-[152px] animate-pulse rounded-md bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

/**
 * 빈 임시보관 — **이것이 정상 상태다.** 그래서 문구가 "없어서 아쉽다"가 아니라 "정상이다"라고 말한다.
 * 빈 목록을 문제처럼 그리면 사용자가 없는 문제를 찾아 나선다.
 */
function TempStorageEmpty() {
  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-14 text-center">
      <p className="text-value text-text">임시보관이 비어 있습니다</p>
      <p className="mx-auto mt-3 max-w-[46ch] text-body leading-relaxed text-text-muted">
        정상입니다. 정규 인벤토리가 가득 찬 상태에서 아이템을 새로 받을 때만 이곳이 채워집니다.
      </p>
      <div className="mt-6">
        <Link
          to={ROUTES.inventory}
          className="inline-flex h-12 items-center rounded-md border border-border-strong bg-surface px-5 text-value font-bold text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
        >
          인벤토리로 돌아가기
        </Link>
      </div>
    </div>
  );
}
