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
import { useAuth } from '@/auth'
import { ROUTES } from '@/configs/routes.config'

/**
 * 계정 영역 (FC-057).
 *
 * ★ **비로그인일 때 사라지지 않는다.** 로그인/가입 CTA 가 그 자리를 지킨다 — 셸의 요점이
 *   "손님도 크롬을 본다"이므로, 계정 자리만 비면 그 요점이 반쯤 무너진다.
 *
 * ★★ **버튼 색은 템플릿 기본값이다**(사용자 방침 2026-07-19). 가입은 템플릿 주 CTA 인
 *    `variant="solid"`(= `bg-primary text-neutral hover:bg-primary-mild`), 로그인은 기본
 *    `variant="default"`(= 흰 바탕 + `border-gray-300`)로 둬 **두 CTA 가 경쟁하지 않게** 한다.
 *    위계는 색이 아니라 **템플릿이 이미 정해둔 variant 차이**로 만든다.
 *    **폐기**: 종전의 `inkColorClass`(near-black 채움)와 `shared/buttonColors` 파일.
 *
 * ★★ **알려진 AA 미달 — 고치지 않고 남겨둔다(FC-057, 사용자 판단 대기).**
 *    템플릿 기본 프리셋(`themeSchema: ''` = blue)의 `--primary` 램프가 흰 전경에 대해 얕다:
 *      - `solid` 정지 흰 글자 on `--primary` #2A85FF …… **3.56** (요구 4.5)
 *      - `solid` hover on `--primary-mild` #4996FF ……… **2.96**
 *      - `default`·`plain` 도 hover 가 `text-primary`/`text-primary-mild` 로 가 각각 3.56/2.96
 *    즉 **세 variant 전부** 어느 상태에선가 미달이라 variant 교체로는 해결되지 않는다.
 *    WCAG 1.4.3 큰 텍스트 예외(≥18.66px bold)도 **적용되지 않는다** — 실측 결과 버튼 활자는
 *    xs 12 / sm 14 / md 14(body 상속) / lg 16px 이고 전부 `.button` 의 `font-bold` 다.
 *    **템플릿 안의 유일한 해법은 프리셋 교체**(`themeSchema: 'dark'` → `--primary` #18181B,
 *    17.72/14.89 통과)인데 그건 앱 전체 액센트가 바뀌는 **사용자 결정**이다.
 *    → 우리 값으로 토큰을 덮지 않는다. 내비는 (c)로 우회했지만 **버튼은 우회로가 없다.**
 */

const AccountMenu = () => {
    const { authenticated, user, signOut } = useAuth()

    if (!authenticated) {
        return (
            <div className="flex items-center gap-2">
                <LinkButton size="sm" to={ROUTES.login}>
                    로그인
                </LinkButton>
                <LinkButton size="sm" variant="solid" to={ROUTES.signup}>
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
