/**
 * 용량 스트립 — **원게임 인벤토리 좌하단 "SLOT 84"의 계승분**이다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 이 컴포넌트가 존재하는 이유 = **빈 칸 93개를 그리지 않기 위해서다.**
 *   원게임은 96칸을 전부 그렸다. 그래야 했던 건 빈 칸이 **드래그 놓을 자리**였기 때문이다.
 *   우리 계약에는 정규 슬롯 간 이동 엔드포인트가 **없다** — 그래서 빈 칸은 조작 대상이 아니고,
 *   93개의 회색 상자는 "몇 칸 남았나"라는 정보 하나를 96번 반복해 실물 아이템을 화면 밖으로 민다.
 *   **6글자가 전하는 정보를 93칸이 대신하게 두지 않는다.** 그 6글자가 여기다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 미터는 보조 신호다 — 수치("12 / 96 칸")가 항상 병기되므로 막대를 지워도 정보가 남는다
 * (색·형태 단독 전달 금지). `capacity`가 0이거나 이상값이면 막대를 그리지 않는다.
 */
export function CapacityStrip({ used, capacity }: { used: number; capacity: number }) {
  const safeCapacity = capacity > 0 ? capacity : 0;
  const free = Math.max(safeCapacity - used, 0);
  const ratio = safeCapacity > 0 ? Math.min(Math.max(used / safeCapacity, 0), 1) : 0;
  const full = safeCapacity > 0 && free === 0;

  return (
    <section
      aria-label="인벤토리 용량"
      className="rounded-lg border border-border bg-surface px-5 py-4 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-label text-text-subtle">사용 중인 칸</p>
        <p className="text-label text-text-subtle">{full ? '가득 참' : '남은 칸'}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-num text-value text-text">
          {used} <span className="text-text-subtle">/ {safeCapacity}</span>
        </p>
        <p className={`font-num text-value ${full ? 'text-warning' : 'text-text'}`}>
          {full ? '0' : free}
          <span className="ml-0.5 text-micro font-medium text-text-muted">칸</span>
        </p>
      </div>

      {safeCapacity > 0 ? (
        <span
          className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-sunken"
          role="presentation"
        >
          <span
            className={`block h-full rounded-full ${full ? 'bg-warning' : 'bg-text'}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      ) : null}

      {full ? (
        <p className="mt-3 text-body text-text-muted">
          정규 칸이 가득 찼습니다. 새로 받는 아이템은 임시보관으로 들어갑니다.
        </p>
      ) : null}
    </section>
  );
}
