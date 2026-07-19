import { Link } from 'react-router-dom';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useInventory } from '@/features/inventory/api/useInventory';
import { CapacityStrip } from '@/features/inventory/components/CapacityStrip';
import { InventoryGrid } from '@/features/inventory/components/InventoryGrid';
import { TempStorageBanner } from '@/features/inventory/components/TempStorageBanner';
import { ROUTES } from '@/routes/paths';

/**
 * 인벤토리 (`/me/inventory`, ProtectedLayout) — FC-054. 종전 `PagePlaceholder`를 대체한다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 원게임에서 무엇을 가져오고 무엇을 버렸나 (`docs/game_ui/ingame/인벤토리 전체.png`)
 * ══════════════════════════════════════════════════════════════════════════════
 * **계승** — ① **세로 카드 아트가 격자로 깔린 화면**이라는 구조·은유. ② 좌하단 "SLOT 84" 용량 표시
 * (여기서는 `CapacityStrip`으로 승격 — 원본에서 구석 숫자였던 것이 웹에서는 화면의 첫 정보다).
 * ③ 슬롯 번호라는 좌표 개념(캡션의 `#N`).
 *
 * **폐기** — ① **남색 게임 창(chrome)**: 금색 타이틀바·베벨 테두리·닫기 버튼. 그대로 옮기면 2001년이
 * 된다(카드정보 모달이 정확히 그 이유로 폐기됐다, [5.5]). ② **4탭 페이지네이션**(기본/추가슬롯1~3 ×
 * 24칸 = 96): 스크롤이 없는 고정 창의 제약이지 우리 요구가 아니다 — 웹은 스크롤한다. ③ **96칸 전량
 * 렌더**: 근거는 `CapacityStrip` 주석. ④ 아바타·펫·속성카드 탭: 계약 스코프 밖이다(§3.3.1 —
 * `item_template`은 상품군 1만 담는다).
 *
 * **Containment**([1.2]): 게임색은 `ItemArtSlot` **안**(딥 글로우·속성 배지·골드포스 아웃라인)에만
 * 있다. 페이지 배경·카드 테두리·버튼·용량 미터는 전부 무채색이고, 속성은 캡션에 **텍스트로** 적힌다.
 *
 * ★ **계약에 없는 것을 만들지 않았다.** 정규 슬롯 간 이동(드래그)·정렬 저장·아이템 삭제는 계약에
 * 엔드포인트가 없다 — 만들면 누르는 순간 죽는 UI가 된다. 판매 등록 진입도 붙이지 않았다(`/sell`이
 * 아직 `PagePlaceholder`라 막다른 길이 된다). 그래서 셀의 동작은 **아트 확대**뿐이다.
 */
export function InventoryPage() {
  const query = useInventory();
  const data = query.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* 페이지 제목은 화면당 1개다([3.2] `text-title`). */}
        <h1 className="text-title text-text">인벤토리</h1>
        <p className="mt-2 max-w-[52ch] text-body text-text-muted">
          보유 중인 아이템입니다. 출품 중인 아이템은 경매·고정가 쪽에 잠겨 있어 여기 보이지
          않습니다.
        </p>
      </div>

      {query.isError ? (
        <div className="rounded-lg border border-border bg-surface">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : query.isPending ? (
        <InventorySkeleton />
      ) : data ? (
        <>
          <CapacityStrip used={data.used} capacity={data.capacity} />
          <TempStorageBanner />
          {data.items.length === 0 ? (
            <InventoryEmpty capacity={data.capacity} />
          ) : (
            <InventoryGrid items={data.items} />
          )}
        </>
      ) : null}
    </div>
  );
}

/**
 * 로딩 — 실제 격자와 **같은 열 구조**로 깐다. 열 수가 다른 스켈레톤은 도착 순간 레이아웃이 튄다.
 * 12칸만 그린다(첫 화면에 들어오는 대략의 양). 96칸 스켈레톤은 로딩이 페이지보다 무거워진다.
 */
function InventorySkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">인벤토리 불러오는 중</span>
      <div className="h-[104px] animate-pulse rounded-lg bg-surface-sunken" />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div
            key={index}
            className="h-[88px] animate-pulse rounded-lg bg-surface-sunken md:h-[286px]"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 빈 인벤토리 — **신규 회원이 가입 직후 처음 보는 화면이다.** 흔한 상태이지 예외가 아니다.
 *
 * 그래서 "표시할 내용이 없습니다" 한 줄로 끝내지 않는다. ① 왜 비었는지(아직 아무것도 안 받았다)
 * ② 여기에 무엇이 들어오는지(낙찰·구매한 아이템) ③ 다음에 무엇을 할지(둘러보기)를 준다.
 * 공용 `EmptyState`를 쓰지 않은 이유가 그것이다 — 저 셋을 다 넣으려면 골격이 아니라 화면이 필요하다.
 */
function InventoryEmpty({ capacity }: { capacity: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-14 text-center">
      <p className="text-value text-text">아직 보유한 아이템이 없습니다</p>
      <p className="mx-auto mt-3 max-w-[46ch] text-body leading-relaxed text-text-muted">
        경매에서 낙찰받거나 고정가로 구매한 아이템이 이 <span className="font-num">{capacity}</span>
        칸에 차례로 들어옵니다. 지금은 <span className="font-num">{capacity}</span>칸이 전부 비어
        있습니다.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to={ROUTES.auctions}
          className="inline-flex h-12 items-center rounded-md bg-ink px-5 text-value font-bold text-primary-fg no-underline transition-colors duration-fast hover:bg-[#33333a] active:bg-black"
        >
          경매 둘러보기
        </Link>
        <Link
          to={ROUTES.shops}
          className="inline-flex h-12 items-center rounded-md border border-border-strong bg-surface px-5 text-value font-bold text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
        >
          고정가 매물 보기
        </Link>
      </div>
    </div>
  );
}
