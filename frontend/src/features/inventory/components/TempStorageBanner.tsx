import { Link } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';
import { useTempStoragePreview } from '../api/useInventory';

/**
 * 임시보관 배너 — 인벤토리 화면 상단. **있을 때만 존재한다.**
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ "비었을 때 자리를 차지할 이유가 있나" → **없다.**
 *   임시보관은 정규 96칸이 넘쳤을 때만 생기는 **오버플로우**라 정상 상태는 "빈 상태"다. 평소에도
 *   빈 패널·빈 탭이 서 있으면 화면이 매일 "여기 아무것도 없음"을 보고하게 되고, 정작 아이템이
 *   들어왔을 때의 신호가 그 상시 노이즈에 묻힌다. 그래서 **0건이면 렌더 자체를 하지 않는다.**
 *   같은 이유로 상시 내비(ME_NAV)에도 넣지 않았다 — 발견 경로는 이 배너와 직접 URL뿐이다.
 *
 * ★ 개수를 단정하지 않는다. `/me/temp-storage`는 cursor 페이지라 **총건수가 없다**(계약 §1.3).
 *   첫 페이지가 다 차고 `hasNext`면 "N개 이상"이라고 적는다 — 모르는 총계를 숫자로 덮지 않는다.
 *
 * ★ 로딩·에러에는 아무것도 그리지 않는다. 이 배너는 인벤토리 화면의 **부수 정보**이고,
 *   실패했다고 인벤토리 위에 두 번째 에러 패널을 세우면 주 정보가 밀려난다(주 목록의 에러는
 *   페이지가 이미 표면화한다).
 */
export function TempStorageBanner() {
  const query = useTempStoragePreview();
  const page = query.data;
  const count = page?.content.length ?? 0;

  if (!page || count === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-warning/[.08] px-5 py-4"
    >
      <p className="min-w-0 flex-1 text-body text-warning">
        임시보관에 아이템 <span className="font-num">{count}</span>
        {page.hasNext ? '개 이상이' : '개가'} 있습니다. 정규 칸이 비어 있으면 옮겨 두세요.
      </p>
      <Link
        to={ROUTES.tempStorage}
        className="inline-flex h-11 flex-none items-center rounded-md border border-border-strong bg-surface px-4 text-body font-medium text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
      >
        임시보관 보기
      </Link>
    </div>
  );
}
