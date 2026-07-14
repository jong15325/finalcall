# 프론트 결정 로그 (F-xxx)

접두어 F 독립 증가·불변·재사용 금지. 상태 라벨: PROPOSED / ACCEPTED / ON-HOLD / SUPERSEDED.
근거 위계: 확정 스펙(api-contract v1.2) > 총괄 D 로그(ACCEPTED) > 이 로그 > 타 역할 로그(맥락) > 노트.

---

## F-001. 실시간 최고가·남은시간 갱신은 폴링(TanStack Query refetchInterval) 기반

상태: ACCEPTED · 소유: 프론트 · 관련: relates-to api-contract §3.1, CLAUDE.md 4절, domain-spec §4(소프트클로즈)·§10 · 2026-07-14

결정
- 경매 상세의 현재 최고가·남은 시간은 GET /api/v1/auctions/{auctionPublicId} 폴링으로 갱신한다. 서버 데이터이므로 TanStack Query의 refetchInterval로만 관리하고 Zustand/useState에 복제하지 않는다(CLAUDE.md 4절).
- 폴링 활성 범위: 경매 상세 화면에서만 활성. 목록 화면은 폴링하지 않고 window focus·수동 refetch만. 상세에서도 status가 종료(SOLD/UNSOLD/CANCELLED)면 폴링 중지.
- 폴링 간격은 마감 잔여시간 기반 가변(마감 임박 시 조밀, 그 외 완만)으로 두되 구체 수치는 구현·측정 후 조정(클라이언트 내부 파라미터, two-way door).

이유
- 계약 v1.1은 REST 전용으로 실시간 푸시 채널(SSE/WebSocket)이 없다. 계약에 없는 채널을 추측 구현하지 않는다(CLAUDE.md 2절, D-028). 현행 계약 범위에서 실시간성은 폴링이 유일한 수단이다.
- 폴링 간격·활성 범위는 자기 코드 안에서 닫히는 클라이언트 내부 결정이라 자율 결정(에스컬레이션 역기준).

기각된 대안
- 목록 전체 폴링: 마감 임박 경매가 아닌 항목까지 불필요한 트래픽. 상세 한정이 비용 대비 효과가 크다.
- 낙관적 로컬 카운트다운만(폴링 없음): 남은 시간은 로컬 타이머로 표시 가능하나 소프트클로즈로 endAt이 동적 변동(domain-spec §4)하므로 서버 endAt 재수신이 필요. 로컬 타이머는 표시 보조로만 병행.

레퍼런스
- 실시간 푸시 채널(SSE/WS) 도입 여부는 계약 확장 사안이라 총괄 결정 요청으로 격상 → outbox/001 안건 2. 채택 시 본 결정 재검토(SUPERSEDE 가능).
- 총괄 회신 059: 폴링 MVP 채택 확정. push 승격은 bid(입찰) 도메인 구현 단계에서 재검토. → 본 결정 ACCEPTED 유지.

---

## F-002. 프론트 저장소 스켈레톤 구성 — 공유 계층까지, 도메인 기능 제외

상태: ACCEPTED · 소유: 프론트 · 관련: depends-on D-032(스택)·CLAUDE.md 3~6절, relates-to 058·059(repo 셋업 GO), D-030(계약 복사본) · 2026-07-14
재편(2026-07-14 user 지시): 본 항목 = 스켈레톤 구성(F 소유). 상류 스켈레톤 기획은 프론트 기획(PF)이 담당. 순서(PF 기획→F 구성→Claude Code 생성→repo 후생성) 격상 → outbox/004. 실행(outbox/003 codegen)은 PF 기획+총괄 시퀀싱 확정까지 보류. PF 기획과 어긋나면 본 구성이 정합(진행측 부담, D-028).

결정
- 프론트 저장소 스켈레톤 범위 = 빌드·품질 툴링 + 공유 계층까지. 도메인 feature 로직은 제외(백엔드 auth 구현·조인트 리뷰 후 착수). 백엔드 스켈레톤의 stage 규율(단계 절단)을 프론트에도 적용.
- 포함: Vite+React+TS(strict) 부트스트랩, tsconfig strict·path alias(`@/`), ESLint+Prettier, Tailwind + 토큰(디자인 design-system 토큰명 1:1, 색값은 잠정 A안·확정 시 교체), TanStack Query Provider + QueryClient 기본값, Zustand 인증 세션 스토어 골격(토큰 보관·만료), 라우팅 셸(공개/인증/관리자 레이아웃 + 가드), lib/api 클라이언트(baseURL `/api/v1`, ApiResponse 언랩, 401→refresh 회전 인터셉터 골격), types(ApiResponse·CursorPage·OffsetPage·ErrorCode 상수 §5), 폴더 구조(CLAUDE.md 3절), 계약 v1.2 복사본(docs/api-contract.md, 원본 경로·버전·해시 헤더 D-030).
- 제외(후속): features/* 도메인 구현, 실제 화면·목업 바인딩, 폴링 튜닝.

이유
- 스켈레톤·공유 계층은 백엔드 응답과 독립(의존 없음)이라 지금 병렬 착수 가능(058). 도메인 로직은 §3.3 스키마·백엔드 실제 응답 확인 후가 재작업이 적다(D-028 pull 우선순위·D-074 선행 게이팅).
- 세부 툴링·클라이언트 형태는 자기 코드 안에서 닫히는 two-way door → 자율 결정.

기각된 대안
- 스켈레톤에 auth 화면까지 포함: 백엔드 auth 미완(대기)이라 계약 응답 실물 확인 전 화면 바인딩은 재작업 위험. 셸·스토어 골격까지만.

레퍼런스
- 실행은 프론트 Claude Code(작업 프롬프트 outbox/003, templates §18). 저장소 생성·커밋은 사용자(D-061·D-030).
