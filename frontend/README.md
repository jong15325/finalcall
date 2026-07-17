# FinalCall Frontend

FinalCall(게임 아이템 경매 플랫폼) 웹 클라이언트. Spring Boot 백엔드(`finalcall`)와 짝을 이룬다.

## 스택 (D-032)

TypeScript(strict) + React SPA(Vite) + TanStack Query + Zustand + Tailwind CSS. SSR 미도입.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크(`tsc -b`) + 프로덕션 빌드 |
| `npm run typecheck` | 타입체크만 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## 구조 (feature 기반 — CLAUDE.md [3])

```
src/
├── features/     # 도메인별 응집 (auth·member·wallet 구현 — 그 외 도메인은 착수 시)
├── components/   # 공용 컴포넌트 (layout·feedback·ThemeToggle·ErrorBoundary)
├── stores/       # Zustand 전역 (인증 세션·테마)
├── lib/          # api 클라이언트·queryClient·유틸
├── types/        # 계약 스키마 대응 타입 (api·errorCodes·schema)
├── routes/       # 라우트 정의·경로 상수
└── pages/        # 라우트 placeholder
```

## 계약

유일한 API 기준은 레포 루트의 `docs/spec/api-contract.md`(현재 **v1.5**)다. 모노레포 단일 정본을
직접 참조한다(D-098). 사본을 두지 않는다 — 이중 관리·drift 회피(D-030 사본 규약은 프론트가 별도
저장소였을 때의 것으로, 단일 워킹트리에서 폐기).

## 환경 변수

`.env.example` 참조. `VITE_API_BASE_URL`(미설정 시 `/api/v1`). 실제 `.env`는 커밋하지 않는다.

## 상태 (스켈레톤)

- 인증 세션: 메모리(Zustand, persist 없음). 새로고침 시 재로그인이 정상 — persist 완화는 wallet 착수 전
  보안 검토로 확정한다(skeleton-plan [6]#5).
- 도메인 feature 미구현이 정상이다(스켈레톤 = 공통 바닥). 라우트는 placeholder.
