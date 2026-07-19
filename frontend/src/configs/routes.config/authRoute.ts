import { ROUTES } from './paths'
import { placeholderRoute } from './placeholderRoute'
import type { Routes } from '@/@types/routes'

/**
 * 비로그인 전용 라우트 (FC-055).
 *
 * ★ 경로는 우리 화면 스펙의 `/login`·`/signup` 이다 — 템플릿 기본값 `/sign-in`·`/sign-up` 을
 *   쓰지 않는다. 이 경로는 이미 스펙·리턴 URL 로직이 참조하는 값이라 템플릿 관례보다 우선한다.
 *
 * ★ 템플릿의 `forgot-password`·`reset-password`·`otp-verification` 은 **넣지 않았다.**
 *   계약(§2)에 해당 엔드포인트가 없다 — 화면만 있고 뒤가 없는 경로를 만들지 않는다.
 *   백엔드가 생기면 그때 추가한다.
 */
const authRoute: Routes = [
    placeholderRoute('login', ROUTES.login, '로그인'),
    placeholderRoute('signup', ROUTES.signup, '회원가입'),
]

export default authRoute
