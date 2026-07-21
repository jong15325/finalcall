import { Link } from 'react-router'
import { paths } from '@/app/paths'

/** 회원가입 — 빈 셸(FC-069에서 폼·클라 검증 구현). */
export default function SignupPage() {
    return (
        <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">회원가입</h1>
            <p className="mt-2 text-sm text-gray-500">
                가입 폼은 FC-069에서 구현됩니다.
            </p>
            <p className="mt-6 text-sm text-gray-500">
                이미 계정이 있으신가요?{' '}
                <Link
                    to={paths.login}
                    className="font-semibold text-orange-deep hover:underline"
                >
                    로그인
                </Link>
            </p>
        </div>
    )
}
