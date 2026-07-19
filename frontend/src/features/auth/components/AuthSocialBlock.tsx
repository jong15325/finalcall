import { useId } from 'react';
import { SocialLoginButton } from '@/components/ui/SocialLoginButton';

/**
 * AuthSocialBlock — "또는" 구분선 + 소셜 버튼 2개 + 비활성 사유 안내([5.11], FC-043 결정 ④).
 *
 * 자리 확보 근거는 `SocialLoginButton` 주석에 있다. 여기서는 배치만 책임진다 — 주 CTA 아래 구분선,
 * 그 아래 세로 스택, 그 아래 안내문 한 줄. 안내문은 두 버튼의 `aria-describedby` 대상이다
 * (**사유 없는 비활성은 금지**다 — 왜 못 누르는지가 반드시 문장으로 있어야 한다).
 *
 * ★ "또는"은 문장이 아니라 **라벨**이라 `text-label`(11/700/+0.12em)로 통일한다.
 * ★ 모바일에서 버튼 간격을 벌린다: 높이 46px 은 [5.11] 스펙값이라 바꿀 수 없으니 엄지 오탭은
 *   간격으로 줄인다.
 */
interface AuthSocialBlockProps {
  kakaoLabel: string;
  naverLabel: string;
  note: string;
}

export function AuthSocialBlock({ kakaoLabel, naverLabel, note }: AuthSocialBlockProps) {
  const noteId = useId();

  return (
    <>
      <div
        role="separator"
        className="my-6 flex items-center gap-3 text-label text-text-subtle before:h-px before:flex-1 before:bg-border before:content-[''] after:h-px after:flex-1 after:bg-border after:content-['']"
      >
        또는
      </div>

      <div className="flex flex-col gap-3 min-[720px]:gap-2">
        <SocialLoginButton provider="kakao" label={kakaoLabel} describedBy={noteId} />
        <SocialLoginButton provider="naver" label={naverLabel} describedBy={noteId} />
      </div>

      <p id={noteId} className="mt-3 text-body text-text-subtle">
        {note}
      </p>
    </>
  );
}
