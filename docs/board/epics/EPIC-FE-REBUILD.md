---
id: EPIC-FE-REBUILD
type: epic
jira_key: KAN-73
title: 프론트 재구축 — 사용자 목업 기반 (템플릿 폐기)
state: doing
children: [FC-066, FC-067, FC-068]
gate: null
---
## 목표
**사용자가 준비하는 디자인 목업**을 정본으로 프론트를 다시 만든다.
Ecme 템플릿과 우리가 쌓은 시각 결정을 **전부 폐기**하고, **계약 종속 로직·전송 층만 승계**한다.

## 상태: `doing` — 게이트1 승인, FC-066(계약 매핑) 착수
**목업 도착 완료**(장터, Vuexy Bootstrap5 정적 HTML — 사용자 소유, 레포 밖). 정본 핸드오프 =
`.../game-market/HANDOVER_FULLSTACK.md`.

### 게이트1 승인 (2026-07-21)
1. **범위 = 백엔드 준비된 화면만 실연동**(동결 유지). 미구현(고정가 마켓·충전/결제·커뮤니티 CRUD·
   알림·OAuth·이메일인증·슬롯확장)은 "준비 중" 자리로만.
2. **계약 충돌 = 기존 api-contract가 정본.** 목업 추가개념(등급·확장 element·프레임 다종·스킬 이름·
   입찰 version)은 데이터 뒷받침 시만 렌더, 없으면 standard 폴백.

### 분해안 (FC-066 델타 확정 후 하위 티켓 순차 생성)
```
FC-066 architect 계약 매핑(현재 doing) + 폐기(318)/보존(45) 실행 근거
FC-067 앱 셸(AppShell: Sidebar·TopNavbar·MobileBottomNav·RouteOutlet)·라우팅·장터 브랜드·토큰
FC-068 공통 도메인 컴포넌트(ItemFrame·ItemCard·CodeAmount·SkillSummary — item-frame.css·크로마키·정수배)
FC-069 인증·세션(로그인/회원가입 basic·JWT 회전 승계) / OAuth·이메일인증 자리만
FC-070 홈  ·  FC-071 경매목록  ·  FC-072 경매상세+입찰(FC-064 함정 승계)  ·  FC-073 판매등록
FC-074 마이페이지  ·  FC-075 지갑(표시+교환, 충전 자리만)  ·  FC-076 인벤토리+임시보관+아이템상세
FC-077 미연동 자리(마켓·커뮤니티·알림·충전·비교) "준비 중"
```
번호는 FC-066 델타 반영 후 조정될 수 있다.

## 왜 (사용자 결정 2026-07-20)
> "디자인 전면 변경할 예정이야, 디자인 목업을 준비해올게. 우리가 하던 디자인은 전부 폐기 진행하고
> 프론트도 작업한 것도 폐기 다시 할 예정"

**네 번째 방향 전환**이다. 이력:
1. 백엔드 동결 · 디자인 우선 → 목업 6면 제작 (EPIC-DESIGN-TEMPLATE)
2. → React 반영 (EPIC-FE-REDESIGN, 8티켓) → **사용자 판정: "디자인이 너무 별로 · 영역별로 틀어진다"**
3. → 구매 템플릿(Ecme)으로 전면 재구축 (EPIC-FE-ECME, FC-055~059·064) → **이번 폐기**
4. → **사용자 목업 기반 재구축** ← 현재

**★ 그래서 이번엔 목업이 먼저다.** 종전 세 번은 전부 "시각 방향을 우리가 정하거나 고른" 뒤
사용자가 실물을 보고 뒤집는 형태였다. 목업이 정본으로 먼저 오면 그 왕복이 없어진다.

---

## ★★ 보존 목록 (재구축이 승계하는 것 — 45파일)

**이것들은 디자인이 아니라 계약을 인코딩한 것이다.** 버리면 같은 계약 사실을 다시 도출해야 하고,
**이번에 잡은 버그를 다시 만난다.**

### `frontend/src/features/auction/lib/` — 도메인 로직 (32파일 중)
| 파일 | 무엇을 인코딩하나 |
|---|---|
| `auctionPhase.ts` | **마감 판정 `now >= endAt`.** 서버 `status`를 믿으면 안 되는 이유(마감 강등 워커 부재)가 여기 들어 있다 |
| `bidErrors.ts` | 계약 §5 `BID_001~007`·`AUCTION_004` 코드별 문구. **`BID_001`=최소 증분 미달, `BID_002`=buyNowPrice 이상**(총괄이 티켓에 뒤집어 적었던 그것) |
| `bidAmount.ts` | **금전 규칙 3갈래** — 프리필 갱신 / 사용자 입력이 최소가 이상이면 보존 / 미만일 때만 상향. **리뷰 major(M-1)의 해답** |
| `auctionPrice.ts`·`countdown.ts`·`useNow.ts` | 가격 표기·잔여시간·단일 타이머 구독 |
| `auctionFilters.ts` | **`kind`가 `subGroup` 종속**이라는 계약 §4.1 방어. `normalizeFilters` 한 곳에 있어 URL·칩·초기화가 전부 통과한다 |

### `frontend/src/features/item/lib/` — 자산·코드 사전
`itemCode.ts`(§3.3.1 코드 사전) · `itemArt.ts`(아트 경로) · `element.ts` · `goldforce.ts`(계약 파생 판정) ·
`artChromaKey` 관련(★ 아트 PNG는 알파가 없고 네 귀퉁이가 `#0000FF` 크로마키다)

### `frontend/src/lib/` — 전송·계약 층 (13파일)
`api/client.ts`(**단일 전송로** · JWT 회전 · `X-Gateway-Token` 프록시) · `api/errors.ts`(에러 봉투) ·
`api/session.ts` · `api/auctions.ts`·`auth.ts`·`balance.ts` · `queries/*`(커서 페이징 · **캐시 키
`preview`/`browse` 분리** — 홈이 목록 필터에 딸려 무효화되지 않게 한 것) · `returnUrl.ts` · `queryClient.ts`

### 테스트 18파일
위 로직에 붙은 테스트. **화면 테스트 5개(`AuctionDetail`·`AuctionList`·`Home`·`AppShell`·`BrandWordmark`)만 죽는다.**

---

## 폐기 목록 (318파일)
`src/components/ui/` 200 · `src/components/template/` 40 · `src/assets/styles/` 50 · `src/views/` 28
\+ `src/components/{brand,layouts,shared}` · `configs/theme.config.ts` 등 템플릿 잔재.

**문서**: `docs/ux/design-system.md`의 팔레트·컴포넌트 결정 · `docs/PRODUCT.md`·`docs/DESIGN.md`의
**폐기된 퍼플 팔레트**(HANDOVER가 "가장 위험한 미결"로 표시했던 것 — 이번에 확실히 정리한다).

### ★ 폐기하지 않는 것 — 지난번 실수 반복 방지
HANDOVER 교훈 3번: *"폐기 범위를 넓게 잡지 말 것. 폐기된 것은 규칙·팔레트이지 **원본 자산 실측**이 아니다."*
- **`design-system.md` §5.12 골드포스 아웃라인** — 원본 게임 자산 **실측값**(2겹 링·변마다 다른 베벨
  색·`--art-scale` 파생·상한 9px). 우리가 고른 색이 아니다. **목업이 아웃라인을 안 쓰기로 하면
  그때 폐기하되, 지금 선제 폐기하지 않는다.**
- `docs/spec/**` 계약·ERD·도메인 spec — **디자인과 무관**
- `docs/spec/references/game-item-skill-format.md` · `게임데이터-판독요약.txt` — 판독 사실
- `docs/ux/references/auction-detail-references.md`(823줄) — **레퍼런스 조사**. 목업이 다른 배치를
  택하면 결론은 죽지만 **조사한 사실(Steam·Baymard·NN/g 관찰)은 남는다**
- `docs/game_ui/` 원본 자산

---

## 목업 도착 시 확인할 것 (게이트1 전에)
1. **목업이 어느 폭을 정의하는가** — 데스크톱만인지, 모바일도 별도 설계인지.
   ★ 사용자 지속 원칙: *"반응형은 배치 변경이 아니다. 웹은 웹, 모바일은 모바일."*
   목업이 데스크톱만이면 **모바일 설계는 여전히 우리 몫**이고 그 자체가 승인 대상이다.
2. **컴포넌트 어휘가 정의돼 있는가** — 버튼·폼·모달·표가 목업에 있으면 그대로, 없으면 우리가 정한다.
3. **골드포스 아웃라인(§5.12)을 쓰는가** — 쓰면 실측값 승계, 안 쓰면 그때 폐기.
4. **아트 슬롯 처리** — 원본 아트는 50×93 도트라 **정수배 확대 + `image-rendering: pixelated`**가
   필수다(비정수 배율이면 뭉개진다). 목업이 다른 크기를 전제하면 조정이 필요하다.

## 미결 — 목업과 함께 판단
- **빌드 툴체인 지위.** Vite 6 · React 19 · Tailwind 4 · vitest는 **디자인이 아니라 기반**이라
  유지가 기본이나, 템플릿에서 온 설정(prettier `semi:false`·`tabWidth:4` · CSS 6레이어 분할)은
  템플릿과 함께 재검토 대상이다. **툴체인까지 갈아엎으면 보존 대상 45파일의 테스트도 다시 배선해야 한다.**
- **`design-system.md`의 최종 지위** — 팔레트가 죽고 §5.12만 남으면 문서로 유지할 가치가 있는지.

## 승계된 발견 (새 프론트에서도 유효)
- **FC-065(KAN-71) 템플릿 결함 2건은 자동 소멸**했다(`cancelled`). 다만 **교훈 둘은 그대로 유효**하다:
  - **비활성 상태는 클래스가 아니라 DOM 속성으로 낸다.** `opacity-50`만 붙이고 `onClick`을 내부에서
    막으면 **눈에만 비활성이고 보조기술엔 멀쩡한 버튼**이 된다(WCAG 4.1.2). 키보드로 활성화되지만
    아무 일도 안 일어나는 **침묵의 무반응**. → 새 버튼은 `disabled`/`aria-disabled`를 **반드시 DOM에**.
  - **배럴에 무거운 의존을 가진 형제를 넣지 마라.** `Checkbox.Group`이 `lodash`를 쓰자 배럴을 타는
    **모든 화면이 청크마다 약 33 kB**를 물었다(직접 임포트로 44.13 → 19.48 kB 실측).
- **`Sheet` 초점 강탈 패턴**(리뷰 C-1): effect 의존에 인라인 콜백이 들어가고 부모가 매초 리렌더하면
  초점이 매초 강탈된다. **모달을 새로 만들 때 같은 함정을 판다.** 해법은 콜백을 ref에 담고
  의존을 `[open]`으로 줄이는 것.
- **`min` 속성이 제출을 가로챈다** — 브라우저 기본 검증과 자체 에러 표시가 두 모습으로 보인다.
  `noValidate`로 말하는 주체를 하나로 모은다.
- **모바일 우선으로 짜라** — 데스크톱 기준으로 짜면 320~1024가 전부 깨진다(FC-058 실증).
- **계약에 있으나 백엔드 미구현**: `/shops`·`/market-prices`·`/me/orders`·`/charges`·`/admin/*`·
  **`/auctions/{id}/purchase`**. 화면에서 호출하면 404다.
