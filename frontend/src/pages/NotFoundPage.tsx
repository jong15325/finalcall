import { Link } from 'react-router'
import { paths } from '@/app/paths'

/** 404 — 없는 경로. 준비 중 화면과 구분되는 진짜 404. */
export default function NotFoundPage() {
    return (
        <section className="flex flex-col items-center justify-center py-10 text-center sm:py-14">
            <p className="text-6xl font-black text-brand-structure">404</p>
            <h1 className="mt-4 text-xl font-bold text-content-fg">
                페이지를 찾을 수 없습니다
            </h1>
            <p className="mt-2 text-sm text-content-subtle">
                주소가 바뀌었거나 삭제된 페이지입니다.
            </p>
            <Link
                to={paths.home}
                className="mt-6 rounded-lg bg-control-action px-5 py-2.5 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
            >
                홈으로 돌아가기
            </Link>
        </section>
    )
}
