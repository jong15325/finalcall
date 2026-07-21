import { Link } from 'react-router'
import { paths } from '@/app/paths'

/** 로그인 — 빈 셸(FC-069에서 폼·JWT 세션 구현). */
export default function LoginPage() {
    return (
        <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">로그인</h1>
            <p className="mt-2 text-sm text-gray-500">
                로그인 폼은 FC-069에서 구현됩니다.
            </p>
            <p className="mt-6 text-sm text-gray-500">
                계정이 없으신가요?{' '}
                <Link
                    to={paths.signup}
                    className="font-semibold text-orange-deep hover:underline"
                >
                    회원가입
                </Link>
            </p>
        </div>
    )
}
