import { Link } from 'react-router'
import { paths } from '@/app/paths'
import type { FooterDensity } from '@/app/routeUi'
import BrandLogo from '@/components/brand/BrandLogo'

const serviceLinks = [
    { label: '경매', to: paths.auctions },
    { label: '마켓', to: paths.market },
    { label: '커뮤니티', to: paths.boards },
] as const

/** AppShell 전역 서비스 정보. AuthLayout에는 포함하지 않는다. */
function AppFooter({ variant = 'default' }: { variant?: FooterDensity }) {
    const compact = variant === 'compact'

    return (
        <footer
            data-variant={variant}
            className="app-chrome relative z-10 border-t border-chrome-selected bg-chrome-strong text-chrome-muted"
        >
            <div
                className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 xl:px-10 ${compact ? 'py-5 sm:py-6' : 'py-10 sm:py-12'}`}
            >
                <div
                    className={`flex flex-col lg:flex-row lg:items-start lg:justify-between ${compact ? 'gap-4 lg:gap-10' : 'gap-8 lg:gap-16'}`}
                >
                    <div className="max-w-xl">
                        <BrandLogo className="brightness-0 invert" />
                        <p
                            className={`${compact ? 'mt-3' : 'mt-5'} text-sm leading-6 text-chrome-muted`}
                        >
                            마감 순간에도 정확한 가격과 거래 흐름을 지키는 게임
                            아이템 거래 플랫폼입니다.
                        </p>
                        <p
                            className={`${compact ? 'mt-2' : 'mt-4'} text-sm leading-6`}
                        >
                            <span className="font-semibold text-chrome-fg">
                                서비스 문의
                            </span>{' '}
                            <span className="text-chrome-muted">
                                공식 문의 채널 준비 중
                            </span>
                        </p>
                    </div>

                    <nav aria-label="하단 서비스 메뉴">
                        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-chrome-fg">
                            {serviceLinks.map((link) => (
                                <li key={link.to}>
                                    <Link
                                        className="rounded-sm underline-offset-4 hover:text-brand-highlight-bright hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-control-focus"
                                        to={link.to}
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                <div
                    className={`${compact ? 'mt-4 pt-4' : 'mt-10 pt-7'} border-t border-chrome-selected text-xs leading-5 text-chrome-muted`}
                >
                    <p>© 2026 장터. All rights reserved.</p>
                    <div
                        className={`${compact ? 'mt-2' : 'mt-4'} max-w-[75ch] space-y-1.5`}
                    >
                        <p>
                            장터는 게임 아이템 거래를 위한 중개 플랫폼이며, 거래
                            당사자가 등록한 정보의 정확성을 보증하지 않습니다.
                        </p>
                        <p>
                            게임명·상표·아이템 등 각 지식재산권은 해당
                            권리자에게 있으며, 장터는 관련 게임사의 공식
                            서비스가 아닙니다.
                        </p>
                        <p>
                            안전한 거래를 위해 플랫폼에서 안내하는 결제·인도
                            절차를 이용하고, 계정 정보나 인증 수단을 타인과
                            공유하지 마세요.
                        </p>
                    </div>

                    <nav
                        className={compact ? 'mt-3' : 'mt-6'}
                        aria-label="정책 안내"
                    >
                        <ul className="flex flex-wrap gap-x-5 gap-y-2">
                            <li>
                                <span>이용약관 준비 중</span>
                            </li>
                            <li>
                                <span>개인정보처리방침 준비 중</span>
                            </li>
                            <li>
                                <Link
                                    className="rounded-sm font-semibold text-chrome-muted underline-offset-4 hover:text-chrome-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-control-focus"
                                    to="/boards/notice"
                                >
                                    공지사항
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        </footer>
    )
}

export default AppFooter
