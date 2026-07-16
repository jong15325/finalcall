import { Link } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';

/**
 * 회원가입 화면 placeholder.
 * 실제 폼(loginId·password·password 확인·nickname, P-009)·가입 후 `/login` 이동(P-010)은
 * auth feature 단계에서 구현한다. 비밀번호 확인 필드는 클라 일치 검증 전용·서버 미전송(계약 [2] body 불변).
 */
export function SignupPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text">회원가입</h1>
      <p className="text-sm text-text-muted">
        회원가입 폼은 auth feature 단계에서 구현됩니다(스켈레톤 placeholder).
      </p>
      <p className="text-sm text-text-muted">
        이미 계정이 있나요?{' '}
        <Link to={ROUTES.login} className="text-text underline">
          로그인
        </Link>
      </p>
    </section>
  );
}
