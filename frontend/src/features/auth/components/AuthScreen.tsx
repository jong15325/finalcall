import type { ReactNode } from 'react';

/**
 * AuthScreen — 로그인·회원가입이 공유하는 본문 골격(FC-043 결정 ②, FC-050 집행).
 *
 * **[좌: 폼 460px] + [우: 보조 설명 1fr]** 이다. 종전은 정중앙 `max-w-sm` 한 덩어리라 화면의 80%가
 * 빈 캔버스였다. 대안이던 (a) 정중앙 유지 · (b) 전면 분할(좌 이미지)은 각각 "여전히 비어 있음" ·
 * "쓸 이미지가 없음(게임 아트를 끌어오면 [1.2] Containment 위반)"으로 기각됐다. 채택안은
 * **빈 공간을 장식이 아니라 정보로 채우는 것**이다 — 우측 열에 실제 도메인 규칙(홀드·소프트클로즈·
 * 정산)을 적는다. 조작된 다급함이 아니라 사실이라 "정직한 설득" 원칙 그대로다.
 *
 * ★ 폼이 왜 좌측인가 (통상 커머스는 우측 폼이 많다): accessibility [3] 이 "DOM 순서 = 시각 순서"를
 *   요구한다. 설명을 좌측에 두면 DOM 상 폼보다 먼저 와서 스크린리더·키보드 사용자가 보조 설명을 먼저
 *   통과해야 한다. 폼을 먼저 두면 DOM·시각·포커스가 셋 다 일치하고, 모바일 1열에서도 폼이 최상단이라
 *   스크롤 없이 바로 조작된다. ※ 좌/우 배치는 **사용자 판단 대기**이며(FC-043 미결 4건 중 하나)
 *   어느 쪽으로 확정돼도 반응형 설계는 그대로 성립한다 — 바뀌는 것은 데스크톱 그리드의 열 순서뿐이다.
 *
 * ★ h1 을 카드 **밖**에 둔다: 카드 안에 넣으면 카드가 "제목 + 폼" 두 역할을 겸해 조작 영역의 경계가
 *   흐려진다. 밖으로 빼면 흰 카드는 순수하게 "입력하고 누르는 곳"이 된다.
 *
 * ★ 층 구조가 인상을 결정한다([2.1]): 페이지 `bg` 위에 순백 카드가 shadow-md 로 뜨고, 카드 안의
 *   인풋은 다시 함몰면으로 내려간다. 세 단(함몰 < 페이지 < 카드)이 좁은 폭 안에서 만들어져
 *   "흰 종이 한 장"이 되지 않는다.
 *
 * 경계값 960/961 은 그리드가 1열이 되는 축이고, 719/720 은 모바일 IA(sticky CTA·아코디언·오토포커스)
 * 축이다 — **별개의 두 축**이다. 720~960 구간은 "1열 데스크톱"이며 모바일 IA 를 쓰지 않는다
 * (포인터 입력이고 소프트 키보드가 화면을 가리지 않는다).
 */
interface AuthScreenProps {
  title: string;
  description: string;
  /** 우측 보조 설명 열(`AuthAside`). */
  aside: ReactNode;
  /** 흰 폼 카드 안에 들어갈 것 — 배너 · 폼 · OAuth · 전환 링크. */
  children: ReactNode;
}

export function AuthScreen({ title, description, aside, children }: AuthScreenProps) {
  return (
    <div className="mx-auto grid max-w-[460px] items-start gap-12 min-[961px]:mx-0 min-[961px]:max-w-none min-[961px]:grid-cols-[460px_minmax(0,1fr)] min-[961px]:gap-20">
      <div>
        <div className="mb-6">
          {/* 페이지 제목은 화면당 1개다([3.2]). ≤719px 축소는 index.css 가 중앙에서 처리한다. */}
          <h1 className="text-title text-text">{title}</h1>
          <p className="mt-3 text-body text-text-muted">{description}</p>
          {/* 마감선 — 워드마크의 퍼플 2px 마감선과 같은 모티프다. 브랜드와 화면이 한 언어를 쓴다. */}
          <div className="mt-5 h-0.5 w-10 bg-primary" aria-hidden="true" />
        </div>

        <div className="rounded-lg border border-border bg-surface px-5 py-6 shadow-md min-[720px]:p-8">
          {children}
        </div>
      </div>

      {aside}
    </div>
  );
}
