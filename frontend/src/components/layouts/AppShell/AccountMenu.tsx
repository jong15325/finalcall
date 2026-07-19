import { Link } from 'react-router'
import {
    PiUserDuotone,
    PiSignOutDuotone,
    PiBackpackDuotone,
} from 'react-icons/pi'
/*
 * ★ **배럴(`@/components/ui/Avatar`)이 아니라 파일을 직접 가리킨다.** 배럴은 `Avatar.Group`
 *   을 붙이려고 `AvatarGroup` 을 함께 끌어오고, 그게 `ui/Tooltip` → **framer-motion(123KB)**
 *   을 셸의 **정적 그래프**로 끌어들인다(rollup importer 체인으로 실측). 셸은 전 화면에
 *   붙으므로 그 무게가 곧 초기 로드다. 우리는 `Avatar.Group` 을 쓰지 않는다.
 */
import Avatar from '@/components/ui/Avatar/Avatar'
import Dropdown from '@/components/ui/Dropdown'
import LinkButton from '@/components/shared/LinkButton'
import { inkColorClass } from '@/components/shared/buttonColors'
import { useAuth } from '@/auth'
import { ROUTES } from '@/configs/routes.config'

/**
 * 계정 영역 (FC-057).
 *
 * ★ **비로그인일 때 사라지지 않는다.** 로그인/가입 CTA 가 그 자리를 지킨다 — 셸의 요점이
 *   "손님도 크롬을 본다"이므로, 계정 자리만 비면 그 요점이 반쯤 무너진다.
 *
 * ★ 가입 CTA 는 **near-black** 이다(`shared/buttonColors` 의 `inkColorClass` — 단일 출처).
 *   로그인은 그보다 약한 `default` variant 로 둬 **두 CTA 가 서로 경쟁하지 않게** 한다.
 */

const AccountMenu = () => {
    const { authenticated, user, signOut } = useAuth()

    if (!authenticated) {
        return (
            <div className="flex items-center gap-2">
                <LinkButton size="sm" to={ROUTES.login}>
                    로그인
                </LinkButton>
                <LinkButton
                    size="sm"
                    to={ROUTES.signup}
                    customColorClass={inkColorClass}
                >
                    회원가입
                </LinkButton>
            </div>
        )
    }

    return (
        <Dropdown
            className="flex"
            toggleClassName="flex items-center"
            placement="bottom-end"
            renderTitle={
                <button
                    type="button"
                    className="flex cursor-pointer items-center rounded-full"
                    aria-label="계정 메뉴"
                >
                    <Avatar size={32} icon={<PiUserDuotone />} />
                </button>
            }
        >
            <Dropdown.Item variant="header">
                <div className="flex items-center gap-3 px-3 py-2">
                    <Avatar icon={<PiUserDuotone />} />
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                        {/*
                         * 없는 값을 자리표시자로 채우지 않는다 — 계약 §2.5 가 주는 것은
                         * `{ userPublicId, nickname, isAdmin }` 뿐이라 이메일·아바타는 없다.
                         */}
                        {user?.nickname ?? '회원'}
                    </span>
                </div>
            </Dropdown.Item>
            <Dropdown.Item variant="divider" />
            <Dropdown.Item eventKey="profile" className="px-0">
                <Link className="flex h-full w-full px-2" to={ROUTES.profile}>
                    <span className="flex w-full items-center gap-2">
                        <span className="text-xl">
                            <PiUserDuotone />
                        </span>
                        <span>마이페이지</span>
                    </span>
                </Link>
            </Dropdown.Item>
            <Dropdown.Item eventKey="inventory" className="px-0">
                <Link className="flex h-full w-full px-2" to={ROUTES.inventory}>
                    <span className="flex w-full items-center gap-2">
                        <span className="text-xl">
                            <PiBackpackDuotone />
                        </span>
                        <span>내 아이템</span>
                    </span>
                </Link>
            </Dropdown.Item>
            <Dropdown.Item variant="divider" />
            <Dropdown.Item
                eventKey="signOut"
                className="gap-2"
                onClick={() => void signOut()}
            >
                <span className="text-xl">
                    <PiSignOutDuotone />
                </span>
                <span>로그아웃</span>
            </Dropdown.Item>
        </Dropdown>
    )
}

export default AccountMenu
