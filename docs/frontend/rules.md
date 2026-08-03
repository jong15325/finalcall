# 프론트 규칙 (F)

FinalCall 모노레포(D-098) `frontend/` 웹 클라이언트의 파트 지침이다.
협업 규약은 `docs/common/rules.md`, 형식은 `docs/common/templates.md`를 따른다.

- **★ 먼저 읽어라 — `[8] 역할 경계`**: F는 설계만 하고 **코드는 CC가 쓴다.** 절 번호가 뒤인 것은
  중요도가 아니라 발번 순이다(append-only).
- **소유·개정**: 프론트 제안 + 컨설턴트 승인. 개정하면 덮어쓴다(불변 아님, 이력은 git).
- 이관 2026-07-16: `docs/frontend/CLAUDE.md` → 이 파일(C-073 [3]) ·
  **D-098 모노 전환으로 repo 루트 이관 항 소멸(D-039·D-096 사망) · 계약 복사본 항 소멸(D-007·D-030 사망).**

## 1. 프로젝트 정보

- FinalCall 게임 아이템 경매 플랫폼의 웹 클라이언트.
- 스택(D-032 확정): TypeScript(strict) + React SPA(Vite) + TanStack Query + Zustand
  + Tailwind CSS. SSR 미도입.
- 유일한 API 기준: **`docs/spec/api-contract.md` (정본 직접 참조).**
  **복사본을 만들지 않는다** — D-007·D-030 사망(D-098 모노라 정본이 같은 트리에 있다).

## 2. Claude Code 행동 규약

- 커밋·푸시는 사용자가 직접 한다. Claude Code는 컨벤션(`CLAUDE.md [6]`)에 따른 커밋 메시지를 제안한다.
- 응답·주석·문서는 한국어.
- 계약에 없는 API를 추측으로 사용하지 않는다. 스펙 공백 발견 시 구현을 멈추고
  프론트 대화로 보고한다(→ 총괄 결정 요청 격상, 선착순 기준 금지 — D-028).
- 변경 전 관련 파일을 읽고 기존 컨벤션과 일치 확인.
- 시크릿·API 키를 코드·커밋에 넣지 않는다.

## 3. 프로젝트 구조 (feature 기반)

```
src/
├── features/<도메인>/     # auction, bid, item, member ... 도메인별 응집
│   ├── api/               # 해당 도메인 API 함수 + TanStack Query 훅
│   ├── components/        # 도메인 전용 컴포넌트
│   └── hooks/             # 도메인 전용 훅
├── components/            # 도메인 무관 공용 컴포넌트
├── stores/                # Zustand 전역 스토어 (최소한으로)
├── lib/                   # api 클라이언트, 유틸
├── types/                 # 공용 타입 (계약 스키마 대응 타입 포함)
└── pages/ (또는 라우트 정의)
```

- 파일이 어느 도메인에 속하는지 애매하면 공용이 아니라 도메인 쪽에 둔다(공용 승격은 두 번째 사용처가 생길 때).

## 4. 상태 관리 원칙

- 서버 데이터는 전부 TanStack Query. Zustand·useState에 서버 응답을 복제 저장하지 않는다
  (동기화 버그의 근원). 쿼리 키는 `[도메인, 리소스, 파라미터]` 배열 규약.
- Zustand는 진짜 전역만: 인증 세션, 테마 등. 한 컴포넌트 트리에서만 쓰는 상태는 로컬 state.
- 실시간 최고가 갱신 등 폴링/구독 전략은 계약 확정 후 F-xxx로 결정하고 기록한다.

## 5. 코드 컨벤션

- 컴포넌트 PascalCase(.tsx), 훅 use 접두, 유틸 camelCase. named export 우선.
- API 함수는 계약의 엔드포인트 단위 1:1. 응답은 공통 ApiResponse<T> 타입으로 언랩.
- 에러 처리: 계약의 에러 코드({DOMAIN}_{3자리})를 상수화해 분기. try-catch 산발 금지 —
  Query의 error 경로 + 전역 에러 바운더리.
- 시간: 서버는 Instant(UTC, ISO-8601) — 수신 그대로 보관, 표시 시점에만 로컬 변환.
- 스타일: Tailwind 유틸 우선. 전역 CSS는 토큰(색·간격) 정의로 한정.
- any 금지(불가피하면 사유 주석), strict 유지.

## 6. Git

- Conventional Commits + 한국어 제목, 본문 템플릿은 `CLAUDE.md [6]`과 동일.
- 스켈레톤기 main 직접 → 도메인 개발기 feature/<도메인> → PR → main(Squash and Merge).
- 스켈레톤 커밋: `chore(skeleton): stage N - 설명`.

## 7. 문서·결정

- 프론트 결정 로그(F-xxx)·노트·outbox는 `docs/frontend/` (문서 허브 단일화).
- 에스컬레이션 4기준·메시지 형식은 협업 가이드 준수.

## 8. 역할 경계 — 코드는 프론트 대화가 쓰지 않는다

**절 번호가 8인 이유**: 신설은 최대 번호 + 1이다(`templates [13]` — append-only).
**중요도 순이 아니라 발번 순이다.** 2절에 끼우면 기존 3~7절이 밀리고, `outbox/006`·`007`·
`cc-reports/006`이 인용한 `[3]~[6]`이 **전부 실재하는 다른 절을 가리키게 된다** — 결번도 중복도 아니라
실패 신호가 없다. **읽는 순서가 아니라 인용이 기준이다.**

- **프론트 대화(F)는 설계만 한다.** 산출물 = 결정(F-xxx)·작업 프롬프트·계약 정합 판정·CC 보고 흡수·발신.
- **코드 작성·편집은 전부 Claude Code가 한다**(`rules [9.20]` — CC는 F의 '손'이다).
  F는 `frontend/**` 를 **읽기만 한다.** 실측·판정·지시서 작성이 그 읽기의 목적이다.
- **D-098 모노 전환으로 F가 코드를 편집할 수 있게 됐다. 접근이 생긴 것이지 권한이 생긴 것이 아니다.**
  경계는 저장소가 갈라져서 생긴 것이 아니라 역할이 갈라져서 있다 — 모노가 돼도 안 바뀐다.
- **아래는 예외 사유가 아니다**: 작아 보임 · 판단 여지가 없음 · 지시서 쓰는 비용이 편집 비용과 비슷함 ·
  이미 파일을 읽어 둠 · 사용자가 "알아서 진행해"라고 함(**그건 집행 재량이지 역할 변경 승인이 아니다**).
- F가 `frontend/**` 에 쓰는 경우는 없다. F의 쓰기 범위는 `docs/frontend/` 뿐이다(`rules [3.2]`).
근거: 사용자 지시(2026-07-16) · `rules [9.20]`~`[9.24]` · D-069 · F-004

## 9. 카드 정본 규약 (EPIC-CARD-SYSTEM)

**절 번호가 9인 이유**: 신설은 최대 번호 + 1이다(§8 주석·`templates [13]` append-only). 중요도가 아니라 발번 순이다.

**발단**: 페이지마다 카드 영역을 재구현해 "똑같이"가 매번 다르게 나왔다(사용자 피드백 2026-08-04). 그리드 문자열·모달 chrome·래퍼/오버레이 버튼이 복붙되고(member가 shop을 베낌), prop boolean이 가법으로 누적되며, 소비자가 feature 경계를 가로질러 손을 뻗어(member→shop·shop→auction) 그래프가 얽혔다. 근거·진단 = `docs/common/proposals/card-system-consolidation-proposal-v0.1.md` §1. 이 절은 그 §2.5 규약을 성문화한다.

### 9.1 정본 컴포넌트를 쓴다 (표면 재구현 금지)

- **새 카드/카드정보/그리드 표면은 `item`의 정본 컴포넌트를 쓴다** — `ItemCard`(세로 카드 본체)·`ItemCardTile`(래퍼+전면 오버레이 버튼+비교+footer로 감싼 상호작용 표면)·`CardInfoDialog`(카드정보 모달 셸)·`ItemCardGrid`(반응형 그리드+스켈레톤).
- **재작성 금지 대상**: `.shop-card` 류 래퍼, `absolute inset-0 z-10` 전면 오버레이 버튼, 그리드 클래스 문자열(`grid grid-cols-… min-[1200px]:grid-cols-…`), 모달 배선(초점트랩·스크롤락·Esc·backdrop), 카드 카피(이름 클램프·가격 줄·스킬 요약)를 페이지·소비자 컴포넌트에서 손으로 다시 쓰지 않는다.
- **소비자는 얇은 어댑터로 축소한다**: 도메인 요약 → 카드 데이터 매핑 + variant 선택 + slot 주입까지만 한다. 셸·chrome을 소유하지 않는다.
- **예외 = 진짜 새 *형태***: 가로 경매 카드처럼 렌더트리가 실제로 다른 형태는 별도 컴포넌트로 둔다(정본에 `layout` boolean으로 욱여넣지 않음). 규칙은 "같은 *형태* 표면은 정본을 쓴다"이지 "모든 것을 한 컴포넌트로"가 아니다. 공유는 하위 프리미티브(스킬 요약·가격 줄·상태배지·프레임 아트) 추출로 한다. (proposal §2.4)

### 9.2 카드 크로스 feature 의존은 → `item` 단방향만

- `item`이 유일 카드 커널이다. **`shop`·`auction`·`member` → `item` 단방향 임포트만 허용**한다.
- **금지**: 역방향·측면 임포트 — `shop→auction`(비교 오버레이), `member→shop`(카드정보 CSS·channelLimit) 등 feature 경계를 가로지르는 카드 관련 임포트. 필요한 공유 자산은 `item`으로 승격해서 소비한다(전역 store는 cross-cutting이라 예외).

### 9.3 맥락 차이는 variant + slot으로 흡수 (boolean 추가 중단)

- 맥락(마켓/인벤토리/내판매 등)이 늘 때 **boolean prop을 추가하지 않는다**. `hidePrice`·`skillFlip` 식 가법 boolean은 prop 폭발의 시작이며 "같은 디자인"이 어느 boolean을 넘겼는지에 갈리게 한다(reviewer FC-178 지적).
- 대신 **variant(레이아웃·타이포·flip 프리셋) + nullable 값(가격 부재=줄 없음) + slot(`footer`/`overlay`/`detailLink`)**으로 흡수한다. 기존 slot 확장점은 유지하고 boolean 신설만 중단한다.
- **구매 뮤테이션 등 feature 결합은 공유 셸에 올리지 않는다** — `CardInfoDialog`의 footer 슬롯으로 소비자가 주입한다(FC-178이 포크를 택한 결합을 슬롯 seam으로 해소). (proposal §2.3·§2.4)

### 9.4 강제 방식

- **(a) reviewer 체크리스트(상시·차단성 판정)**: 카드/그리드/모달을 건드리는 티켓 리뷰 시 두 항목을 확인한다 —
  1. **카드 표면 재구현 여부**: 래퍼·전면 오버레이 버튼·그리드 클래스 문자열·모달 배선을 페이지/소비자가 다시 썼는가(정본을 우회했는가).
  2. **크로스 임포트 방향**: 카드 관련 임포트가 `→ item` 단방향인가(역방향·측면 임포트가 새로 생겼는가).
- **(b) ESLint `no-restricted-imports`(nice-to-have·비차단)**: 가능하면 feature→feature 카드 임포트(→`item` 외)를 기계 금지하고 그리드 클래스 재선언을 탐지한다. 도입은 권고이며 미도입이 티켓을 막지 않는다(리뷰어 체크리스트가 정본 강제선).
- 이 절은 규범 서술이다 — 컴포넌트 구현·통합은 EPIC-CARD-SYSTEM 하위 티켓(T3~T7)에서 하며, 이 절은 그 결과가 발산하지 않도록 하는 규약이다.

근거: `card-system-consolidation-proposal-v0.1.md` §2.5(게이트1 승인 2026-08-04) · FC-180 · consultant 성문화
