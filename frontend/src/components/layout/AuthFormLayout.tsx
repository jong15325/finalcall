import { Link, Navigate, Outlet } from 'react-router-dom';
import { Wordmark } from '@/components/layout/Wordmark';
import { useIsAuthenticated } from '@/stores/authStore';
import { ROUTES } from '@/routes/paths';

/**
 * 인증 폼 레이아웃 (login·signup) — **최소 셸**(FC-043 결정 ①, FC-050 집행).
 *
 * 종전 이 레이아웃은 "내비 0 + 우상단 테마 토글 + 가운데 max-w-sm 상자"였다. 폼 이탈을 막겠다는
 * 의도는 타당하지만 부작용이 둘이었다.
 *   (a) **돈을 다루는 제품에서 브랜드 없는 로그인 화면은 피싱 화면과 구별되지 않는다.** 사용자가
 *       "여기가 FinalCall 이 맞나"를 확인할 수단이 워드마크다. 인증 화면은 브랜드가 가장 필요한
 *       화면이지 가장 덜 필요한 화면이 아니다.
 *   (b) 홈에서 "로그인"을 누르면 크롬이 통째로 사라져 다른 제품으로 넘어간 것처럼 읽힌다.
 * 그래서 "내비 0"이 아니라 **최소 셸**로 간다 — 이탈 경로는 계속 억제한다. 헤더는 워드마크 1개뿐이고
 * (홈 헤더의 축약형임이 높이로 읽힌다), 폼 전환 링크는 카드 하단 **한 곳**에만 둔다.
 *
 * ★ `AppShell` 을 쓰지 않는 이유: AppShell 은 검색·카테고리 내비·판매 CTA·모바일 탭바까지 얹은
 *   **전체 셸**이라 인증 화면에 그대로 쓰면 이탈 경로가 20개 넘게 열린다. 여기서 필요한 건 같은
 *   언어의 축약형이다 — 워드마크는 `Wordmark` 단일 출처를 공유해 브랜드 표현이 갈라지지 않는다.
 *
 * ★ **정책 링크를 만들지 않는다.** 목업 푸터는 이용약관·개인정보처리방침·고객센터를 `href="#"` 로
 *   뒀지만 대응 라우트가 없어 실코드에서는 전부 죽은 링크가 된다. `SiteFooter`(FC-041)가 같은 이유로
 *   링크 열을 들어낸 선례를 따른다 — 계정을 만드는 화면에서 죽은 정책 링크는 없는 것보다 나쁘다.
 *
 * ★ 테마 토글 제거: 다크값은 U-005 확정 전까지 만들지 않는다([2.6]). AppShell 에도 토글이 없어
 *   인증 화면에만 남아 있으면 이 화면만 다른 규칙을 쓰는 것으로 읽힌다.
 */
const CONTAINER = 'mx-auto w-full max-w-[1080px] px-4 min-[720px]:px-6';

export function AuthFormLayout() {
  const isAuthed = useIsAuthenticated();
  if (isAuthed) return <Navigate to={ROUTES.home} replace />;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* 키보드 첫 정지점 — 포커스되면 보여야 한다(2.4.7). 숨은 채로만 두면 키보드 사용자에게는
          "포커스가 사라진" 것으로 보인다. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-body focus:text-primary-fg"
      >
        본문 바로가기
      </a>

      {/* 홈 헤더는 2행이고 여기는 1행이다 — 같은 언어의 축약형임이 형태로 읽힌다 */}
      <header className="flex-none border-b border-border bg-surface">
        <div className={CONTAINER}>
          <div className="flex h-14 items-center min-[720px]:h-[68px]">
            <Link to={ROUTES.home} aria-label="FinalCall 홈">
              <Wordmark />
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 py-8 min-[720px]:py-12 min-[961px]:py-20">
        <div className={CONTAINER}>
          <Outlet />
        </div>
      </main>

      <footer className="flex-none border-t border-border bg-surface-band">
        <div className={CONTAINER}>
          <div className="flex flex-wrap items-center justify-between gap-4 py-6">
            <p className="m-0 text-micro text-text-subtle">
              © 2026 FinalCall. All rights reserved.
            </p>
            <p className="m-0 max-w-[52ch] text-micro text-text-muted">
              FinalCall은 이용자 간 게임 아이템 거래를 중개하는 통신판매중개자이며, 개별 거래의
              당사자가 아닙니다.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
