import { Route, Routes } from 'react-router'
import AppShell from '@/components/layout/AppShell'
import AuthLayout from '@/components/layout/AuthLayout'
import ProtectedRoute from '@/components/route/ProtectedRoute'
import PublicRoute from '@/components/route/PublicRoute'
import { paths } from './paths'

import HomePage from '@/pages/HomePage'
import AuctionListPage from '@/pages/AuctionListPage'
import AuctionDetailPage from '@/pages/AuctionDetailPage'
import ComparePage from '@/pages/ComparePage'
import SellPage from '@/pages/SellPage'
import MePage from '@/pages/MePage'
import OrdersPage from '@/pages/OrdersPage'
import InventoryPage from '@/pages/InventoryPage'
import TempStoragePage from '@/pages/TempStoragePage'
import ItemDetailPage from '@/pages/ItemDetailPage'
import WalletPage from '@/pages/WalletPage'
import MarketPage from '@/pages/MarketPage'
import MarketDetailPage from '@/pages/MarketDetailPage'
import CommunityPage from '@/pages/CommunityPage'
import WalletChargePage from '@/pages/WalletChargePage'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import NotFoundPage from '@/pages/NotFoundPage'

/**
 * 라우트 트리 (FC-067 — rebuild-contract-map §1 라우트 지도).
 *
 * ★ 세 계층:
 *   - 비로그인 전용(PublicRoute + AuthLayout): 로그인·회원가입.
 *   - 공개 셸(AppShell): 홈·경매·비교·준비 중 자리(마켓·커뮤니티·충전).
 *   - 보호 셸(ProtectedRoute): 판매·마이페이지·인벤토리·보관함·아이템 상세·지갑.
 * ★ 각 실연동 라우트는 지금 **빈 셸**(후속 티켓이 채움). 준비 중 라우트는 404 대신 안내를 낸다.
 */
function AppRoutes() {
    return (
        <Routes>
            {/* 비로그인 전용 */}
            <Route element={<PublicRoute />}>
                <Route element={<AuthLayout />}>
                    <Route path={paths.login} element={<LoginPage />} />
                    <Route path={paths.signup} element={<SignupPage />} />
                </Route>
            </Route>

            {/* 앱 셸 */}
            <Route element={<AppShell />}>
                {/* 공개 */}
                <Route index element={<HomePage />} />
                <Route path={paths.auctions} element={<AuctionListPage />} />
                <Route
                    path={paths.auctionDetail}
                    element={<AuctionDetailPage />}
                />
                <Route path={paths.compare} element={<ComparePage />} />

                {/* 고정가 마켓 — 목록·상세(공개, FC-094) */}
                <Route path={paths.market} element={<MarketPage />} />
                <Route
                    path={paths.marketDetail}
                    element={<MarketDetailPage />}
                />

                {/* 준비 중 자리(404 방지) */}
                <Route path={paths.community} element={<CommunityPage />} />
                <Route
                    path={paths.walletCharge}
                    element={<WalletChargePage />}
                />

                {/* 로그인 필요 */}
                <Route element={<ProtectedRoute />}>
                    <Route path={paths.sell} element={<SellPage />} />
                    <Route path={paths.me} element={<MePage />} />
                    <Route path={paths.orders} element={<OrdersPage />} />
                    <Route path={paths.inventory} element={<InventoryPage />} />
                    <Route
                        path={paths.tempStorage}
                        element={<TempStoragePage />}
                    />
                    <Route path={paths.wallet} element={<WalletPage />} />
                    <Route
                        path={paths.itemDetail}
                        element={<ItemDetailPage />}
                    />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFoundPage />} />
            </Route>
        </Routes>
    )
}

export default AppRoutes
