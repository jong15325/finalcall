# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-24** (외부 툴(코덱스) 프론트 디자인 세션 통합 + 총괄 맥락 복원)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: 2026-07-24 외부 툴 **코덱스가 프론트(마켓 카드·인벤토리 슬롯) 디자인**을 하고
> 이 파일을 자기 세션 노트로 **덮어썼다** — 그 과정에서 총괄 맥락(완료 에픽·검색 스택·보드·미러)이 소실됐다.
> 이번 재작성은 **코덱스 세션(아래 A절)을 보존**하면서 **총괄 맥락(B절 이하)을 복원**해 통합한다.

---

## 지금 어디인가 — 한 문단

백엔드/프론트 기능 에픽(EPIC-SHOP·MARKET-DATA·SHOP-MANAGE·SEARCH)은 **전건 done·푸시 완료**(원격 `origin/master` @ bbf09e1 == 로컬). 2026-07-24 **외부 툴 코덱스가 프론트 시각 디자인**을 진행 — **마켓 아이템 카드 플립(hover/터치 → 스킬 뒷면)·앞면 타입 라벨·인벤토리 슬롯 96×178 확대**를 구현했고, 이 변경은 **아직 미커밋**이다. 코덱스는 **디자인 정본을 "HTML 템플릿 → 실제 `frontend/` 구현"으로 전환**했다(어제 총괄이 만든 `docs/ux/design-worklist.md`의 "템플릿 제작" 전제를 뒤집음). 코덱스 작업은 **우리 파이프라인(architect→impl→reviewer→게이트3) 밖**에서 이뤄졌으므로, 총괄이 **① 커밋 상태 정리 ② reviewer 검수 ③ 보드/미러 반영 ④ 디자인 정본 전환을 사용자에게 확인**해야 한다.

---

## A. 이번 프론트 디자인 세션 (코덱스, 2026-07-24) — 미커밋

> 외부 툴이 우리 오케스트레이션 밖에서 수행. 아래는 코덱스가 남긴 노트 + 총괄 검증 대상.

### 확정된 UX — 아이템 마켓 카드
- 카드 앞면 제목 = 아이템 이름 대신 **`블랙 - 방어구`·`골드 - 무기`** 형식(타입 라벨).
- 앞면에 채널 제한·골드포스 잔여일 텍스트 **미표시**. 단 게임 아트의 **골드포스 PNG 아웃라인 + 좌상단 3자리 잔여일은 유지**.
- **PC=이미지 hover / 모바일=이미지 터치 → 스킬 뒷면 전환.** 뒷면 = 카드타입·세부타입·스킬1·스킬2·판매자만.
- 스킬 1개여도 앞면 정보 영역 높이는 스킬 2개 카드와 동일(높이 통일).
- **비교 버튼 = 상세 링크와 독립 상위 레이어**(비교 클릭이 상세 이동 유발 금지). 상세 링크는 **이미지 아래 정보 영역에만**.
- 관련 파일: `frontend/src/features/item/components/ItemCard.{tsx,test.tsx}`·`ItemFrame.{tsx,css,test.tsx}`·`ItemSkillSummary.tsx`·`features/shop/components/ShopCard.{tsx,test.tsx}`.

### 확정된 UX — 인벤토리(보관함)
- **PC=슬롯 hover / 모바일=슬롯 터치 → 스킬 뒷면 토글.** 뒷면 = 스킬1·스킬2만. **스킬 없는 아이템은 안 뒤집힘.**
- **슬롯 72×134 → `96×178` 확대**(★ FC-102 "셀 72px 고정"을 이번 세션이 변경). 게임 아트 원본은 72×134 비율 유지·슬롯 중앙 배치.
- 반응형 **모바일 2 / 태블릿 3 / PC 6열**, 페이지당 24칸.
- 인벤토리 슬롯에서 **상세 링크 이미 제거**(아이템 상세 페이지 향후 제거 예정 — ★ 범위 사용자 확정 필요).
- 관련 파일: `frontend/src/features/member/components/InventorySlotGrid.{tsx,css,test.tsx}`.

### 결정 탐색 목업(신규, 정본 아님 — 옵션 비교용)
- `docs/ux/mockups/template-market-card-flip-options.html` (스킬 플립 3안)
- `docs/ux/mockups/template-market-card-info-options.html` (카드 정보 4안)

### 코덱스가 주장한 검증(★ 총괄 미확인 — reviewer 위임 대상)
- `InventorySlotGrid.test` 10 통과 · `ItemFrame`+`ItemCard`+`ShopCard` 22 통과 · typecheck·ESLint·Prettier 통과(코덱스 진술).
- 총괄 직접검증 금지 규약([[main-session-no-direct-verify]]) → **reviewer로 재검** 후 done 판단.

### 코덱스 세션의 제약(다음 세션 주의)
- `git status`/`git diff`가 **`dubious ownership`으로 차단**됨 → 코덱스는 커밋 못 함(미커밋 확정). 우리 셸은 정상(아래 B절 git 확인됨).
- `apply_patch` 샌드박스 오류로 일부 파일은 PowerShell UTF-8 쓰기로 적용(대상 = 위 파일 목록 한정).
- 헤드리스 브라우저로 hover 자동 캡처 실패(Edge 일반 렌더 캡처만 가능). **hover/터치 플립은 실브라우저 육안 확인 필요**.

### ★ 총괄이 할 일 (코덱스 세션 마감 처리)
1. **커밋 정리** — 미커밋 프론트 변경을 atomic 커밋으로(섹션 13, 커밋=자동). 티켓 발번(마켓 카드 / 인벤토리 슬롯 분리 가능).
2. **reviewer 검수** — 파이프라인 밖 작업이라 Done 전 필수. 마켓 카드 플립·비교 레이어 독립·인벤 96×178 반응형·a11y(터치 플립 키보드 접근성) 중점.
3. **미러** — 티켓 상태 전이마다 Jira 반영([[jira-mirror-discipline]]).
4. **디자인 정본 전환 사용자 확인** — 아래 C절.
5. **정리 대상**: `.tmp-market-debug/`(스크린샷 3장, 커밋 제외)·`docs/game_ui/card_info/*.png`(신규 4장, 추적 여부 결정).

---

## B. 총괄 맥락 (복원) — 완료 에픽·환경·보드

### 완료된 에픽 (2026-07-23, 전건 게이트3 done·사용자 승인·푸시됨)
- **EPIC-SHOP** (KAN-102): 고정가 마켓(등록·구매·취소·만료). 정산 자산(SettlementRecorder·sale_order) 재사용. V15.
- **FC-102** (KAN-114): 인벤토리 슬롯 UI 폴리시(당시 셀 72px 고정 — ★ 코덱스가 96×178로 변경, A절).
- **EPIC-MARKET-DATA** (KAN-108): skill_definition 244행·카드/상세 스킬명 노출·마켓 5천 로컬 시드.
- **EPIC-SHOP-MANAGE** (KAN-115): `GET /me/shops` 내 판매 조회·내리기.
- **EPIC-SEARCH** (KAN-119): ES 8.18.8(nori)+Kafka(KRaft)+Kafka Connect(Debezium+Aiven ES sink) 검색 스택. **정합성은 FC-110로 후속 분리.**

### 계약 정본
`docs/spec/{shop-spec v1.0, purchase-spec, closing-domain-spec, fee-policy-spec, skill-exposure-spec v1.0, search-spec v0.3, erd v1.4, api-contract v1.13}` · `references/game-item-skill-format.md §5`.

### 앱·검색 스택 실행 상태 (재부팅 시 내려감 — 없으면 아래 "환경 기동")
- docker `finalcall-mysql`·`finalcall-redis` + `finalcall-elasticsearch`(8.18.8 nori)·`finalcall-kafka`·`finalcall-kafka-connect` + 백엔드 bootRun(:8080) + 프론트 npm dev(:5173).
- **데모 계정**: `demo1`~`demo10` / `demo1234!`. 마켓 5천 시드(demo 판매자별 ~500). 5천 재시드는 DB 리셋 필요(DROP은 사용자 직접).

### 남은 것 / 후속 티켓 (done 안 막음)
- **FC-110 (KAN-124)**: 검색 정합성 하드닝(CDC 라이브 동기·화해 histogram·운영 초기색인). ★ 사용자 명시 이월.
- **FC-101 (KAN-113)**: 마켓 목록 대량 성능(ShopCard memo·per-second now 격리). 5천 깊은 스크롤.
- **하드닝 백로그**: 마감 잔액 락·초소액 settle·purchase×close 데드락·시드 오염·토큰 localStorage→쿠키·마스킹 게이트2·dev deps 취약점.

### 남은 백엔드 에픽 (동결 해제됨 — 게이트1부터)
- **EPIC-GRADE**(등급): grade-tier-spec v0.1·게이트2 8항목. 검색 등급 부스트(search-spec §6.1)가 소비.
- **준비중 자리 실기능화**: 충전(Toss)·커뮤니티 CRUD·알림·OAuth·이메일인증·슬롯확장.

---

## C. ★ 디자인 정본 소스 전환 (사용자 확인 필요)

- **코덱스 선언**: `docs/ux/mockups/template-*.html`은 **폐기·정본 아님**. 정본 = **현재 `frontend/` 구현**(Vuexy 클래스·기존 화면 스타일 적극 재사용). 사용자가 수정 지시 안 한 기존 디자인은 불변.
- **충돌**: 어제(2026-07-23) 총괄이 만든 `docs/ux/design-worklist.md`는 **"남은 화면을 HTML 템플릿으로 그린다"** 전제였다 → 이 전환으로 **그 방식은 무효**. 단 그 문서의 **화면 인벤토리·진행 순서·규약(Containment·블랙 CTA·반응형 별도)**은 실구현 기준으로도 유효한 참조로 남는다.
- **메모리 정합**: [[mockup-fidelity-only-fix]]("가져온 목업이 정본")와 방향 일치(HTML 템플릿이 아니라 실구현/사용자 목업이 정본).
- **총괄 할 일**: 이 전환을 사용자에게 명시 확인받고, 확인되면 `design-worklist.md` 머리말에 "정본=실구현" 전환을 반영(또는 폐기 표기). 그전까지 새 HTML 템플릿 제작 착수 금지.

---

## D. Git 상태
- **커밋된 것은 전부 푸시됨**: 로컬 `master` == `origin/master` @ `bbf09e1`. 이전 핸드오버의 "미푸시 다수"는 **해소**.
- **워킹트리 미커밋**(총괄이 정리):
  - M: 프론트 8파일(코덱스 — ItemCard·ItemFrame·ItemSkillSummary·InventorySlotGrid·ShopCard + css/test)
  - M: 이 파일(HANDOVER.md)
  - ??: `docs/ux/design-worklist.md`(어제 총괄)·`template-market-card-*.html`(목업 2)·`docs/game_ui/card_info/*.png`(4)·`ShopCard.test.tsx`·`.tmp-market-debug/`(스크린샷, 제외 대상)
- **push는 사용자만**(게이트3 훅이 에이전트 push 차단).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지.
2. 이 파일 + `git log --oneline -20` + `git status`.
3. 메모리: `brand-identity`·`mockup-fidelity-only-fix`·`gate2-plain-language`·`main-session-no-direct-verify`·`options-need-html-mockup`·`jira-mirror-discipline`.
4. 앱·검색 스택이 실행 중일 수 있다(B절). 다음 수로 진행.

---

## 다음 수
1. **사용자 "출근" 후 지시 대기** — 우선 후보:
   - **(a) 코덱스 프론트 세션 마감** — 미커밋 정리 → reviewer 검수 → 티켓/미러 → 커밋(A절 "총괄이 할 일"). **디자인 정본 전환 사용자 확인(C절) 선행.**
   - **(b) FC-110** 검색 정합성 하드닝(스택 떠 있어 이어가기 좋음).
   - **(c) EPIC-GRADE**(등급) 게이트1 또는 준비중 자리 실기능화·FC-101.
2. **미커밋 커밋 + push**(사용자) — 코덱스 프론트 작업 백업.

---

## 환경 기동 — ★ 함정 (검색 스택)
```bash
# DB/캐시: docker start finalcall-mysql finalcall-redis
# 검색 스택(무거움): cd backend && docker compose -f docker-compose.local.yml up -d --build
#   create-index: bash docker/search/create-index.sh (인덱스 템플릿+alias listings_search)
#   커넥터: docker exec -i finalcall-mysql mysql -uroot -proot < docker/search/mysql/debezium-user.sql; bash docker/search/register-connectors.sh
# 백엔드: JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11 ; (루트에서) ./gradlew :backend:bootRun --args='--spring.profiles.active=local'
#   → 부팅 재색인(local)이 ES에 ~5040건. Flyway V1~V16 자동.
# 프론트: cd frontend && npm run dev (localhost:5173, /api→8080 프록시+X-Gateway-Token)
```
- **함정 A(폐쇄망)**: Confluent Hub CDN 차단 — ES sink는 Aiven(GitHub).
- **함정 B(ES 버전)**: Boot 3.5 ES 클라=8.18.8 → 서버도 8.18.8(불일치 시 검색 503).
- **함정 C(인덱스 매핑)**: create-index는 인덱스 템플릿으로 keyword 매핑 고정(동적 text면 정렬 fielddata 오류).
- **함정 D(mysql binlog)**: finalcall-mysql이 compose 밖이면 CDC 라이브 동기 안 됨 → CDC 데모 시 재생성(볼륨 보존). 검색 자체는 부팅 재색인이 주 populator.
- **함정 E(gradlew cwd)**: bootRun은 레포 루트에서. ⚠ Flyway 체크섬 오류 시 `flyway repair`.

---

## 교훈
1. **외부 툴(코덱스) 작업은 우리 파이프라인 밖이다.** 총괄이 커밋·검수·미러·게이트를 사후에 회수해야 한다. 특히 핸드오버 같은 공유 파일을 덮어쓸 수 있으니 재작성 시 소실 맥락을 복원한다.
2. **라이브 실측이 정적 리뷰를 보완한다.** 검색 인덱스 매핑 버그처럼 hover/터치 플립도 실브라우저 확인이 필요하다.
3. **정산·검색·아트 자산 재사용 설계가 신규 속도를 만든다.**
4. **게이트2 평이 언어 + 큰 결정은 사용자**(디자인 정본 전환도 C절대로 사용자 확인).
</content>
