상태: HOLD — 보류(2026-07-14). 사유: 스켈레톤 기획 = 기획(P) 담당(D-079로 PF 재통합, 지시 063 인계). 레인 순서·repo 후생성은 총괄 확정(062, (a)). 기획(P) 스켈레톤 기획 완료 보고 후 재발신. 재발신 시 (1) 로컬 작업 디렉터리에 scaffold → DoD 검증 → 완료 시 repo 생성·push, (2) 기획(P) 기획 반영으로 본문 갱신, (3) templates 3 신설 필드 `근거(인용): <문서 §절> — "<직접 인용>"` 포함(D-082·079) 예정.
# [프론트 → Claude Code] 작업 지시: skeleton - 프론트 저장소 스켈레톤 scaffold

대상: 프론트 저장소(별도 repo, 신규) 스켈레톤 — 빌드·툴링 + 공유 계층. 도메인 feature 제외.
참조: 프론트 CLAUDE.md 3~6절(구조·상태·컨벤션·git), api-contract.md v1.2(§1 공통 규약·§3.3 스키마·§5 에러코드), F-002, D-032(스택), D-030(계약 복사본 규약).

범위(이번 작업 포함):
- 부트스트랩: Vite + React + TypeScript(strict). Node LTS 기준.
- 툴링: tsconfig strict(noUncheckedIndexedAccess 포함), path alias `@/` → src. ESLint + Prettier(named export 우선, any 금지). npm 스크립트: dev/build/lint/typecheck.
- 스타일: Tailwind 설정 + theme.extend에 디자인 토큰 매핑(토큰명은 docs/ux/design-system.md와 1:1). 색값은 잠정 A안(비주얼 확정 시 교체), 표면/텍스트는 CSS 변수 + [data-theme].
- 폴더 구조(CLAUDE.md 3절): src/{features,components,stores,lib,types,pages}. features/ 는 빈 자리(README로 도메인 목록만: auth·auction·bid·shop·item·inventory·order·wallet·admin).
- types/: `ApiResponse<T>`(success 유니온), `CursorPage<T>`, `OffsetPage<T>`, `ErrorCode` 상수(계약 §5 전 코드 + COMMON_004). 시간은 string(ISO-8601 UTC) 원형 보관.
- lib/api: fetch/axios 기반 클라이언트. baseURL `/api/v1`(env로 오버라이드), 요청에 `Authorization: Bearer` 주입, 응답 envelope 언랩(success=false면 code로 에러 throw), 401 시 refresh 회전 인터셉터 골격(POST /auth/refresh, 재발급 refreshToken 저장, 재사용 탐지 401→로그아웃).
- 상태: TanStack Query Provider + QueryClient(기본 staleTime·retry 보수값). Zustand 인증 세션 스토어 골격(accessToken·accessExpiresAt·refreshToken·user 요약, 로그인/로그아웃 액션). 쿼리 키 규약 `[도메인, 리소스, 파라미터]` 헬퍼.
- 라우팅 셸: 공개/인증/관리자 레이아웃 + 인증 가드(미인증 시 /login). screen-spec §2 라우트 자리만(placeholder 페이지), 도메인 로직 없음.
- 계약 복사본: 프론트 repo docs/api-contract.md 에 원본 복사 + 헤더에 원본 경로(finalcall/docs/api-contract.md)·버전(v1.2)·원본 파일 해시 기입(D-030).
- 프론트 CLAUDE.md 를 프론트 repo 루트로 이관(D-039).

하지 말 것:
- features/* 도메인 구현·실제 화면 바인딩·목업 연결·폴링 구현(후속 단계).
- 계약에 없는 엔드포인트/필드 추측 추가(공백 발견 시 멈추고 프론트 대화로 보고, D-028).
- 시크릿·API 키 하드코딩(.env.example 만, 실제 .env 는 .gitignore).
- git 커밋·푸시 실행(사용자 전담, D-061).

구현 지침: 프론트 CLAUDE.md 3~6절 준수(feature 구조, 서버 데이터=Query·복제 금지, 에러코드 상수 분기, Instant 원형 보관, Tailwind 유틸 우선, strict·any 금지).

DoD: `npm run build`·`npm run typecheck`·`npm run lint` 통과 + 라우팅 셸 렌더 + api 클라이언트/스토어/Provider 배선 + types·계약 복사본 존재. 도메인 기능 없음(의도).

커밋 제안(코드 커밋 형식 CLAUDE.md 6절, 실행은 사용자):
```
chore(skeleton): stage 0 - Vite+React+TS 스켈레톤 + 공유 계층·계약 v1.2 복사본
```
