import BrandWordmark from '@/components/brand/BrandWordmark'
import { APP_NAME } from '@/constants/app.constant'

/**
 * 셸 푸터 (FC-057).
 *
 * ★ 템플릿 `components/template/Footer.tsx` 를 쓰지 않았다. 그쪽은 "Ecme" 저작권 문구와
 *   **`onClick={(e) => e.preventDefault()}` 로 막아둔 링크 2개**("Term & Conditions",
 *   "Privacy & Policy")를 갖는다 — 누르면 아무 일도 없는 컨트롤이라 §5.2 위반이다.
 *   없는 문서를 링크로 약속하지 않는다. 생기면 그때 넣는다.
 *
 * ★ 워드마크는 여기서도 `BrandWordmark` 를 부른다(단일 출처).
 */
const AppFooter = () => (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2 px-6 py-8">
            <BrandWordmark size="sm" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
                게임 아이템 경매 플랫폼 · 포트폴리오 프로젝트
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                &copy; {new Date().getFullYear()} {APP_NAME}
            </p>
        </div>
    </footer>
)

export default AppFooter
