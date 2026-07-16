import { Link } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text">
      <p className="text-3xl font-bold">404</p>
      <p className="text-sm text-text-muted">요청한 페이지를 찾을 수 없습니다.</p>
      <Link
        to={ROUTES.home}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-fg transition-colors duration-fast hover:bg-primary-600"
      >
        홈으로
      </Link>
    </div>
  );
}
