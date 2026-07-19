import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ROUTES } from '@/routes/paths';
import { useIsAuthenticated } from '@/stores/authStore';

/**
 * MobileTabBar — 모바일 주 내비(FC-048 결정, <768px 전용).
 *
 * ★ **왜 드로어(햄버거)가 아니라 하단 탭바인가.**
 * 1. 목적지가 4개뿐이다(홈·경매·고정가·내 정보). 4개를 햄버거 뒤에 숨기면 **모든 이동이 2탭**이 되는
 *    순손실이다. 드로어는 목적지가 열 개를 넘어 화면에 다 못 놓을 때의 해법이다.
 * 2. **카운트다운 제품은 "반복 확인" 사용 패턴**이다 — 경매↔고정가↔홈을 계속 오간다. 반복 이동은
 *    항상 1탭이어야 한다.
 * 3. 엄지 도달: 세로로 긴 화면에서 **상단 우측이 가장 먼 자리**이고 하단이 가장 가깝다. 주 내비를
 *    상단에 두는 것은 데스크톱 마우스 전제의 관성이다.
 * 4. 상단을 1행으로 비우면 **스크롤 0px에 실데이터(카운트다운)가 들어온다** — 이 화면의 정체성이다.
 *
 * ★ 활성 표시는 데스크톱 밑줄 모티프를 **위아래만 뒤집는다**(하단 고정 바이므로 밑줄이 화면 밖으로
 * 밀린다) — 탭 **상단에 near-black 2px 선**. 색이 아니라 형태·무게로 표시한다는 규칙은 동일하고,
 * 셸에 게임색·퍼플 채움이 새지 않는다([1.2] Containment).
 *
 * 접근성: 탭 높이 56px + 아이콘·라벨 병기(아이콘 단독 금지). 아이콘은 `aria-hidden`, 라벨이 이름이다.
 * iOS 홈 인디케이터를 피하려 `env(safe-area-inset-bottom)` 만큼 아래 여백을 준다.
 */
export function MobileTabBar() {
  const isAuthed = useIsAuthenticated();

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex items-stretch">
        <Tab to={ROUTES.home} label="홈" end icon={<HomeIcon />} />
        <Tab to={ROUTES.auctions} label="경매" icon={<GavelIcon />} />
        <Tab to={ROUTES.shops} label="고정가" icon={<TagIcon />} />
        <Tab
          to={isAuthed ? ROUTES.profile : ROUTES.login}
          label={isAuthed ? '내 정보' : '로그인'}
          icon={<PersonIcon />}
        />
      </ul>
    </nav>
  );
}

function Tab({
  to,
  label,
  icon,
  end = false,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `relative flex h-14 flex-col items-center justify-center gap-1 text-label no-underline transition-colors duration-fast ${
            isActive
              ? 'text-text before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:bg-text'
              : 'text-text-muted'
          }`
        }
      >
        <span aria-hidden="true">{icon}</span>
        {label}
      </NavLink>
    </li>
  );
}

/*
 * 아이콘 — 인라인 SVG(외부 아이콘 의존 없음). 전부 `currentColor` 스트로크라 활성/비활성 색을
 * 부모가 결정한다. 아이콘 단독으로 정보를 전달하지 않는다(라벨 필수 병기).
 */
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function HomeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1V8.5Z" />
    </svg>
  );
}

/** 경매 = 낙찰봉. 마감의 은유이자 이 제품의 1차 동사다. */
function GavelIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="m4 16 6-6M8.5 5.5 14.5 11.5M11.5 2.5 17.5 8.5M7 9 11 5" />
      <path d="M3 17.5h6" />
    </svg>
  );
}

/** 고정가 = 가격표. 값이 이미 정해져 있다는 뜻을 형태로 갖는다. */
function TagIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 3.8v5.6a1 1 0 0 0 .3.7l6.6 6.6a1 1 0 0 0 1.4 0l5.3-5.3a1 1 0 0 0 0-1.4L10 3.4a1 1 0 0 0-.7-.3H3.8a.8.8 0 0 0-.8.7Z" />
      <circle cx="6.6" cy="6.6" r="1.1" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c0-3 2.7-4.8 6-4.8s6 1.8 6 4.8" />
    </svg>
  );
}
