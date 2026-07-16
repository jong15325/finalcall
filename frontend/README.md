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
├── features/     # 도메인별 응집 (스켈레톤 단계 비움 — README 참조)
├── components/   # 공용 컴포넌트 (layout·feedback·ThemeToggle·ErrorBoundary)
├── stores/       # Zustand 전역 (인증 세션·테마)
├── lib/          # api 클라이언트·queryClient·유틸
├── types/        # 계약 스키마 대응 타입 (api·errorCodes·schema)
├── routes/       # 라우트 정의·경로 상수
└── pages/        # 라우트 placeholder
```

## 계약

유일한 API 기준은 백엔드 저장소의 `docs/api-contract.md`(현재 **v1.4**)다. repo 생성 시 이 저장소로
복사본을 두고 헤더에 원본 경로·버전·해시를 기입한다(D-030). 복사본과 원본이 어긋나면 원본이 우선한다.

## 환경 변수

`.env.example` 참조. `VITE_API_BASE_URL`(미설정 시 `/api/v1`). 실제 `.env`는 커밋하지 않는다.

## 상태 (스켈레톤)

- 인증 세션: 메모리(Zustand, persist 없음). 새로고침 시 재로그인이 정상 — persist 완화는 wallet 착수 전
  보안 검토로 확정한다(skeleton-plan [6]#5).
- 도메인 feature 미구현이 정상이다(스켈레톤 = 공통 바닥). 라우트는 placeholder.
