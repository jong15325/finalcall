import { Link } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text">
      {/* "404"는 숫자지만 수치가 아니라 이 화면의 제목이다 — `text-figure`(수치 전용)를 빌려 쓰지 않는다([3.2]). */}
      <p className="text-title">404</p>
      <p className="text-body text-text-muted">요청한 페이지를 찾을 수 없습니다.</p>
      <Link
        to={ROUTES.home}
        className="inline-flex items-center justify-center rounded-md bg-ink px-4 py-2 text-body font-medium text-primary-fg transition-colors duration-fast hover:bg-[#33333a] active:bg-black"
      >
        홈으로
      </Link>
    </div>
  );
}
