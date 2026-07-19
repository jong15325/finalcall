import { Link, NavLink } from 'react-router-dom';
import { Wordmark } from '@/components/layout/Wordmark';
import { useBalance } from '@/features/wallet/api/useWallet';
import { formatMoney } from '@/lib/format';
import { ROUTES } from '@/routes/paths';
import { useAuthStore, useIsAuthenticated } from '@/stores/authStore';

/**
 * SiteHeader — 공통 셸 상단(FC-041 결정 ②, FC-048 집행).
 *
 * ★ **데스크톱 2행 / 모바일 1행 — 접는 게 아니라 다른 구조다.**
 * - 데스크톱(≥768): (1행) 브랜드 · 상태(잔액/계정) — 정체성과 "지금 입찰 가능한가"
 *                   (2행) 주 내비 · 판매 CTA — 이동
 *   두 축을 **행으로 분리**해 위계를 만든다. 한 줄에 섞으면 전부 같은 무게의 텍스트 링크가 된다.
 * - 모바일(<768): **1행만 남기고 이동은 하단 탭바가 맡는다**(MobileTabBar). 2행 헤더(약 114px)를
 *   그대로 올리면 히어로가 접혀 **스크롤 0px의 카운트다운**이라는 이 화면의 정체성이 죽는다.
 *
 * ★ 활성 표시는 **퍼플이 아니라 near-black 2px 밑줄**이다 — 강조는 색이 아니라 무게·형태로 만든다
 * ([1.2] ①: 퍼플은 액센트이지 상태 채움이 아니다).
 *
 * ★ **Game-Color Containment**([1.2]) — 셸에는 element 색·글로우·금색이 **하나도 없다.**
 * 여기 쓰이는 색은 크롬(surface·border·text)과 조작(ink·primary) 계층뿐이다.
 *
 * 미도입: **검색 입력**. 계약 §3 공통 목록 필터·§4.1 카탈로그 어디에도 자유문 검색 파라미터가 없어
 * 지금 놓으면 동작하지 않는 컨트롤이 된다([5.2] "사유 없는 비활성 금지"). 계약이 검색을 규정하면
 * 1행 중앙이 그 자리다(레이아웃은 이미 수용).
 */
const NAV_ITEMS = [
  { to: ROUTES.home, label: '홈', end: true },
  { to: ROUTES.auctions, label: '경매', end: false },
  { to: ROUTES.shops, label: '고정가', end: false },
  { to: ROUTES.marketPrices, label: '시세', end: false },
] as const;

export function SiteHeader() {
  const isAuthed = useIsAuthenticated();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      {/* ── 1행: 정체성 + 상태 ─────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
        <div className="flex h-14 items-center gap-4 md:h-[68px]">
          <Link to={ROUTES.home} aria-label="FinalCall 홈" className="flex-none no-underline">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            {isAuthed ? <AccountCluster /> : <GuestCluster />}
          </div>
        </div>
      </div>

      {/* ── 2행: 주 내비 (데스크톱 전용 — 모바일은 하단 탭바) ────────────────── */}
      <div className="hidden border-t border-border-muted md:block">
        <div className="mx-auto w-full max-w-[1200px] px-6">
          <div className="flex h-[46px] items-center gap-6">
            <nav aria-label="주 메뉴">
              <ul className="flex items-center gap-6">
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} className={desktopNavClass}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            {/*
             * 판매하기는 비로그인에게도 노출한다 — /sell 은 ProtectedLayout 이 지키므로 로그인으로
             * 되돌아왔다가(returnUrl) 다시 이어진다. 죽은 링크가 아니라 유입 경로다.
             */}
            <Link
              to={ROUTES.sell}
              className="ml-auto inline-flex h-8 flex-none items-center rounded-md bg-ink px-3 text-micro font-medium text-primary-fg no-underline transition-colors duration-fast hover:bg-[#33333a]"
            >
              판매하기
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * 활성 = near-black 2px 밑줄. `relative` + `after` 로 그려 밑줄이 헤더 하단 경계와 겹치게 둔다
 * (탭이 면에 "붙어 있다"는 인상을 만든다). 색은 조작 계층뿐 — 퍼플을 쓰지 않는다.
 */
function desktopNavClass({ isActive }: { isActive: boolean }): string {
  const base =
    'relative inline-flex h-[46px] items-center text-body no-underline transition-colors duration-fast';
  return isActive
    ? `${base} font-bold text-text after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-text`
    : `${base} font-medium text-text-muted hover:text-text`;
}

/** 비로그인 — 로그인(텍스트) + 회원가입(outline). 주 CTA 블랙은 헤더에서 쓰지 않는다(판매하기 1개로 충분). */
function GuestCluster() {
  return (
    <>
      <Link
        to={ROUTES.login}
        className="text-body font-medium text-text no-underline hover:text-primary hover:underline"
      >
        로그인
      </Link>
      <Link
        to={ROUTES.signup}
        className="inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 text-micro font-medium text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
      >
        회원가입
      </Link>
    </>
  );
}

/**
 * 로그인 — **가용 게임머니를 헤더에 상주**시킨다. 자금 거래 제품에서 잔액은 장식이 아니라
 * "지금 입찰할 수 있는가"를 결정하는 1차 정보다. 홀드가 있으면 `warning` 도트 + 문구로 병기한다
 * (색 단독 전달 금지 — 금액 문구가 1차 신호다).
 *
 * 잔액은 **모바일에서 숨긴다.** 좁은 1행에 금액 2줄을 넣으면 브랜드와 충돌하고, 모바일에서 잔액이
 * 필요한 순간은 입찰·구매 시점이라 그 화면이 책임진다.
 */
function AccountCluster() {
  const nickname = useAuthStore((s) => s.user?.nickname);
  const { data: balance } = useBalance();

  return (
    <>
      {balance ? (
        <div className="hidden flex-col items-end gap-px border-l border-border pl-3 leading-tight md:flex">
          <span className="text-label text-text-subtle">가용 게임머니</span>
          <span className="font-num text-body font-bold text-text">
            {formatMoney(balance.gameMoneyAvailable)}
            <span className="ml-0.5 text-micro font-medium text-text-muted">G</span>
          </span>
          {balance.gameMoneyHeld > 0 ? (
            <span className="inline-flex items-center gap-1 text-label text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
              {formatMoney(balance.gameMoneyHeld)}G 홀드 중
            </span>
          ) : null}
        </div>
      ) : null}
      <Link
        to={ROUTES.profile}
        className="inline-flex items-center gap-2 rounded-md p-1 text-text no-underline transition-colors duration-fast hover:bg-surface-sunken"
      >
        <span
          className="grid h-7 w-7 flex-none place-items-center rounded-full border border-border bg-surface-sunken text-micro font-bold text-text-muted"
          aria-hidden="true"
        >
          {nickname?.slice(0, 1) ?? '·'}
        </span>
        <span className="hidden text-body font-medium md:inline">{nickname ?? '마이페이지'}</span>
        <span className="sr-only md:hidden">마이페이지</span>
      </Link>
    </>
  );
}
