# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 2026-07-19 (**프론트 전면 재구축 — Ecme 템플릿 전환**. 종전 "디자인 목업" 단계 서술은 **전량 폐기**됐다)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

---

## ⚠ 먼저 알아야 할 것 — 하루 사이에 방향이 두 번 크게 바뀌었다

1. **백엔드 동결 · 디자인 우선**(2026-07-18) → 목업 6면 제작 → **EPIC-FE-REDESIGN**으로 React 반영(8티켓 완료)
2. 그 결과를 사용자가 보고 **"전체적인 디자인이 너무 별로다 · 영역별로 틀어진다"** →
   **구매 템플릿(Ecme)으로 프론트 전면 재구축** = 현재 진행 중인 **EPIC-FE-ECME**

**EPIC-FE-REDESIGN(FC-047~054)의 UI 산출물은 무효**다. 다만 **백엔드 시드(V12·V13)·문서·판독 결과는 유효**하고,
그 티켓들이 남긴 **규칙과 교훈이 현재 에픽의 입력**이다. 티켓은 이력으로 남겨뒀다.

**구 프론트는 `origin/master` `05b5e1b`에 있다.** 규칙을 다시 꺼낼 때 `git show 05b5e1b:frontend/...`로 본다.

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋 + 보안 층) 숙지.
2. `docs/board/` 스캔 — `epics/EPIC-FE-ECME.md`가 현재 에픽. 티켓 `FC-055`~`FC-059`.
3. **Jira 미러 패리티** — `state≠todo`인데 `jira_key: null`인 티켓 스캔(섹션 12). 현재 **드리프트 0**.
4. `git log --oneline -20` + `git status`, `@{u}..HEAD`.
5. 아래 "현재 상태"·"다음 수"로 진행.

---

## 환경 기동 — ★ 함정 3개

```bash
# 1) 인프라 (재부팅 시 내려감. 볼륨은 보존)
docker start finalcall-mysql finalcall-redis

# 2) 백엔드 — IntelliJ FinalcallApplication (local, JDK 21 C:\Users\howee\.jdks\ms-21.0.11)
#    Flyway V1~V13 자동 적용

# 3) ★ 함정 A — 시드 시각 되돌리기 (안 하면 카운트다운이 전부 "마감")
#    V13 주석 [B]의 재적용 SQL 4문장. 임박(4분30초)·초임박(28초)은 적용 직후 몇 분만 유효하다.
docker exec -i finalcall-mysql mysql -uroot -proot finalcall < <재적용 SQL>
#    → backend/src/main/resources/db/migration/V13__auction_bid_demo_seed.sql 주석 [B] 참조

# 4) 프론트
cd D:/Java/finalcall/frontend && npm run dev     # :5173

# 5) ★ 함정 B — 테마 프리셋이 안 보임
#    useThemeStore가 persist(localStorage 'theme')라 theme.config.ts 값은 초기값으로만 쓰인다.
#    이미 dev 서버를 연 브라우저에는 종전 값이 남아 변경이 반영되지 않는다.
#    DevTools:  localStorage.removeItem('theme')  후 새로고침 (또는 시크릿 창)
```

**★ 함정 C — 아트 크로마키**: 아이템 아트 PNG는 **알파 채널이 없고**(colorType 2) 네 귀퉁이가
`#0000FF` 크로마키다. `predev`/`prebuild`가 `scripts/pngChromaKey.mjs`로 **복사본만** RGBA 변환한다
(`public/art`, gitignore). **정본 `docs/game_ui`는 읽기만** 한다. 스크립트를 건너뛰면 모서리가 파랗게 보인다.

**⚠ Flyway 체크섬**: `V11`이 커밋 후 편집된 이력이 있다. 이미 적용한 DB는 `flyway repair` 없이 부팅 실패할 수 있다(FC-035 m9).

---

## 현재 상태

### 프론트 = Ecme 템플릿 기반 (전면 재구축)
| | 값 |
|---|---|
| 스택 | React **19** · Tailwind **4**(CSS-first) · Vite **6** · `react-router` **7** |
| 서버 상태 | **`@tanstack/react-query` 유지**(커서 페이징·캐시 키 분리·입찰 무효화 때문) |
| HTTP | **`apiClient`(fetch) 단일 전송로**. axios·swr·firebase는 `package.json`에서 **제거** |
| 테스트 | **vitest + testing-library, 228건** |
| 번들 | **478.77 kB / gzip 159.27** (framer-motion 제거분 유지) |
| 스타일 규약 | 템플릿 prettier — **`semi: false` · `tabWidth: 4`**(구 프론트와 다름) |
| 토큰 저장소 | **`localStorage`**(게이트2 판정) |
| 테마 프리셋 | **`themeSchema: 'dark'`** — 다크 모드가 **아니라 프리셋 이름**. `--primary` = `#18181B` |
| 레이아웃 | **B = `blank` + 자체 셸**(템플릿은 관리자용 사이드바뿐이라 셸만 우리가 짬) |

### ★★ 디자인 방침 — 세 번 좁혀졌다 (가장 중요)
1. 처음: "컴포넌트는 템플릿, 레이아웃은 우리"
2. 사용자 정정: **"우리가 정한 디자인 메인색·아이콘 스타일은 적용하지 않는다. 최대한 템플릿 디자인.
   레이아웃 등 배치 구조만 우리가 정한다."** → 퍼플 액센트·ink CTA·2px 밑줄·브랜드 마감선 **전부 폐기**
3. 사용자 추가 정정: **"Game-Color Containment도 템플릿에 맡겨"** → 속성 배지·아트 슬롯 배경·
   필터 칩까지 템플릿 방식. element 4색 토큰은 **애초에 이관되지 않았고 부활시키지 않는다**

**단 예외 하나**: 사용자가 **골드/블랙 아웃라인을 명시 지시**했다(태그 삭제 + 아웃라인 적용).
→ **`design-system.md` §5.12가 정본으로 되살아났다.** 원본 게임 자산 실측값(2겹 링·`--art-scale` 파생·
상한 9px·블랙 `#666664`/`#1F1F1C`)을 쓴다. **사용자가 "잘 적용되었다"고 승인했다.**

> **총괄이 저지른 오류**: "구 §5.12를 되살리지 마라"고 지시했었다. **폐기된 것은 Containment 규칙과
> 우리가 고른 팔레트이지, 원본 자산 실측 형태가 아니다.** 이 구분을 놓치면 또 지운다.

### 완료된 티켓 (EPIC-FE-ECME · KAN-65)
| 티켓 | 내용 |
|---|---|
| **FC-055**(KAN-66) | 템플릿 기반 이식 903파일. **`X-Gateway-Token` 프록시를 "헤더 도달"로 실측 검증** |
| **FC-056**(KAN-67) | 단일 전송로 확립, 계약 로직 5건 복원. **에러 코드 표를 계약 §5 파싱으로 대조**(사본 아님) |
| **FC-057**(KAN-68) | 공용 셸(레이아웃 B) · returnUrl · 404 · **framer-motion 제거 592→472KB** |
| **FC-058**(KAN-69) | 홈 + 아트 기반. 재작업 3회(피드백 12건 → §5.12 복원 → 모바일 파손) |
| **FC-059**(KAN-70) | **review** — 경매 목록. 커밋 `7e069ae`. 320~1440 **15지점 폭 전수 계산 파손 0** · 신규 60/전체 288 테스트 · 대비 29항목 미달 0. **디자인 게이트 대기(사용자 확인 필요)** |

### 백엔드 — 동결 유지
FC-052(`V12` 아이템 시드 40종)·FC-053(`V13` 경매 20건·입찰 27건)만 **한시 해제 후 복귀**했다.
**235 테스트 / 실패 0**. EPIC-CLOSING·EPIC-SHOP·FC-035 minor 5건은 여전히 동결.

**구현된 컨트롤러**: Auction · Auth · Bid · Exchange · Inventory · ItemInstance · ItemTemplate · Member · Notice
**계약엔 있으나 미구현**: `/shops` · `/market-prices` · `/me/orders` · `/charges` · `/admin/*`
→ **이 경로들을 화면에서 호출하지 마라.** FC-048이 계약만 보고 `/shops`를 넣었다가 홈에 에러 배너가 떴다.

---

## 다음 수
1. **★ FC-059 디자인 게이트** — 화면을 사용자가 직접 보고 판정. `npm run dev` → `/auctions`.
   통과면 `review_status: passed` + `done`, 반려면 `doing` 복귀.
   **홈(FC-058)도 같이 볼 것** — `auctionKeys` 개명·`AuctionListQuery` 확장이 홈에 도달한다.
2. **FC-064(경매 상세 + 입찰)** — 미개설. 안2 배치 · 스티키 입찰 바 · 아트 라이트박스 ·
   입찰 뮤테이션(`POST /auctions/{id}/bids`, 백엔드 구현됨) · 입찰 이력.
3. **FC-060 인증** → **FC-061 인벤토리** → **FC-063 reviewer** → 게이트3.
4. 사용자 push (미push 있음).

**화면 티켓은 한 번에 하나씩.** 홈이 3번 재작업된 뒤 FC-059에서 목록·상세를 쪼갰다 —
한 티켓에 화면 둘을 묶으면 한쪽 반려가 다른 쪽까지 되돌린다.

---

## 미결 — 사용자 판단 대기
1. **★ `design-system.md`의 지위.** 두 차례 정정으로 시각 결정이 거의 비었으나 **§5.12가 정본으로
   되살아나** FC-057의 "SUPERSEDED 제안"이 그대로는 안 맞는다. **자산 실측 사실은 살아 있고
   팔레트 결정만 죽은 상태**다. 잔여를 각 정본으로 이관할지 판단 필요.
2. **★ `PRODUCT.md`·`DESIGN.md`에 폐기된 퍼플 팔레트가 정본처럼 남아 있다** —
   **다음 세션이 참조하면 우리 시각 언어가 되살아난다.** 가장 위험한 미결.
3. **★ 템플릿 결함 2건 — 티켓으로 묶을 것**(FC-058·059가 각각 발견, 둘 다 템플릿 전역 문제)
   - `Button`이 **`disabled`를 DOM에 전달하지 않는다** — 클래스로만 흐리게 하고 내부에서 `onClick`을
     막아 **눈에만 비활성이고 보조기술에는 멀쩡한 버튼**이다.
   - `ui/Checkbox` **배럴이 lodash를 끌고 온다** — `Checkbox.Group`이 `cloneDeep`·`remove`를 쓰는데
     배럴이라 함께 딸려온다. **체크박스 한 개에 약 33 kB**, 메인 청크에 lodash가 없어 **순수 증가**다.
     FC-059는 `ui/Checkbox/Checkbox` 직접 임포트로 피했다(44.13 → 19.48 kB). **다른 화면도 같은 값을
     낸다** — 배럴을 쓰는 곳을 전수로 잡아야 한다.
4. FC-043 인증 **판단 대기 4건**(약관 문장 vs 체크박스 · 네이버 대비 1.94:1 · 가입 CTA 문구 ·
   폼 좌측 배치) — FC-060에서 필요.

## 게이트2 후보 (계약 변경 — 백엔드 동결이라 문서만 가능)
- **자유문 검색** — 계약 §3·§4.1에 `q`/keyword 없음. 셸이 **자리는 수용하되 컨트롤은 안 만들었다**
- **`AuctionDetail.isSeller: boolean`** — 상세에 판매자 식별자가 없어 `BID_003`(자기 경매) 분기 불가.
  `sellerPublicId`는 공개 엔드포인트에 식별자를 노출해 SEC-007과 마찰 → `isSeller` 권고
- **★ 스킬 코드→이름 매핑 API 부재** — 필터 축 `skill1`/`skill2`는 계약에 있는데 **사전을 주는
  엔드포인트가 없다**(`GET /item-templates`는 4축만). 선택지를 만들 수 없어 FC-059가 필터를 뺐고,
  **FC-064 상세가 `skillPercent`를 표시할 때 같은 벽**에 부딪힌다. 판독 결과는
  `references/game-item-skill-format.md`에 있으니 **데이터가 아니라 노출 경로가 없는 것**이다
- **계약 §2 로그아웃 요청 바디 명세 누락** — 구현은 `{refreshToken}` 필수. **계약만 보고 짜면 400**
- `sort` 화이트리스트에 **`bidCount` 없음** — "인기순" 섹션 불가
- **운영 DB 시드 오염** — Flyway location 단일이라 데모 계정 3개(BCrypt 평문 `"password"`) +
  게임머니 1,500만 + 경매 20건이 **부팅과 동시에 운영에 들어간다.** 프로파일별 시드 분리 필요
- **토큰 저장소 재검토** — `localStorage` 판정 근거는 *"안전해서가 아니라 제약상 셋 다 XSS 등가"*다.
  진짜 개선은 백엔드 변경(refresh를 httpOnly 쿠키 + CSRF) → **동결 해제 시**

## 백로그
CI 연동(테스트 자산은 자동 실행 없으면 반감기가 짧다) · 프론트 테스트 러너는 도입 완료 ·
참조 잃은 템플릿 레이아웃 다수 정리 · prettier 템플릿 원본 50여 파일 경고 · SPA soft-404 ·
`design-system` §2.4 빈 표(v0.4 잔재) · EPIC-CHARGE · EPIC-OAUTH · PR 워크플로우 ·
EPIC-GAME-PROFILE(게임데이터 통합, `docs/portfolio/process-log.md` 항목3)

---

## 유효한 자산 (버리지 말 것)
| 자산 | 내용 |
|---|---|
| `docs/spec/api-contract.md` **v1.10** | **§3.3.1 코드 사전** — `1[subGroup][element][kind]`, element 1물·2불·3흙·4바람, **`kind`는 `subGroup` 종속** |
| `docs/spec/references/game-item-skill-format.md` | 스킬 포맷 판독. **★ 원게임 `itm_level`은 0-based**(우리 `level`은 표시 레벨 — **보정 금지**) |
| `docs/spec/references/게임데이터-판독요약.txt` | 위 문서의 확인용 요약(박스 도식) |
| `docs/ux/references/auction-detail-references.md` | 경매 상세 레퍼런스 조사 823줄 |
| `docs/ux/design-system.md` **§5.12** | **골드포스 아웃라인 원본 실측** — 되살아난 정본 |
| `docs/game_ui/` | 원게임 자산(아트 648장 · `card_info/` 31 · `ingame/` 8 · 스킬표 PDF) |
| DB `new_sp` · `sp_2019` | 원게임 백업. **`sp_2019`는 실운영 백업이라 개인정보 우려 — 레포에 넣지 않음** |

---

## 이 세션의 교훈 (총괄이 새길 것)

1. **"확인해주세요"라고 할 때 무엇이 보이는 상태인지 먼저 확인할 것.**
   FC-057 후 "셸을 확인해달라"고 했으나 **전 라우트가 placeholder라 볼 것이 없었다.**
   라우트를 열어보면 5초에 알 수 있었다.
2. **템플릿·자산을 지목하기 전에 실제로 열어볼 것.**
   `ProductList`를 카드 그리드 참조로 지목했으나 **실제로는 `DataTable`**이었다.
   캐러셀도 **Ecme만 보고** "없다"고 답했는데 `/d/web_template/`에 템플릿이 여러 개 있었다.
3. **폐기 범위를 넓게 잡지 말 것.** "§5.12를 되살리지 마라"가 과했다 —
   **폐기된 것은 규칙·팔레트이지 원본 자산 실측이 아니다.**
4. **선택지는 HTML 목업으로 보여줄 것**(메모리 `options-need-html-mockup`).
   레이아웃 3안은 비교본을 만들자 한 번에 결정됐고, 팔레트는 표로 물었다가 지적받았다.
5. **에이전트의 발견을 그대로 옮기지 말고 대조할 것.**
   "시드 이름과 계약 `kind` 사전 모순" 보고가 **V9만 보고 판단한 stale**이었다(V12가 이미 정정).
6. **모바일 우선으로 짜라.** FC-058이 데스크톱 기준으로 짜서 **320~1024가 전부 깨졌고**,
   그게 **아웃라인 비율까지 4배 어긋나게** 만들었다. 참고 대시보드 관례(`grid-cols-1`에서 시작 ·
   루트 `overflow-x-hidden` · 고정 폭은 큰 BP에서만)를 처음부터 따를 것.
7. **워킹트리를 파괴하는 git 명령 금지**(`reset --hard`·광범위 `checkout --`·`clean -fd`) — 전 세션 사고.
8. 파일 이동 `git mv` 금지(C-075). 통신은 파일로. Jira 미러는 상태 전이마다 즉시(메모리 `jira-mirror-discipline`).
