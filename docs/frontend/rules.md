# 프론트 규칙 (F)

FinalCall 모노레포(D-098) `frontend/` 웹 클라이언트의 파트 지침이다.
협업 규약은 `docs/common/rules.md`, 형식은 `docs/common/templates.md`를 따른다.

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

## 6. Git (D-030)

- Conventional Commits + 한국어 제목, 본문 템플릿은 `CLAUDE.md [6]`과 동일.
- 스켈레톤기 main 직접 → 도메인 개발기 feature/<도메인> → PR → main(Squash and Merge).
- 스켈레톤 커밋: `chore(skeleton): stage N - 설명`.

## 7. 문서·결정

- 프론트 결정 로그(F-xxx)·노트·outbox는 `docs/frontend/` (문서 허브 단일화).
- 에스컬레이션 4기준·메시지 형식은 협업 가이드 준수.
