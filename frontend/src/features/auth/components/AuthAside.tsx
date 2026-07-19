import { useEffect, useId, useState } from 'react';

/**
 * AuthAside — 보조 설명 열(FC-043 결정 ②·⑧).
 *
 * **데스크톱에서는 병렬 열, 모바일에서는 접힌 아코디언이다.** 이 블록의 존재 이유는 "데스크톱 우측의
 * 빈 열을 장식이 아니라 정보로 채운다"였다. 모바일에는 그 빈 열이 애초에 없다 — 이유가 사라진 콘텐츠를
 * 그대로 세로로 쌓으면 폼과 푸터 사이에 아무도 읽지 않는 300px 짜리 죽은 스크롤이 생긴다. 그래서
 * 모바일에서는 **형식 자체를 바꾼다**(점진적 공개). 접는 게 아니라 다시 짜는 것이다.
 *
 * ★ `details` 를 쓰는 이유: 열림 상태가 마크업에 있어 JS 없이도 접근 가능하고, 두 폭 모두 같은 제목·
 *   같은 본문으로 노출된다(콘텐츠 소실 없음). matchMedia 로 폭 변화에도 맞춘다 — 데스크톱에서 접힌 채
 *   남으면 병렬 열의 존재 이유가 사라진다. 모바일 구간에서는 `open` 을 넘기지 않아 사용자 토글을
 *   그대로 둔다(제어 컴포넌트로 만들면 사용자가 열어도 리렌더에 되감긴다).
 *
 * ★ 제목이 왜 `text-label`(11px)인가: 보조 열의 제목은 "여기부터 이런 얘기"라는 **라벨**이다. 여기서
 *   제목을 키우면 폼 카드의 활자들과 무게를 다툰다. 라벨을 내리고 항목 제목을 값 축(17px)에 올리면
 *   열 안에서도 라벨/값 대비가 반복된다([3.1] 원칙 2).
 */
export interface AuthAsideRule {
  title: string;
  body: string;
}

export function AuthAside({ title, rules }: { title: string; rules: AuthAsideRule[] }) {
  const headingId = useId();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 719px)');
    const sync = (): void => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <aside aria-labelledby={headingId} className="min-[961px]:pt-3">
      <details
        open={isMobile ? undefined : true}
        className="group max-[719px]:border-y max-[719px]:border-border"
      >
        {/*
          데스크톱에서는 조작 요소가 아니다 — 커서·캐럿을 지워 "누를 수 있는 것"처럼 보이지 않게 한다.
          ★ 토글도 실제로 막는다: `open` 이 React 소유라 클릭으로 DOM 만 닫히면 상태가 그대로여서
            리렌더가 일어나지 않고 열이 **닫힌 채 영영 남는다**(제어/비제어가 갈리는 지점).
        */}
        <summary
          onClick={(e) => {
            if (!isMobile) e.preventDefault();
          }}
          className="flex list-none items-center gap-3 [&::-webkit-details-marker]:hidden max-[719px]:min-h-12 max-[719px]:cursor-pointer max-[719px]:py-4 min-[720px]:mb-6 min-[720px]:cursor-default"
        >
          <h2 id={headingId} className="text-label text-text-subtle">
            {title}
          </h2>
          <svg
            className="ml-auto h-[18px] w-[18px] flex-none text-text-muted transition-transform duration-fast group-open:rotate-180 min-[720px]:hidden"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5.5 8l4.5 4.5L14.5 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>

        <ul className="flex flex-col max-[719px]:pb-4 max-[719px]:pt-5">
          {rules.map((rule) => (
            <li
              key={rule.title}
              className="border-t border-border py-5 first:border-t-0 first:pt-0"
            >
              <h3 className="text-value text-text">{rule.title}</h3>
              <p className="mt-2 max-w-[46ch] text-body text-text-muted">{rule.body}</p>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
