import { Link, Outlet, useLocation } from 'react-router'
import { TbBolt, TbGavel, TbShieldCheck } from 'react-icons/tb'
import BrandLogo from '@/components/brand/BrandLogo'
import { paths } from '@/app/paths'

/**
 * 인증 레이아웃 (FC-067) — 로그인·회원가입.
 *
 * ★ 앱 셸(사이드바·상단바)을 쓰지 않는다. 브랜드만 얹은 중앙 정렬 최소 레이아웃 —
 *   인증 화면은 좌측 메뉴에서 제거되어 있다(HANDOVER §5.1).
 * ★ 회원가입은 입력 항목이 많아 목업(`is-signup` ~560px)처럼 카드를 넓게 준다(`max-w-xl`).
 *   로그인은 기존 폭(`max-w-md`)을 유지한다(FC-080 — login 회귀 없음).
 */
function AuthLayout() {
    const isSignup = useLocation().pathname === paths.signup
    return (
        <div className="auth-shell relative isolate min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-8">
            <main
                data-auth-mode={isSignup ? 'signup' : 'login'}
                className={`auth-frame mx-auto grid min-h-[calc(100vh-2.5rem)] w-full overflow-hidden sm:min-h-[calc(100vh-4rem)] ${
                    isSignup ? 'max-w-6xl' : 'max-w-5xl'
                }`}
            >
                <aside className="auth-story relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
                    <Link to={paths.home} aria-label="장터 홈" className="w-fit">
                        <BrandLogo className="max-h-10" />
                    </Link>

                    <div className="relative z-10 max-w-md">
                        <p className="auth-eyebrow">FINALCALL MARKET</p>
                        <h2 className="auth-copy-strong mt-4 text-4xl font-black leading-tight">
                            좋은 아이템을 발견하는
                            <br />가장 선명한 순간
                        </h2>
                        <p className="auth-copy-muted mt-5 text-sm leading-6">
                            스킬 옵션을 비교하고, 실시간 경매와 아이템 마켓을
                            하나의 안전한 거래 흐름으로 이용하세요.
                        </p>
                    </div>

                    <ul className="relative z-10 grid grid-cols-3 gap-3" aria-label="서비스 특징">
                        <li className="auth-feature"><TbBolt aria-hidden /><span>빠른 비교</span></li>
                        <li className="auth-feature"><TbGavel aria-hidden /><span>실시간 경매</span></li>
                        <li className="auth-feature"><TbShieldCheck aria-hidden /><span>안전한 거래</span></li>
                    </ul>
                </aside>

                <section className="auth-form-panel flex min-w-0 flex-col p-5 sm:p-8 lg:p-10">
                    <Link to={paths.home} aria-label="장터 홈" className="mb-8 w-fit lg:hidden">
                        <BrandLogo className="max-h-9" />
                    </Link>
                    <div className="my-auto w-full">
                        <Outlet />
                    </div>
                    <p className="auth-copy-faint mt-8 text-center text-[11px]">
                        © FINALCALL · Secure item trading
                    </p>
                </section>
            </main>
        </div>
    )
}

export default AuthLayout
