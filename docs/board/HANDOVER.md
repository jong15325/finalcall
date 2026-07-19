# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-20** (사용자 지시로 전면 재작성 — **디자인 전면 변경 결정** 반영)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

---

## 지금 어디인가 — 한 문단

**사용자가 디자인 전면 변경을 결정했고, 목업을 준비해 오기로 했다.** 그래서 현재 에픽
**`EPIC-FE-REBUILD`(KAN-73)는 `blocked`**이며 **목업 도착이 유일한 해제 조건**이다.
**프론트 코드는 아직 한 줄도 지우지 않았다** — 무엇으로 대체되는지 모른 채 파괴하지 않기 위해서다.
보드만 전이했고 **폐기 318파일 / 보존 45파일 목록이 이미 확정**돼 있어, 목업이 오면 바로 실행한다.
**백엔드는 동결 유지**(235 테스트 통과)이고 **모든 작업은 원격에 push됐다**(`2e2616d`).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋 + 보안 층) 숙지.
2. **`docs/board/epics/EPIC-FE-REBUILD.md`를 먼저 읽어라** — 보존/폐기 목록, 목업 도착 시 확인할
   4가지, 승계된 발견이 거기 있다. 이 파일은 그 요약이다.
3. **Jira 미러 패리티** — `state≠todo`인데 `jira_key: null`인 티켓 스캔(섹션 12). 현재 **드리프트 0**.
4. `git log --oneline -20` · `git status` · `@{u}..HEAD`.
5. 아래 "다음 수"로 진행.

**★ 목업이 아직 없으면 프론트를 지우지 마라.** 이 상태가 의도된 대기다.

---

## 환경 기동 — ★ 함정

```bash
# 1) 인프라 (재부팅 시 내려감. 볼륨은 보존)
docker start finalcall-mysql finalcall-redis

# 2) 백엔드 — IntelliJ FinalcallApplication (local, JDK 21 C:\Users\howee\.jdks\ms-21.0.11)
#    Flyway V1~V13 자동 적용

# 3) ★ 함정 A — 시드 시각 되돌리기 (안 하면 카운트다운이 전부 "마감")
#    V13 주석 [B]의 재적용 SQL 4문장. 임박(4분30초)·초임박(28초)은 적용 직후 몇 분만 유효하다.
#    → backend/src/main/resources/db/migration/V13__auction_bid_demo_seed.sql 주석 [B] 참조

# 4) 프론트 (아직 존재한다 — 폐기 전)
cd D:/Java/finalcall/frontend && npm run dev     # :5173
```

**★ 함정 B — 아트 크로마키**: 아이템 아트 PNG는 **알파 채널이 없고**(colorType 2) 네 귀퉁이가
`#0000FF` 크로마키다. `predev`/`prebuild`가 `scripts/pngChromaKey.mjs`로 **복사본만** RGBA 변환한다
(`public/art`, gitignore). **정본 `docs/game_ui`는 읽기만** 한다. 스크립트를 건너뛰면 모서리가 파랗게 보인다.
**→ 새 프론트에서도 이 처리가 필요하다.**

**★ 함정 C — 테마 프리셋(템플릿과 함께 소멸 예정)**: `useThemeStore`가 `persist(localStorage 'theme')`라
설정 파일 값이 초기값으로만 쓰인다. 변경이 반영 안 되면 `localStorage.removeItem('theme')` 후 새로고침.
**폐기 대상이지만 폐기 전까지는 유효하다.**

**⚠ Flyway 체크섬**: `V11`이 커밋 후 편집된 이력이 있다. 이미 적용한 DB는 `flyway repair` 없이 부팅
실패할 수 있다(FC-035 m9).

---

## 현재 상태 — 보드

| 에픽 | 상태 | 비고 |
|---|---|---|
| **EPIC-FE-REBUILD** (KAN-73) | **`blocked`** | **현재 에픽.** 목업 대기. 하위 티켓 아직 없음 |
| EPIC-FE-ECME (KAN-65) | `superseded` | 하위 FC-055~059·064 **이력 보존**(done으로 안 닫음) |
| EPIC-FE-REDESIGN (KAN-56) | 무효 | 그 앞 세대. UI 산출물 무효, 백엔드 시드·문서는 유효 |

**티켓 최종 상태**: FC-055~058 `done` · FC-059 `done` · **FC-064 `review`/`review_status: passed`**
(reviewer 2차 통과했으나 게이트3 직전에 방향 전환 — 도달했던 사실 그대로 보존) ·
**FC-065 `cancelled`**(템플릿 폐기로 대상 소멸) · FC-060·061·063 **미개설**(착수 전이라 손실 없음).

### 방향 전환 이력 — **네 번째다**
1. 백엔드 동결 · 디자인 우선 → 목업 6면 (EPIC-DESIGN-TEMPLATE)
2. → React 반영 (EPIC-FE-REDESIGN) → **"디자인이 너무 별로 · 영역별로 틀어진다"**
3. → 구매 템플릿(Ecme) 전면 재구축 (EPIC-FE-ECME) → **이번 폐기**
4. → **사용자 목업 기반 재구축** ← 현재

> **★ 그래서 이번엔 목업이 먼저다.** 종전 세 번은 전부 **시각 방향을 우리가 정하거나 고른 뒤**
> 사용자가 실물을 보고 뒤집는 형태였다. 목업이 정본으로 먼저 오면 그 왕복이 없어진다.

---

## ★★ 폐기 / 보존 목록 (실측)

### 보존 — 45파일 + 테스트 18파일
**디자인이 아니라 계약을 인코딩한 것**이다. 버리면 같은 계약 사실을 다시 도출해야 하고
**이번에 잡은 버그를 다시 만난다.**

| 위치 | 무엇을 인코딩하나 |
|---|---|
| `features/auction/lib/auctionPhase.ts` | **마감 판정 `now >= endAt`.** 서버 `status`를 믿으면 안 되는 이유가 들어 있다 |
| `features/auction/lib/bidErrors.ts` | 계약 §5 `BID_001~007`·`AUCTION_004` 코드별 문구 |
| `features/auction/lib/bidAmount.ts` | **금전 3갈래 규칙**(리뷰 major의 해답) + 테스트 22건 |
| `features/auction/lib/{auctionPrice,countdown,useNow,auctionFilters}.ts` | 가격·잔여시간·단일 타이머·**`kind`의 `subGroup` 종속 방어** |
| `features/item/lib/{itemCode,itemArt,element,goldforce}.ts` | §3.3.1 코드 사전 · 아트 경로 · 크로마키 |
| `lib/api/**` · `lib/queries/**` | **단일 전송로** · JWT 회전 · `X-Gateway-Token` 프록시 · 에러 봉투 · 커서 페이징 · **캐시 키 `preview`/`browse` 분리**(홈이 목록 필터에 딸려 무효화되지 않게 한 것) |

### 폐기 — 318파일
`components/ui` 200 · `components/template` 40 · `assets/styles` 50 · `views` 28 +
`components/{brand,layouts,shared}` · `configs/theme.config.ts`.
문서: `design-system.md` 팔레트·컴포넌트 결정 · **`PRODUCT.md`·`DESIGN.md`의 폐기된 퍼플 팔레트**.

### ★ 폐기하지 **않는** 것 — 지난번 과폐기 반복 방지
- **`design-system.md` §5.12 골드포스 아웃라인** — **원본 게임 자산 실측값**(2겹 링 · 변마다 다른
  베벨 색 `#99770C`/`#987309`/`#8B6100`/`#9D7C10` · `--art-scale` 파생 · 상한 9px)이지
  **우리가 고른 색이 아니다.** 목업이 안 쓰기로 하면 그때 폐기하되 **선제 폐기 금지.**
- `docs/spec/**`(계약·ERD·도메인 spec) · 게임데이터 판독 문서 ·
  `docs/ux/references/auction-detail-references.md`(823줄 조사) · `docs/game_ui/` 원본 자산.

---

## ★★ 승계된 발견 — 새 프론트가 **반드시 다시 만날** 함정

화면은 죽지만 이것들은 살아 있다. **전문은 `docs/board/reviews/FC-064-review.md`**(리뷰 2회분).

1. **모달 초점 강탈** — effect 의존 배열에 **인라인 콜백**이 들어가고 부모가 **매초 리렌더**하면
   (카운트다운 때문에 흔하다) 초당 1회 cleanup→재실행이 돌아 **초점이 매초 강탈**된다.
   모바일에서 **소프트 키보드가 닫혀 입력이 불가능**해진다.
   → **해법**: 콜백을 ref에 담고 의존을 `[open]`으로 줄인다. 소비처에 `useCallback`을 요구하면
   **다음 소비처에서 또 표류**한다 — 규칙이 아니라 구조로 막아라.
2. **금액 입력 덮어쓰기** — 서버 최소가가 바뀔 때 입력을 **무조건 치환**하면 사용자가 넣어 둔
   **스나이핑 금액이 하향 치환**된다. `refetchOnWindowFocus`면 **탭 전환만으로 발동**하고
   확인 단계가 없어 되돌릴 수 없다. → 프리필/사용자입력을 가르고 **미만일 때만** 상향.
3. **비활성은 클래스가 아니라 DOM 속성으로** — `opacity-50`만 붙이고 `onClick`을 내부에서 막으면
   **눈에만 비활성이고 보조기술엔 멀쩡한 버튼**이 된다(WCAG 4.1.2). `disabled`/`aria-disabled`를 내려라.
4. **배럴에 무거운 형제를 넣지 마라** — `Checkbox.Group`이 lodash를 쓰자 배럴을 타는 모든 화면이
   **청크마다 약 33 kB**를 물었다(직접 임포트로 44.13 → 19.48 kB 실측).
5. **`<form noValidate>`** — `min` 속성이 제출을 가로채 브라우저 말풍선을 띄우면 같은 실패가
   **두 모습**으로 보인다. 말하는 주체를 하나로 모아라.
6. **모바일 우선으로 짜라** — 데스크톱 기준으로 짜면 **320~1024가 전부 깨진다**(FC-058 실증).
   루트 `overflow-x-hidden` · `grid-cols-1` 시작 · flex 자식 **`min-w-0`**(`min-width:auto`가 근본 원인).

---

## 계약 — 확정된 사실과 공백 (architect 분석 + 총괄 대조 완료)

**정본** `docs/spec/api-contract.md` v1.10. 상세는 `docs/board/tickets/FC-064.md` "계약 분석 결과".

### 그대로 쓰면 되는 것
- `GET /auctions/{id}` 공개, 계약 §3.3 ↔ `AuctionDetailResponse` **17필드 1:1 일치**
- **`minNextBidAmount`는 서버 파생값이 내려온다** — `AuctionService`와 `BidService`가 같은
  `BidIncrementProperties`를 쓴다. **증분표를 클라에 복제하지 마라**
- `POST /auctions/{id}/bids` 응답 `endAt`은 **소프트클로즈 연장 반영 후** 값
- `GET /auctions/{id}/bids` 존재·공개(offset 페이징, `amount desc` 고정, **`size` 상한 100** 서버 정규화)
- `BID_001~007`·`AUCTION_004` 계약 ↔ `BidErrorCode` **7값 전수 일치**
  ★ **`BID_001` = 최소 증분 미달, `BID_002` = buyNowPrice 이상**(총괄이 티켓에 뒤집어 적었던 그것)

### ★ 벽 — 우회로가 있어 착수를 막지 않는다
- **`isSeller` 부재** → `sellerNickname`(**마스킹 없이 원문**) vs `GET /me`의 `nickname` 비교로 파생.
  닉네임은 활성 회원 간 유일하고, 진행 중 경매 보유자는 탈퇴가 차단(`MEMBER_002`)돼 오탐 경로가 막힌다.
  **★ 표시 제어일 뿐 인가가 아니다** — 서버 `BID_003`(403) 처리는 반드시 구현.
- **스킬 이름** → "사전 부재"가 **아니다**. `GET /items/{id}`가 `ItemSkillResponse{skillCode, name}`으로
  **이름을 이미 내린다.** 진짜 벽은 **`AuctionItemView`에 `itemInstancePublicId`가 없어 링크가 끊긴 것**.
  당분간 `스킬 #{code}` 중립 표기가 **계약 준수**다(§3.3이 폴백을 의무화).
- **즉시구매** → 계약 §3.1에 완전 명세됐으나 **백엔드 미구현**(`AuctionController`에 매핑 없음).
  **버튼 만들면 404.** `buyNowPrice`는 정보 표기로만.
- **마감 강등 워커가 없다** → `resultType`은 항상 null이고 `endAt`이 지난 경매도 `status: ACTIVE`로
  내려온다. **클라가 시각으로 판정**해야 하고 이는 서버 `BidService.isBiddable()`과 정합한다.

### 계약↔구현 불일치 (로그아웃 바디 누락과 동종)
- **판매자 취소 403(`AUCTION_001`)이 계약 §3.1 cancel 에러 목록에 없다**
- **입찰 이력 `size` 상한 100 정규화가 계약에 없다**
- **§3.3 서두 "소유자·최고입찰자는 마스킹" ↔ `sellerNickname` 원문 노출** — **게이트2 미결(아래)**

---

## 백엔드 — 동결 유지

**235 테스트 / 실패 0.** EPIC-CLOSING·EPIC-SHOP·FC-035 minor 5건 동결.
**구현된 컨트롤러**: Auction · Auth · Bid · Exchange · Inventory · ItemInstance · ItemTemplate · Member · Notice

**★ 계약엔 있으나 미구현 — 화면에서 호출하면 404**:
`/shops` · `/market-prices` · `/me/orders` · `/charges` · `/admin/*` · **`/auctions/{id}/purchase`**
(FC-048이 계약만 보고 `/shops`를 넣었다가 홈에 에러 배너가 떴다.)

---

## 다음 수
1. **★ 목업 도착 대기.** 도착하면 → (1) 폐기 실행 (2) 티켓 분해 (3) **게이트1 상신**.
2. **목업 받을 때 확인할 4가지**:
   - **어느 폭을 정의하는가** — 데스크톱만이면 **모바일 설계는 여전히 우리 몫**이고 그 자체가 승인 대상.
     ★ 사용자 지속 원칙: ***"반응형은 배치 변경이 아니다. 웹은 웹, 모바일은 모바일."***
     "좁아지면 1열로 접는다"류는 **설계로 인정되지 않는다.**
   - **컴포넌트 어휘**(버튼·폼·모달·표)가 정의돼 있는가.
   - **골드포스 아웃라인(§5.12)을 쓰는가** — 쓰면 실측값 승계, 안 쓰면 그때 폐기.
   - **아트 슬롯 크기** — 원본 50×93 도트라 **정수배 확대 + `image-rendering: pixelated`** 필수.
3. **빌드 툴체인 지위 결정**(아래 미결).

---

## 미결 — 사용자 판단 대기
1. **★ 빌드 툴체인.** Vite 6 · React 19 · Tailwind 4 · vitest는 **디자인이 아니라 기반**이라 유지가
   기본이나, 템플릿 유래 설정(prettier `semi:false`·`tabWidth:4` · CSS 6레이어 분할)은 재검토 대상.
   **툴체인까지 갈아엎으면 보존 45파일의 테스트도 다시 배선해야 한다.**
2. **게이트2 — 계약 §3.3 마스킹 문구 확정**(문서만, 백엔드 무변경). 계약은 "소유자·최고입찰자는
   마스킹"인데 구현은 `sellerNickname`을 원문으로 내린다. **`isSeller` 판정이 이 원문 노출에
   의존하므로, 나중에 문구대로 마스킹이 들어오면 화면이 조용히 깨진다.**
3. **스킬 이름 노출 경로 택일** — `AuctionItemView`에 `itemInstancePublicId` 1필드 추가 vs
   `GET /skills` 사전 신설. **후자는 목록의 스킬 필터까지 되살린다.** 백엔드 동결 해제 시.
4. **`design-system.md` 최종 지위** — 팔레트가 죽고 §5.12만 남으면 문서로 유지할 가치가 있는지.
5. **★ `PRODUCT.md`·`DESIGN.md`에 폐기된 퍼플 팔레트가 정본처럼 남아 있다** — 참조하면 죽은 시각
   언어가 되살아난다. **새 에픽 착수 시 정리.**

### 그 밖의 게이트2 후보 (백엔드 동결이라 문서만)
자유문 검색(계약에 `q` 없음) · `sort` 화이트리스트에 `bidCount` 없음(인기순 불가) ·
**운영 DB 시드 오염**(Flyway location 단일이라 데모 계정 3개 BCrypt 평문 `"password"` + 게임머니
1,500만 + 경매 20건이 부팅과 동시에 운영에 들어간다 — 프로파일별 시드 분리 필요) ·
토큰 저장소 재검토(`localStorage` 판정 근거는 *"안전해서가 아니라 제약상 셋 다 XSS 등가"* —
진짜 개선은 refresh를 httpOnly 쿠키 + CSRF로, **동결 해제 시**)

## 백로그
CI 연동 · SPA soft-404 · EPIC-CHARGE · EPIC-OAUTH · PR 워크플로우 ·
EPIC-GAME-PROFILE(게임데이터 통합, `docs/portfolio/process-log.md` 항목3) ·
FC-043 인증 판단 대기 4건(약관 문장 vs 체크박스 · 네이버 대비 1.94:1 · 가입 CTA 문구 · 폼 좌측 배치)

---

## 유효한 자산 (버리지 말 것)
| 자산 | 내용 |
|---|---|
| `docs/spec/api-contract.md` **v1.10** | **§3.3.1 코드 사전** — `1[subGroup][element][kind]`, element 1물·2불·3흙·4바람, **`kind`는 `subGroup` 종속** |
| `docs/spec/references/game-item-skill-format.md` | 스킬 포맷 판독. **★ 원게임 `itm_level`은 0-based**(우리 `level`은 표시 레벨 — **보정 금지**) |
| `docs/spec/references/게임데이터-판독요약.txt` | 위 문서의 확인용 요약(박스 도식) |
| `docs/ux/references/auction-detail-references.md` | 경매 상세 레퍼런스 조사 823줄(Steam·Baymard·NN/g 관찰) |
| `docs/ux/design-system.md` **§5.12** | **골드포스 아웃라인 원본 실측** — 선제 폐기 금지 |
| **`docs/board/reviews/FC-064-review.md`** | **리뷰 2회분 — critical/major/minor 8건과 근거.** 새 UI가 같은 함정을 판다 |
| `docs/game_ui/` | 원게임 자산(아트 648장 · `card_info/` 31 · `ingame/` 8 · 스킬표 PDF) |
| DB `new_sp` · `sp_2019` | 원게임 백업. **`sp_2019`는 실운영 백업이라 개인정보 우려 — 레포에 넣지 않음** |

---

## 교훈 (총괄이 새길 것)

### 이번 세션에서 새로 얻은 것
1. **★ 티켓은 계약의 사본이 아니라 요약이다.** 총괄이 FC-064 티켓에 `BID_002`를 "하한 미달"로
   잘못 옮겨 적었고(실제는 `BID_001`), **frontend-impl이 계약을 정본으로 삼아 올바르게 구현한 뒤
   오기를 보고했다.** **계약 세부를 티켓에 옮겨 적는 행위 자체가 새 오류원이 된다** —
   **코드를 옮기지 말고 출처를 가리켜라.**
2. **★ 규칙을 인용할 때 방향을 확인하라.** 종전 HANDOVER가 *"파일 이동 `git mv` 금지(C-075)"*로
   적었으나 **C-075는 그 금지를 *삭제한* 결정**이었다. 원 금지는 *"mv가 내용을 읽어서 옮긴다"*는
   **추론** 위에 세워졌고 실측(`rename(2)`이라 inode 보존·내용 미판독)으로 반증됐다.
   **파일 이동은 자유다.**
3. **에이전트의 발견을 그대로 옮기지 말고 대조하라.** 이번에 architect의 계약 주장 3건, reviewer의
   critical·major 2건을 **전부 원문으로 재확인**했고 **전건 성립**했다. 반대로 **총괄의 요약을
   에이전트가 바로잡은 것도 2건**이다(위 1번, 최소가 하락 시 "보존"을 "미보존"으로 오기).
   **검수 층은 총괄의 말이 아니라 코드를 읽어야 작동한다.**
4. **공용화는 결함도 공유시킨다.** `FilterSheet` → `Sheet` 일반화로 세 소비처가 한 구현을 쓰게
   되자 초점 강탈이 **3배로 걸렸고**, 반대로 **한 번 고치자 세 곳이 함께 닫혔다.** 양방향이다.
5. **회귀 테스트는 "수정 전 코드에서 실패하는지" 확인해야 진짜다.** 구현자가 의존 배열을 결함
   상태로 되돌려 4건이 실제로 실패하는 것을 확인한 뒤 복원했다. 통과만 하는 껍데기와 다르다.

### 이월된 교훈
6. **"확인해주세요"라고 할 때 무엇이 보이는 상태인지 먼저 확인할 것.** FC-057 후 "셸을 확인해달라"
   했으나 **전 라우트가 placeholder라 볼 것이 없었다.**
7. **템플릿·자산을 지목하기 전에 실제로 열어볼 것.** `ProductList`를 카드 그리드 참조로 지목했으나
   **실제로는 `DataTable`**이었다.
8. **★ 폐기 범위를 넓게 잡지 말 것.** "§5.12를 되살리지 마라"가 과했다 —
   **폐기된 것은 규칙·팔레트이지 원본 자산 실측이 아니다.** 이번 폐기에도 그대로 적용했다.
9. **선택지는 HTML 목업으로 보여줄 것**(메모리 `options-need-html-mockup`).
   레이아웃 3안은 비교본을 만들자 한 번에 결정됐고, 팔레트는 표로 물었다가 지적받았다.
10. **모바일 우선으로 짜라**(위 "승계된 발견" 6번).
11. **워킹트리를 파괴하는 git 명령 금지**(`reset --hard`·광범위 `checkout --`·`clean -fd`) — 전 세션 사고.
12. 통신은 파일로. **Jira 미러는 상태 전이마다 즉시**(메모리 `jira-mirror-discipline`) —
    비차단은 **실패 허용이지 생략 허용이 아니다.**
