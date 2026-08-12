---
theme: light
register: product
contract: docs/spec/frontend-ui-system-contract.md
brand:
  navy: "#16213A"
  navy-strong: "#101A2E"
  gold: "#C8A028"
  action: "#EF8A2C"
surface:
  content: "#FFFFFF"
  canvas: "#F4F5F8"
text:
  fg: "#171A20"
  muted: "#4D5461"
  subtle: "#6B7484"
---

# FinalCall Design

구현 정본은 `docs/spec/frontend-ui-system-contract.md` v1.0이다. 이 파일은 impeccable용 제품 디자인 요약이며 토큰 값을 별도로 결정하지 않는다.

## 방향

FinalCall은 돈이 오가는 게임 아이템 거래처다. 고정 commerce chrome은 navy로 신뢰와 구조를 만들고, gold는 브랜드 강조와 dark chrome의 focus 보조, orange는 주요 CTA와 활성 조작에만 쓴다. 퍼플 브랜드 역할과 블랙 CTA 역할은 폐기됐다. 본문 near-black은 중립 전경이므로 계속 허용한다.

route element accent는 AppShell의 단일 world-map 장식과 route가 명시한 `RouteAccentScope` 콘텐츠에만 도달한다. header, desktop/mobile navigation, drawer, footer, CompareBar는 route나 API 응답에 따라 재색되지 않는다.

## 시스템 규칙

- 런타임 토큰 registry는 `frontend/src/styles/tokens.css` 하나다.
- 컴포넌트는 `chrome-*`, `content-*`, `control-*`, `brand-*` 역할형 utility를 소비한다.
- 금액·잔액·카운트다운·수량은 tabular 숫자로 안정적으로 표시한다.
- 목록은 `ListFrame`이 heading, filter, result, loading/error/empty/ready, pagination 순서를 소유한다.
- 아이템 카드는 `ItemCardView`, controlled `ItemCardFlip`, `ItemCardActionSurface`로 표시와 상호작용을 분리한다.
- element 색은 아이템 표시와 route 장식에서만 쓰고, 색에는 항상 라벨이나 아이콘을 병기한다.

## 접근성

WCAG 2.1 AA를 기준으로 본문 4.5:1, 대형 텍스트와 UI 경계 3:1을 만족한다. 모든 주 행동은 native link 또는 button이며, flip은 `aria-expanded`와 `aria-controls`, dialog trigger는 `aria-haspopup="dialog"`를 제공한다. focus는 `control-focus` 2px ring과 offset을 쓴다.

## 금지

- route selector로 chrome 후손의 text/background/border를 포괄 재색하지 않는다.
- 퍼플을 브랜드/선택/focus에, 블랙을 CTA 채움에 재도입하지 않는다.
- 전체 카드 absolute overlay가 flip·compare·footer action을 덮지 않는다.
- 페이지별 loading grid, empty wrapper, footer 상태 effect를 다시 만들지 않는다.
