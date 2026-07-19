import { useLocation } from 'react-router'
import LinkButton from '@/components/shared/LinkButton'
import { ROUTES } from '@/configs/routes.config'

/**
 * 전용 404 화면 (FC-055 발견 1 · FC-056 발견 4 해소 — FC-057).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **주소를 갈아끼우지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전 catch-all 은 `<Navigate to="/" />` 라 오타 URL 이 **조용히 홈으로** 바뀌었다.
 * 그러면 손님은 (1) 자기가 뭘 잘못 쳤는지 모르고 (2) 주소창이 홈이라 되돌아가 고칠 수도 없고
 * (3) 공유받은 링크가 깨진 것인지 우리가 화면을 지운 것인지 구분하지 못한다.
 * 그래서 **주소는 그대로 두고** 화면으로 알린다 — 친 주소를 그대로 보여줘 오타를 눈으로 찾게 한다.
 *
 * ★ 인증 문제와 구분된다: 없는 페이지는 401/403 이 아니다. FC-055 가 catch-all 을
 *   `ProtectedRoute` 밖으로 뺐고(비로그인 오타가 로그인 화면으로 튕기던 문제), 이 화면이
 *   그 자리를 채운다.
 *
 * ★ 셸 안에서 렌더된다 — 헤더·내비가 그대로 있어 여기서 곧장 다른 곳으로 갈 수 있다.
 *   출구를 아래 CTA 로만 두지 않는 이유다.
 *
 * ★ SPA 라 HTTP 상태코드는 200 이다. 크롤러 관점의 soft-404 는 SSR/프리렌더가 생겨야
 *   해결되는 별개 사안이다(범위 밖 — 보고).
 */
const NotFound = () => {
    const { pathname } = useLocation()

    return (
        <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
            <p className="text-5xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                404
            </p>

            <div className="flex flex-col gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    요청하신 페이지를 찾을 수 없습니다
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    주소가 잘못됐거나 페이지가 이동했을 수 있습니다.
                </p>
            </div>

            {/* 친 주소를 그대로 되비춘다 — 오타는 눈으로 찾는 게 가장 빠르다. */}
            <p
                data-testid="requested-path"
                className="max-w-full break-all rounded-md bg-gray-100 px-3 py-2 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
                {pathname}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
                <LinkButton to={ROUTES.home}>홈으로</LinkButton>
                <LinkButton variant="solid" to={ROUTES.auctions}>
                    경매 둘러보기
                </LinkButton>
            </div>
        </div>
    )
}

export default NotFound
