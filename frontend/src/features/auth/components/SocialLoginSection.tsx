import { useSearchParams } from 'react-router'
import SocialLoginButton from '@/components/common/SocialLoginButton'
import { isProviderConfigured, startOAuth } from '@/features/auth/lib/oauth'
import { sanitizeReturnUrl } from '@/lib/returnUrl'
import { REDIRECT_URL_KEY } from '@/constants/app.constant'

/**
 * 소셜 로그인 진입 블록 (FC-155 · design-system §5.11).
 *
 * ★ 로그인·회원가입 두 화면이 같은 배치를 쓰도록 한 곳에 모은다 — 주 CTA 아래 "또는" 구분선 +
 *   카카오·네이버 버튼 세로 스택. 로그인/가입은 find-or-create 통합이라 라벨은 양쪽 모두 "계속하기".
 * ★ 버튼 클릭 → provider 인가 페이지로 이동(state 생성·세션 보관은 `startOAuth`). env(client_id)
 *   미설정 provider 는 비활성으로 낮추고, 하나라도 미설정이면 안내문을 병기한다.
 */
export default function SocialLoginSection() {
    const [searchParams] = useSearchParams()
    const returnPath = sanitizeReturnUrl(searchParams.get(REDIRECT_URL_KEY))
    const kakaoReady = isProviderConfigured('kakao')
    const naverReady = isProviderConfigured('naver')
    const anyUnready = !kakaoReady || !naverReady

    return (
        <>
            <div
                className="my-5 flex items-center gap-3 text-xs font-bold tracking-wide text-content-subtle"
                role="separator"
            >
                <span className="h-px flex-1 bg-content-line" />
                또는
                <span className="h-px flex-1 bg-content-line" />
            </div>

            <div className="flex flex-col gap-2.5">
                <SocialLoginButton
                    provider="kakao"
                    disabled={!kakaoReady}
                    onClick={() => startOAuth('kakao', returnPath)}
                />
                <SocialLoginButton
                    provider="naver"
                    disabled={!naverReady}
                    onClick={() => startOAuth('naver', returnPath)}
                />
            </div>

            {anyUnready && (
                <p className="mt-3 text-center text-xs text-content-subtle">
                    소셜 로그인은 준비 중입니다.
                </p>
            )}
        </>
    )
}
