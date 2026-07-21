# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-21** (세션 마감 — 사용자 지시로 작성)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

---

## 지금 어디인가 — 한 문단

이번 세션에서 **역할 분담이 재정의**됐다: **디자인 HTML 목업은 사용자가 다른 곳에서** 진행하고,
**이 세션(총괄)은 그 확정 디자인 + 브랜드로 백엔드·프론트를 구현**한다. **서비스명 "장터" 확정**
(로고·팔레트 `docs/game_ui/common`). **백엔드는 여전히 동결**이나, 이번에 **미래 백엔드 에픽 3종의
정책·설계가 대거 확정/초안화**됐다 — 수수료 정산(**EPIC-CLOSING**, 정책 확정 D-101), 등급 제도
(**EPIC-GRADE**, 초안 D-102, 포인트=경험치형 확정), 검색(**EPIC-SEARCH**, 초안). 전부 **문서만**,
구현·게이트2는 동결 해제 후. **EPIC-FE-REBUILD는 여전히 blocked** — 해제 조건이 바뀌었다:
"사용자가 다른 곳에서 **디자인 확정 후 핸드오프**".

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋 + 보안 층) 숙지.
2. 이 파일 + `git log --oneline -20` + `git status`.
3. 메모리 `brand-identity`(장터) 확인.
4. **새 spec 3종** 훑기: `docs/spec/fee-policy-spec.md`(확정) · `grade-tier-spec.md`(초안) · `search-spec.md`(초안).
5. 프론트 재구축 입력 = `docs/ux/design-brief.md`(페이지 인벤토리·계약정합·404·승계발견).
6. 아래 "다음 수"로 진행.

---

## ★ 역할 분담 (이번 세션 확정)

| | 담당 |
|---|---|
| **디자인 HTML 목업** | **사용자** (다른 곳에서). 이 세션은 `D:\web_template\...\game-market` 목업을 **더 건드리지 않는다** |
| **백엔드 · 프론트엔드 구현** | **이 세션** (총괄 + 에이전트), 레포 `finalcall/` |

즉 디자인이 확정되면 그걸 정본 삼아 여기서 실제 React 프론트(EPIC-FE-REBUILD)와 백엔드를 구현한다.

---

## ★ 브랜드 — 장터 (확정)

- **서비스명 = 장터**(코드베이스명 `finalcall`과 별개). 목업의 "르아크 거래소"·"FinalCall" 표기 대체.
- **로고**: `docs/game_ui/common/` — `logo.png`(마크: 오렌지 경매봉+SP 앤빌·앱마크), `logo2.png`(라이트용
  네이비 워드마크 락업), `logo_full.png`(다크용 골드 워드마크 배너).
- **팔레트**: 네이비 `#16213a` · 골드/탄 · **오렌지 `#ef8a2c`**(경매봉·SP). SP=원게임 Survival Project.
- 이 게임 원본 기반 정체성이 **비-AI 차별화 앵커**다. 프론트 재구축 시 정본. 종전 퍼플 팔레트
  (`PRODUCT.md`·`DESIGN.md` 잔재) **무효**. 메모리 `brand-identity`.

---

## ★ 미래 백엔드 에픽 3종 (전부 동결 · 구현 이연 · 게이트2 대기)

### EPIC-CLOSING — 수수료/정산 (**정책 확정**, D-101)
- 정본 `docs/spec/fee-policy-spec.md` v1.0. **판매자 단독 · 판매가 구간별 누진 6/5/4/3% · 최소 100/cap
  300,000 G · 과세 생략 · `settle = final − fee`(사업자 귀속) · 취소·유찰 0(SOLD 시만) · 원단위 사사오입**.
- `erd` v1.2 · `api-contract` v1.11 반영(기존 `fee_amount`/`settle_amount` 컬럼 재사용, 스키마 무변경).
- **목업에도 실계산 반영됨**(판매등록·경매상세·지갑). 검산 일치(P=2,480,000 → fee 110,200 · settle 2,369,800).
- 구현 유의: 누진 계산은 SOLD 정산 TX 내부 1회, 순서 = 누진→반올림→cap→최소, money_hold CAPTURED와 분개.

### EPIC-GRADE — 등급 제도 (**초안**, D-102)
- 정본 `docs/spec/grade-tier-spec.md` v0.1. **거래 기반 포인트 → 등급 → 혜택 조합**.
- 확정: **포인트 = 경험치형(소진 없음)** · 판매 1.0/구매 0.5 **비대칭** 적립 · **5단계 지수 등급** · 혜택 =
  수수료 할인(fee 베이스에 등급 계수 −0.25~−1.0%p 평행 인하)+배지+우선노출 · 회수=롤백+Soft Landing.
- 게이트2 8항목(적립배수·등급경계·수수료계수·시점·부스트폭·강등파라미터·**스키마 `user`+`point_ledger`**·계약필드).

### EPIC-SEARCH — 검색 (**초안**)
- 정본 `docs/spec/search-spec.md` v0.1. **단계적 표준안: MySQL FULLTEXT `q` MVP → ES/OpenSearch 승격**.
- 아키텍처: **MySQL=SoT · ES=파생 read-model · Outbox/CDC + 멱등 upsert · dual-write 금지 · alias 무중단
  재색인** · 한글 **nori+ngram** · **function_score 등급 부스트** · 패싯.
- 게이트2: 계약축 **C1~C3**(`q` 파라미터·relevance 정렬) / 인프라축 **A1~A5**(ES·엔진·동기·부스트·재색인).

**상호 연결**: GRADE 우선노출 → SEARCH의 `sellerGrade` function_score 부스트로 구현 · GRADE 적립·수수료
할인 → CLOSING SOLD 정산 동일 TX. 셋 다 백엔드 동결 해제 시 게이트1 분해 + 게이트2 상신.

---

## 프론트 (EPIC-FE-REBUILD) — 여전히 blocked

- **해제 조건 = 사용자가 디자인 확정 후 핸드오프**(종전 "목업 도착"에서 재정의). 그때 → 기존 프론트 폐기
  (318 폐기 / 45 보존 목록은 `docs/board/epics/EPIC-FE-REBUILD.md`에 유효) → 티켓 분해 → **게이트1 상신**
  → frontend-impl 빌드(**장터 브랜드·팔레트 적용**).
- `docs/ux/design-brief.md`(이번 세션 신설) = 페이지 인벤토리·계약정합·**404 목록**·승계 발견 — 빌드 입력.
- 목업(`game-market`)은 이번 세션에 계약버그 수정 + 수수료 반영을 넣었으나, **이제 사용자 소유**라 참조만.

---

## 백엔드 — 동결 유지
**235 테스트 / 실패 0.** 구현 컨트롤러: Auction·Auth·Bid·Exchange·Inventory·ItemInstance·ItemTemplate·Member·Notice.
**미구현(화면 호출 시 404)**: `/shops`·`/market-prices`·`/me/orders`·`/charges`·`/admin/*`·`/auctions/{id}/purchase`.
정산·마감·주문·즉시구매 = EPIC-CLOSING 소유(미구현).

---

## 승계된 발견 (FC-064) — 프론트 재구축이 다시 만날 함정
전문 `docs/board/reviews/FC-064-review.md`. 요지: ①모달 초점 강탈(매초 리렌더+인라인 콜백→ref+`[open]`)
②금액 입력 하향 덮어쓰기 금지(미만일 때만 상향) ③비활성은 DOM 속성(`disabled`/`aria-disabled`) ④마감은
**클라 `now>=endAt` 판정**(서버 status 못 믿음, `resultType` 항상 null) ⑤배럴에 무거운 형제 금지 ⑥`<form
noValidate>` ⑦모바일 우선(`min-w-0`·`grid-cols-1` 시작).

---

## 계약 핵심 사실 (design-brief 참조)
- item 블록 **12필드에 등급/희귀도 없음**(레전드/유니크는 데이터 출처 없음 — 목업 표시용일 뿐, D-073 등급축 제거).
- `minNextBidAmount` 서버 파생(증분표 클라 복제 금지) · element=물불흙바람 · sort에 bidCount 없음(인기순 불가) ·
  q 없음(자유문 검색=EPIC-SEARCH) · 스킬 이름은 아이템 상세에만(경매 상세는 `스킬 #{code}`).
- **마스킹 게이트2 미결**: 계약 §3.3 "판매자 마스킹" vs 구현 `sellerNickname` 원문 노출.

---

## 다음 수
1. **사용자 "출근" 후 지시 대기** — 둘 중 하나:
   - **(a) 디자인 확정 핸드오프 → 프론트 착수**: 폐기 → 티켓 분해 → 게이트1 → frontend-impl(장터 브랜드).
   - **(b) 백엔드 착수**: 동결 해제 결정 + 게이트1 분해 + 게이트2 상신. 후보 = EPIC-CLOSING(정책 확정돼 가장 준비됨) → GRADE → SEARCH.
2. 백엔드 착수 시 EPIC-CLOSING부터가 자연스럽다(수수료 정책 확정 + 스키마 컬럼 존재).

---

## 미결 (동결 해제 시 게이트2)
- EPIC-CLOSING 구현(누진 계산·cap·money_hold 순서) · EPIC-GRADE 8항목 · EPIC-SEARCH 계약/인프라 ·
  마스킹 게이트2 · 빌드 툴체인 지위 · **운영 DB 시드 오염**(데모 계정 BCrypt·게임머니·경매 20건이 부팅과
  동시 운영 유입 — 프로파일별 시드 분리) · 토큰 저장소(localStorage→httpOnly 쿠키+CSRF).

---

## 환경 기동 — ★ 함정 (변동 없음)
```bash
docker start finalcall-mysql finalcall-redis     # 재부팅 시 내려감(볼륨 보존)
# 백엔드: IntelliJ FinalcallApplication (local, JDK 21 C:\Users\howee\.jdks\ms-21.0.11), Flyway V1~V13 자동
```
- **함정 A — 시드 시각 되돌리기**: V13 주석 [B]의 재적용 SQL 4문장(안 하면 카운트다운 전부 "마감").
- **함정 B — 아트 크로마키**: 아이템 PNG는 알파 없음(colorType 2)·네 귀퉁이 `#0000FF`. `predev`/`prebuild`가
  복사본만 RGBA 변환. **새 프론트도 이 처리 필요.**
- **⚠ Flyway 체크섬**: `V11` 커밋 후 편집 이력 — 적용된 DB는 `flyway repair` 없이 부팅 실패 가능(FC-035 m9).

---

## 이번 세션 산출물 (git 미커밋 — 사용자 커밋/푸시)
- 신규: `docs/spec/fee-policy-spec.md` · `docs/spec/grade-tier-spec.md` · `docs/spec/search-spec.md` · `docs/ux/design-brief.md`
- 수정: `docs/spec/erd.md`(v1.2) · `docs/spec/api-contract.md`(v1.11) · `docs/management/decision-log.md`(D-101·D-102) · `decision-index.md` · **이 HANDOVER**
- 목업(레포 밖, 사용자 소유): `game-market` 계약버그 수정 + 수수료 실계산 반영
- 메모리: `brand-identity` 신설

---

## 교훈 (이번 세션 추가)
1. **레퍼런스 먼저, 수치는 그 위에.** 수수료·등급·검색 전부 실제 서비스(아이템매니아 5%·StockX 레벨·배민 ES
   9.4x 등) 근거로 설계했다. 사용자가 반복해 "레퍼런스 꼭 찾아서"를 요구했다 — 근거 없는 수치를 만들지 말 것.
2. **자리는 있고 정책만 없던 것**: 수수료는 `sale_order.fee_amount`가 이미 예약(ON-HOLD)돼 있었다. 새 기능
   제기 시 **먼저 레포를 grep**해 이미 심어진 씨앗을 찾을 것(등급도 CLAUDE "보유 포인트"에 씨앗).
3. **동결 중에도 설계는 진행된다.** 백엔드 동결이라 구현은 못 해도 정책·spec·게이트2 항목 분리는 미리 확정해
   두면 동결 해제 시 바로 게이트1로 간다.
4. **역할 경계 존중**: 사용자가 디자인을 가져가면 그 파일을 더 건드리지 않는다. 동시 편집 파일은 덮어쓰기 금지·
   정확일치 Edit만(이번에 목업 편집 시 준수).
