# 디자인 결정 로그 (U-xxx)

각 항목 1결정. 상태 라벨만 갱신, 본문 불변(collaboration-guide 4절). 근거는 확정 스펙(api-contract v1.1) 또는 ACCEPTED 결정.

---

## U-001. 디자인 토큰 명칭을 프론트 Tailwind 유틸과 1:1로 고정

상태: ACCEPTED · 소유: 디자인 · 관련: relates-to F(screen-route-map), frontend/CLAUDE.md 5절 · 2026-07-14

결정
- 토큰명(색·간격·타이포·반경 등)을 Tailwind theme.extend 키와 동일 문자열로 정의한다. 예: 토큰 `primary` ↔ 유틸 `bg-primary`, `surface` ↔ `bg-surface`.

이유
- 디자인-프론트 사이 "번역 레이어"를 없앤다. 프론트 CLAUDE.md 5절(전역 CSS는 토큰 정의로 한정)과 정합. 명칭 변경은 정보 공유(D-024)로 통지.

기각된 대안
- 디자인 전용 명칭 후 프론트 재매핑: 매핑 표 유지 비용·불일치 위험.

## U-002. 스페이싱·반경·타이포를 4/8px 배수 스케일로 표준화

상태: ACCEPTED · 소유: 디자인 · 2026-07-14

결정
- 스페이싱은 4px 기준 배수(Tailwind 기본 스케일 준용), 반경 sm4/md8/lg12/xl16/full, 타이포는 rem 스케일로 정의한다.

이유
- Tailwind 기본과 충돌 없이 확장, 리듬 일관성. 커스텀 최소화로 프론트 학습비용 절감.

## U-003. 본문 폰트 Pretendard + 금액·시간 tabular-nums

상태: ACCEPTED · 소유: 디자인 · 2026-07-14

결정
- UI 기본 폰트는 Pretendard(한글 웹 표준, 시스템 폴백). 금액·카운트다운 등 숫자는 tabular-nums(고정폭 숫자)로 렌더한다.

이유
- 한글 가독성·라이선스 부담 낮음. 실시간 카운트다운·최고가 갱신 시 숫자 폭이 흔들리면 레이아웃 점프 발생 — tabular-nums로 방지(자금·경매 UI 정밀성).

## U-004. 아이템 등급(grade)·속성(element)에 색 토큰 체계 부여

상태: PROPOSED · 소유: 디자인 · 관련: relates-to erd(item_template.grade/element), depends-on ERD grade 값 목록 · 2026-07-14

결정(제안)
- 속성(element 4종: 물/불/흙/바람)에 고정 색 매핑(물=info-blue, 불=danger-red, 흙=amber, 바람=success-green). 등급(grade)은 게임 레어리티 관례의 티어 색 스케일(grade-1~5: gray→green→blue→purple→gold)로 확장 가능하게 정의.

이유
- element·grade는 검색 필터·아이템 카드의 핵심 시각 축(erd §7.7 인덱스). 색 코드는 스캔성을 크게 높인다. element는 4종 확정이라 즉시 매핑 가능.

미확정 참고
- erd `grade`는 INT 축으로 값 목록이 스펙에 명시되지 않음. 실제 grade 단계 수·명칭 확정 시 색 매핑을 1:1 고정해야 함(기획 확인 대상). 확정 전까지 5티어는 잠정.

## U-005. 라이트/다크 양립 토큰 구조 채택(기본 테마는 총괄 결정 요청)

상태: ACCEPTED · 소유: 디자인 · 관련: escalated-as (기본 테마는 outbox/001 안건 2) · 2026-07-14

결정
- surface/text/border 등 의미 토큰을 라이트·다크 두 값으로 정의해 테마 전환이 토큰 교체만으로 되게 한다. 어느 테마를 기본으로 노출할지는 비주얼 방향과 함께 총괄/사용자 결정.

이유
- 게임·거래 사용자층은 다크 선호가 강하나 자금 신뢰감은 라이트가 유리 — 구조로 양립시키고 기본값만 결정 대상으로 남긴다(되돌리기 저비용).

## U-006. 실시간(최고가·카운트다운) UI를 폴링 전제로 설계

상태: ACCEPTED · 소유: 디자인 · 관련: relates-to F-001(폴링) · 2026-07-14

결정
- 경매 상세의 최고가·남은시간·마감 연장(소프트클로즈)을 폴링 갱신 전제로 설계한다. 갱신 시 낙관적 표시 + 서버 확정 반영, 종료 시 폴링 중지·상태 전환.

이유
- 계약에 실시간 푸시 채널(SSE/WS) 부재, 프론트 F-001이 폴링 채택. 디자인이 푸시를 전제하면 계약·프론트와 어긋남. 채널 도입 시 카운트다운·입찰 피드 컴포넌트는 소스만 교체 가능하게 분리.

## U-007. 우선 컴포넌트 세트와 핸드오프 스펙 범위 확정

상태: ACCEPTED · 소유: 디자인 · 2026-07-14

결정
- v0 우선 컴포넌트: Button, Field(Input/Select), ItemCard, ListGrid, Modal, Toast, Pagination(cursor/offset), Badge/StatusChip(+Grade/Element), Countdown, MoneyAmount. 각 컴포넌트는 상태·변형·토큰·반응형·접근성을 명세한다(design-guide 4절).

이유
- 경매 목록→상세→입찰·구매·충전 등 계약 핵심 플로우를 최소 세트로 커버. 프론트 feature 구조(auction/bid/shop/wallet…)와 대응.
