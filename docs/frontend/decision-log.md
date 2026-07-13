# 프론트 결정 로그 (F-xxx)

접두어 F 독립 증가·불변·재사용 금지. 상태 라벨: PROPOSED / ACCEPTED / ON-HOLD / SUPERSEDED.
근거 위계: 확정 스펙(api-contract v1.1) > 총괄 D 로그(ACCEPTED) > 이 로그 > 타 역할 로그(맥락) > 노트.

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
