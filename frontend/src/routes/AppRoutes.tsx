import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AuthFormLayout } from '@/components/layout/AuthFormLayout';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PagePlaceholder } from '@/pages/PagePlaceholder';
import { HomePage } from '@/pages/HomePage';
import { AuctionListPage } from '@/pages/AuctionListPage';
import { AuctionDetailPage } from '@/pages/AuctionDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { InventoryPage } from '@/pages/InventoryPage';
import { TempStoragePage } from '@/pages/TempStoragePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ROUTES } from '@/routes/paths';

/**
 * 라우팅 셸 (skeleton-plan [3] IA 셸). 레이아웃 3종 + 전 라우트 placeholder.
 * 가드는 레이아웃에 내장(ProtectedLayout·AdminLayout·AuthFormLayout).
 * 경로는 절대경로로 명시 — 중첩 상대경로 혼동 방지.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* 공개(인증 불요) */}
      <Route element={<PublicLayout />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.auctions} element={<AuctionListPage />} />
        <Route path={ROUTES.auctionDetail} element={<AuctionDetailPage />} />
        <Route path={ROUTES.shops} element={<PagePlaceholder title="고정가 목록" />} />
        <Route path={ROUTES.shopDetail} element={<PagePlaceholder title="고정가 상세" />} />
        <Route path={ROUTES.itemDetail} element={<PagePlaceholder title="아이템 상세" />} />
        <Route path={ROUTES.marketPrices} element={<PagePlaceholder title="시세" />} />
      </Route>

      {/* 인증 폼(공개지만 인증 시 홈으로 되돌림) */}
      <Route element={<AuthFormLayout />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.signup} element={<SignupPage />} />
      </Route>

      {/* 보호(me 주체) — 미인증 시 login?returnUrl 복귀 */}
      <Route element={<ProtectedLayout />}>
        <Route path={ROUTES.sell} element={<PagePlaceholder title="판매 등록" />} />
        <Route path={ROUTES.inventory} element={<InventoryPage />} />
        <Route path={ROUTES.tempStorage} element={<TempStoragePage />} />
        <Route path={ROUTES.orders} element={<PagePlaceholder title="거래 내역" />} />
        <Route path={ROUTES.orderDetail} element={<PagePlaceholder title="주문 상세" />} />
        <Route path={ROUTES.wallet} element={<PagePlaceholder title="지갑" />} />
        <Route
          path={ROUTES.walletChargeConfirm}
          element={<PagePlaceholder title="충전 승인 콜백" />}
        />
        <Route path={ROUTES.profile} element={<ProfilePage />} />
      </Route>

      {/* 관리자 — 인증 + isAdmin */}
      <Route element={<AdminLayout />}>
        <Route
          path={ROUTES.adminAuctionDetail}
          element={<PagePlaceholder title="관리자 강제 취소" />}
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
