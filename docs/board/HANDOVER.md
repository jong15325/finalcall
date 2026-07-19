# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 에픽 완료마다 + 세션이 무거워질 때(덮어씀, 이력은 git).
갱신: 2026-07-19 마감 (**EPIC-BID 완료·Done·push** / **★ 방침 전환 — 백엔드 동결·디자인 우선** / EPIC-DESIGN-TEMPLATE 착수: FC-041 홈 완료·FC-043 인증 산출)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 아래 "다음 수"부터 진행한다.

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋 + 섹션 13 보안 층) 숙지.
2. `docs/board/` 스캔 — 에픽·티켓 상태(YAML `state`), `reviews/`.
3. **Jira 미러 패리티** — `state`가 todo 아닌데 `jira_key: null`인 티켓/에픽 스캔·백필(섹션 12). (커밋 전 `check-mirror-drift.js` 훅이 계층① 자동 경고.)
4. `git log --oneline -20` + 미push 확인(`git status`, `@{u}..HEAD`).
5. 이 파일의 "현재 상태"·"다음 수"로 진행.

## 환경 기동 (세션 시작 시 확인)
Docker 컨테이너는 재부팅 시 내려간다. **작업 트리·git·Docker 볼륨(데이터)은 디스크에 보존**된다.
1. **Docker 인프라 기동**: `cd D:/Java/finalcall/backend && docker compose -f docker-compose.local.yml up -d` → MySQL(3306)·Redis(6379). (finalcall DB + new_sp DB 볼륨 보존됨.)
2. **백엔드**: IntelliJ `FinalcallApplication`(local, JDK 21 `C:\Users\howee\.jdks\ms-21.0.11`). Flyway **V1~V11** 검증. 또는 `JAVA_HOME=... ./gradlew.bat :backend:bootRun`.
   - **⚠️ Flyway 체크섬 주의**: `V11`이 커밋 후 편집됐다(`5a4d24a`가 `CHECK` 추가). V11을 **이미 적용한** DB는 `flyway repair` 없이 부팅 실패한다. 당시 로컬은 V3였으므로 정상이나, 다른 환경에서 걸리면 이게 원인이다(FC-035 m9).
3. **프론트**: `cd D:/Java/finalcall/frontend && npm run dev`(:5173). 또는 **IntelliJ 실행 구성 `frontend dev`**(`.run/`에 4종 커밋됨 — dev·build·typecheck·lint).
   - vite 프록시가 `/api`→:8080 + **`X-Gateway-Token` 주입**을 한다(`vite.config.ts`, 커밋됨). **이게 없으면 화면 전체가 `GATEWAY_403` 에러 상태로만 보인다** — 실제로 한 번 그렇게 나갔다.
4. **게임 DB**: `new_sp`(42테이블)·`old_sp`(웹 DB) 볼륨 보존 — 재임포트 불요.
5. **디자인 목업은 서버 불요** — `docs/ux/mockups/*.html`을 브라우저로 바로 열면 된다.

## 현재 상태
- **워크플로우**: 4에이전트 오케스트레이션 + portfolio-writer + consultant(휴면). 훅 2개: `block-git-push.js`·`check-mirror-drift.js`.
- **완료 에픽(done·Jira 완료·push됨)**:
  - EPIC-MEMBER(KAN-2~7) · EPIC-CURRENCY(KAN-9~13) · EPIC-FE-MEMBER(KAN-14~19) · 백로그 FC-006/011/017/018(KAN-8/20/21/22).
  - **EPIC-ITEM(아이템·인벤토리, KAN-23~29) ✅ 완료·push됨**. FC-019 architect / FC-020~023 backend-impl 순차(V6~V9) / FC-024 reviewer PASSED. item_template·item_instance·인벤토리(96칸+temp)·소유이력 + 카탈로그/상세/인벤토리 API + 최소 시드. spec `docs/spec/item-domain-spec.md`(v0.2), erd v0.9.
  - **EPIC-AUCTION(경매, KAN-30~35) ✅ 완료·push됨**. FC-025 architect(spec v0.2·계약 v1.7, 게이트2 6결정) / FC-026~028 backend-impl 순차 단일패스(V10) — 등록·목록·상세·취소 + item LISTED CAS(G4 교정)·에스크로 왕복, 테스트 슬라이스5+통합21+동시성1 / FC-029 reviewer PASSED(critical 0·major 0·minor 8).
  - **보안 층 첫 실적용 완료**(섹션 13): 에픽 완료 온디맨드 `/security-review` 1회 실행 → **HIGH/MEDIUM 발견 0건**. 인가(주체=SecurityContext·IDOR 없음)·SecurityConfig permitAll GET 한정 스코프·에스크로 CAS 단일승자·QueryDSL 인젝션 없음·응답 PII 미노출 전부 확인. 기준미달 관찰 3건은 백로그 등재.
  - 주의: 스킬이 `origin/HEAD` 미설정으로 1차 실패 → `git remote set-head origin master`로 해소. 또 **push 완료 후엔 기본 diff 범위가 비므로** 범위를 수동 지정해야 한다(이번엔 `415e6e3..HEAD`).
- **EPIC-BID(입찰, KAN-36~42) ✅ 완료·Done**. FC-030 architect(게이트2 5결정·계약 v1.8→v1.9·erd v1.0) / FC-031 스키마·홀드(V11) / FC-032 ★입찰 API(**auction 행 비관적 락 + 금전 조건부 CAS** — Redis 분산락은 게이트2에서 기각) / FC-033 내역조회·최고가 실값 대체·`minNextBidAmount`·keyset 교정 / FC-034 동시성 불변식 I1~I10 전수 검증(뮤테이션 검증 1건 포함) / FC-035 reviewer **PASS**(critical 0·major 0·minor 9). **전체 235 테스트 / 실패 0.**
  - **에픽 완료 `/security-review` 발견 0건** — 음수 금액 반전 공격 4중 차단(`@Positive`→`BID_001`→서비스 검증→DB CHECK), 단일 트랜잭션 경계가 롤백 테스트로 실증, 데드락은 "각 TX가 경매 락 1개만 잡음"으로 원리적 불가 확인.
  - **`ENABLE_STOP_REVIEW` = `0` 복귀 완료**(한시 on 구간 종료).
  - **후속 티켓 필요(FC-035 minor, 백엔드 재개 시)**: m1 락 후 시각 재포착(**I8 유일 사각**) + m2 `applyBid` CAS 가드 / **m4 `MEMBER_002` 탈퇴 TOCTOU — EPIC-BID가 활성화시킨 갭이라 EPIC-CLOSING DoD 구속 필수** / m6 마스킹 3번째 사본 위임 / m8 계약에 `COMMON_004` 추가 / m9 Flyway append-only 규율. 추가로 `/security-review` 관찰 2건(잘못된 커서·빈 바디가 400 대신 500).
- **end-of-turn 보안 리뷰 = 배선·on**(2026-07-18 신규): `.claude/hooks/stop-security-review.js` + `settings.json`(`Stop` 훅 + `env.ENABLE_STOP_REVIEW=1`).
  - 섹션 13에 `ENABLE_STOP_REVIEW`가 있었지만 **실배선은 없었다**(문서상 의도만). 이번에 Node로 신규 구현 — 민감경로(bid·auction·settlement·currency·auth·money_hold·SecurityConfig·jwt/token/secret·db/migration) 변경 시 재프롬프트, **warn-only**(커밋·push 무간섭). Python 의존 없음.
  - 스모크 7케이스 검증 통과. 중복 억제 서명은 **민감파일 내용 해시 기반**(git status 문자열 기반은 dirty 파일 재편집을 못 잡아 폐기). 상태파일 `.claude/.stop-review-state`는 gitignore(추적 시 서명이 매 턴 바뀜).
  - **EPIC-BID 종료 시 `0` 복귀 필수.**
- **old_sp 웹 DB**: `sp_web-210715.sql`(phpMyAdmin 5.6 덤프, 80KB) → docker finalcall-mysql DB `old_sp`(utf8mb3), 유저 `sp/sp` 권한 부여. 임포트 exit 0. **⚠️ 검증(테이블 수·행수·한글 정합) 미실시** — 사용자 지시로 생략. 사용 전 확인 필요.
- **new_sp 게임 DB**: 원게임(SP) 백업 임포트 완료(docker finalcall-mysql, DB `new_sp`, 유저 `sp/sp`, 42테이블·user 2440행). D-067 원게임 실데이터 소스·게임 차용 UI 매핑 원천. finalcall과 격리.
- **게임데이터 통합 논의(OPEN)**: `docs/portfolio/process-log.md` 항목3. new_sp가 라이브 인게임 DB로도 쓰일 예정 → 정규화 시 단일진실원 이원화·크로스DB 조인·화폐 소유권 문제. 업계 리서치 완료(옵션 A read-only복제·B CDC·C API·절충=읽기 복제·쓰기 소유자 위임). 합의는 EPIC-GAME-PROFILE 착수 시.
- **디자인**: U-021 라이트 커머스 실코드 반영. 게임차용 노트 `docs/game_ui/게임 차용 디자인 및 erd.txt`(미커밋 참조자료).
- **★ EPIC-DESIGN-TEMPLATE(디자인 목업, KAN-49~52) — 진행 중**. 정적 HTML 목업으로 시각 디자인을 먼저 확정하고 그다음 프론트가 집행한다.
  - **FC-041(KAN-50) ✅ 완료** — 공통 셸 + 홈. `template-home-logged-out.html`·`template-home-logged-in.html`.
    - 확정된 디자인 결정: 홈을 "마케팅 랜딩"이 아니라 **거래소 첫 화면**으로(스크롤 0px에 실제 카운트다운 — 카피로 주장하지 않고 데이터로 증명) / 브랜드는 색분할이 아니라 **활자 덩어리 + `CALL` 퍼플 2px 마감선**(경매 카드 잔여시간 게이지와 같은 형태) / 헤더 2행 / 활성 내비는 퍼플이 아니라 **near-black 2px 밑줄** / 섹션마다 구조 변주(피처드·격자·카드·행목록·표) / 여백 3단 48·64·80.
    - **밋밋함 해소** — 원인은 `bg`·`surface`·`surface-raised`가 **전부 순백**이라 깊이가 그림자·선에만 의존한 것. **표면 층 분리**(`bg #F7F7F8` / `surface #FFFFFF` / `surface-band #EFEFF1` 신설 / `surface-sunken #E8E8EB`) + 섹션 밴딩으로 해결. **색은 추가하지 않았다**(§1.2 불변).
    - 대비 보정 동반: `text-subtle #71717A→#67676E`, `border-strong #8A8A8F→#818187`. 종전값은 새 배경에서 **AA 미달**이었다(band 4.40·sunken 3.99).
  - **FC-043(KAN-52) — 산출 완료·게이트 대기** — 인증 화면. `template-auth-login.html`·`template-auth-signup.html`.
    - 셸: "내비 0"을 폐기하고 **최소 셸**(워드마크 헤더 68px + 축약 푸터) — *"돈을 다루는 제품에서 브랜드 없는 로그인 화면은 피싱 화면과 구별되지 않는다."*
    - OAuth 자리 **지금 확보**(나중에 넣으면 카드 높이 40% 증가 = 재설계).
    - 에러 처리를 두 화면에서 **반대로**: 로그인 실패는 폼 단위 배너만(필드 강조 시 회원 열거 힌트, SEC-007) / 가입 중복은 필드 단위.
    - **창작하지 않은 것**: 약관 동의 체크박스(계약 §2에 동의 필드 없음) · 비밀번호 규칙 힌트(계약이 정책 미명세 — 지어내면 "안내는 통과인데 400").
  - **FC-042(KAN-51) — 대기**. 경매 목록·상세. 사용자가 인증을 먼저 요청해 뒤로 밀림.
- **골드포스 아웃라인 — 확정**(design-system §5.12 신설). A안(아트 프레임)·**5px**·2겹·대각 셰인(↖→↘)·흰색 2패스 합성·`--art-scale` 파생(상한 9px).
  - 원본 `.spr` 해독 결과(9프레임 rect·대각 경로)와 실측 색값을 **§5.12에 이관**했다. 프로토타입이 사라져도 재현 가능.
  - **아트 슬롯 배경 = 1-b 딥 글로우 확정**(검정 단일 슬롯 폐기). §5.3·§2.1·§2.6·§2.7·§1.2 개정. 연틴트 안은 **금색 대비가 1.46~1.52로 무너져** 기각(검정 12.03 → 딥글로우 코어 7.12~8.63).
  - 프로토타입 2파일(`proto-goldforce-outline.html`·`proto-item-slot-background.html`)은 **결정 근거 보관용**. 정본은 design-system이다. "정본 아님" 주석 삽입은 **미실시**(사용자 동의는 받음).
  - **미결 4건**(§5.12에 "미결" 표기): 셰인 속도(3s 제안값 — `.spr`에 시간 필드가 없어 **원본 복원 불가**) · 잔여시간 노출 범위(목록 vs 상세) · 임박 기준(24h, 근거 없음) · **`card_image/gold_force/` 전용 아트 9종의 도메인 의미**(상태 표시인가 별도 아이템 종류인가 — 계약·erd로 판별 불가, **사용자만 답할 수 있다**).
- **FC-043 판단 대기 4건**: 약관 동의(문장 vs 체크박스 — 체크박스면 계약에 동의 필드 추가) · 네이버 버튼 대비(흰 라벨 on `#03C75A`가 **약 3.0:1로 규격 자체가 AA 경계**, OAuth 실착수 시 결정) · 가입 CTA "회원가입"→"가입하기"(코드 반영 시 문구 변경) · 폼 좌측 배치(DOM 순서 규칙을 관례보다 우선).
- **이메일 인증(추후 도입) 사전 검토 완료**: 계약 §2에 **이메일 필드 없음** 확인(`signup` body = `{loginId, password, nickname}`). 목업에 자리만 잡음(아이디 다음, 4→5필드 비례 영향 계산). **별도 "발송 안내" 화면 없이 로그인 성공 배너 롱버전만으로 도입 가능**함을 실측 확인. 도입 시 계약 반영 목록: `signup.email`+중복 에러코드 / `GET /me`에 `email`·`emailVerified` / `POST /auth/email/verify`·`/resend`(rate limit) / **미인증 계정 권한 정책(입찰·등록 차단 여부 — 도메인 결정 필요)** / erd `member.email`·`email_verified_at` + 토큰 테이블.
- **push 상태**: origin/master = `db3b1b5`. **미push 다수**(EPIC-BID 마감분·디자인 목업·design-system v0.5). 마감 시 push 권장.
- **미커밋 없음**(2026-07-18 기준). 종전 "의도적 미커밋" 2건이 모두 정식 추적으로 전환됐다:
  - `frontend/vite.config.ts` — FC-036 커밋 `e6f2476`. dev 프록시 `/api`→`:8080`은 레포 설정이 맞다고 판단해 수용.
  - `docs/game_ui/` — 사용자 지시로 커밋(`2cf8236`). **⚠️ 커밋 메시지 정정**: 제목에 "982파일"로 적었으나 **실제 추가는 41파일**(`my_card/` 32 · `ingame/` 8 · 게임 차용 노트 txt 1)이다. 나머지 941파일은 이 세션 전 `23199ae`(chore(assets))로 **이미 추적 중**이었다. 총괄이 `git status`의 미추적 하위 폴더 2개만 보고 "디렉터리 전체가 미추적"으로 넘겨짚었고, 종전 HANDOVER의 "미커밋(의도적) — docs/game_ui" 서술이 그 오해를 굳혔다. **현재 로컬 982 = 추적 982(untracked·ignored 0).** 전체 3.84MB, 최대 파일 0.41MB로 LFS 불요.
    - 레포에 두는 근거: D-067 원게임 실데이터 소스이자 EPIC-ITEM 아트 매핑 원천. `design-system.md §5.3`이 `docs/game_ui/item_info/card_image/**`를 이미 참조하고 있어, 미추적 상태에서는 정본이 레포 밖 파일을 가리키는 모순이 있었다.
- **EPIC-FE-AUCTION 후속 과제(FC-036 산출에서 발생)**:
  1. ~~계약 §3.3 item 블록 필드 타입 미명시~~ → **해소**(계약 v1.9, 2026-07-18). 필드별 타입 표 명기, nullable 3개(`skill1`·`skill2`·`goldforceExpireAt`)만 식별.
  2. **★ 코드 사전(code dictionary) 부재 — EPIC-ITEM 정본화 필요**: `element`뿐 아니라 **`mainCategory`·`subGroup`·`kind` 전부 계약·erd에 코드값 열거가 없다.**
     - `element`는 시드 V9 기준 **1=물·2=불만 확인**됐다. 3=흙·4=바람은 erd 서술의 나열 순서에서 나온 **추정일 뿐 정본 근거가 없어** 계약 v1.9가 의도적으로 미확정으로 남겼다.
     - 계약이 클라이언트 의무를 규정했다: **미등록 코드는 중립 표기("속성 N") 폴백 + 코드 집합 크기를 가정한 하드코딩(배열 인덱싱·exhaustive switch) 금지.** 현 프론트 구현과 정합.
     - **더 큰 문제**: 시드상 `kind 1·2`가 대분류별로 다른 의미(검/도 vs 방패/갑옷)를 갖는 것으로 보인다 → **축 해석이 `mainCategory`에 의존**한다는 뜻이라 필터 UI 설계 시 문제가 된다. 현재는 프론트가 표시명 스냅샷에 의존해 우회 중이라 당장 막히지는 않는다.
  2-1. **spec 메타 드리프트(경미)**: `bid-domain-spec` 근거 줄이 "api-contract v1.8"로 고정(현재 v1.9). architect가 인용 조항 무변경이라 의도적으로 미갱신 — 필요 시 "메타 정정(내용 무변경·버전 미상향)" 서식으로 한 줄 추가.
  3. **`StatusChip` `neutral` 톤 추가** — §5.8에 `SCHEDULED`(예정) 대응 의미색이 없어 `surface-sunken`+`text-muted`로 처리(새 색 아님). design-system.md에 반영할지 검토.
  4. **실데이터 미검증** — 백엔드 :8080 미기동으로 cursor 연속 로드·정렬 전환 시 커서 초기화·빈 상태를 확인 못 함. 백엔드 기동 시 확인 필요.
  5. **판매유형 칩 미구현**(의도) — 경매 전용 목록에서 상수 반복은 노이즈라는 판단, 총괄 수용. 경매·고정가 혼합 화면(EPIC-SHOP) 도입 시 재검토.
- **FC-038 리뷰 후속(2차 PASS, 근거 `reviews/FC-038-review.md`)**:
  1. **★ 프론트 테스트 러너 부재 — 티켓 승격 권고**(m11). vitest·testing-library 미도입으로 회귀 테스트 0건. 이 에픽 결함 2건(M-1 "코드 null" · m6 행 점프)은 **렌더 테스트 1개면 잡혔을 유형**이고 M-1은 리뷰까지 살아남았다. reviewer가 "백로그가 아니라 실제 티켓으로" 승격 권고.
  2. **chore: prettier 글롭 루트 확대 + `.gitattributes` eol 고정**. `npm run format`이 `src/**`만 대상이라 루트 설정·문서가 영구 사각지대다(`README.md`·`tsconfig.json`·`vite.config.ts`). `vite.config.ts` 위반 실체는 **CRLF 줄바꿈** → `.gitattributes`에 `*.ts text eol=lf` 고정 병행.
  3. **m7 + n2 묶어 처리 검토(EPIC-BID 착수 전)**: `hasBid` 판정 규칙이 `AuctionCard`·`AuctionTradePanel` 2곳에 독립 존재 + `highestBidAmount as number` 캐스트 잔존(별칭 내로잉이 끊기는 구조). **`hasBid: boolean` 대신 확정 금액을 넘기면 캐스트까지 함께 사라진다.**
  4. **이월 minor 5건은 EPIC-BID 후속 유지**: m1(SR "0분 남음") · m2(**소프트클로즈 연장 안내 — 입찰 붙는 순간 accessibility §6 실효 요건**) · m3(마지막 페이지 포커스 소실) · m4(IntersectionObserver 재구독) · m5(목록 카드 시간 반응성). n1(라벨 중복)은 UI 도달 불가라 코드 사전 확정 시 자연 소멸.
  5. **EPIC-BID 프론트 티켓 DoD에 명시할 것**: `BID_003`(자기 경매)·`BID_007`(미개시) **화면 분기가 없다**. 상세가 판매자 본인 여부를 알 수 없고(`sellerNickname`만 내려옴) `SCHEDULED` CTA도 "입찰 준비 중"으로 뭉뚱그려져 있다. 계약 v1.8 주가 "안내 문구·재시도 가능성이 정반대"라 못 박았다. `errorCodes.ts`에 `BID_007` 미등재.

## ★ 방침 전환 (2026-07-18, 사용자 지시) — **백엔드 동결 · 디자인 우선**

**계기**: 사용자가 처음으로 브라우저에서 화면을 열어보고 "디자인이 거의 안 되어 있다"고 지적. 조사 결과 사실이었다 — **라우트 16개 중 12개가 `PagePlaceholder`**("스켈레톤 placeholder — feature 단계에서 구현됩니다"), **홈(첫 화면)부터 placeholder**. 실구현은 로그인·회원가입·프로필·경매목록·경매상세 5개뿐. `PublicLayout`은 얇은 헤더 + 텍스트 링크 3개, 푸터·브랜드 표현 없음(주석이 스스로 "도메인 콘텐츠는 없다(스켈레톤)"라고 적어둠).

**총괄 보고 오류 — 반복 금지**: "디자인 시스템 준수"를 "디자인 완성"으로 전달했다. 셋이 겹쳤다 —
1. `design-system.md`는 **토큰·컴포넌트 계약 명세**지 시각 디자인이 아니다("무슨 prop·무슨 상태·무슨 a11y"이지 "어떻게 보여야 하는가"가 아니다).
2. FC-038 리뷰 프롬프트에 총괄이 **"판단이 아니라 위반 여부만 볼 것"**이라고 명시했다. 그 PASS는 "규칙을 어기지 않았다"이지 "보기 좋다"가 아니다.
3. 총괄이 그 차이를 짚지 않고 PASS를 그대로 전달했다.
→ **교훈: 리뷰가 답한 질문과 사용자가 궁금해한 질문이 같은지 항상 확인할 것.**

**확정 방침(정정 3회 반영)**:
1. **백엔드 개발 전면 중지.** EPIC-BID까지 닫고 동결. EPIC-CLOSING·SHOP 착수 금지.
2. **디자인 템플릿 HTML을 페이지별로 먼저 완성한다.** 선례: `docs/ux/mockups/redesign-commerce.html`.
3. 그 다음 **기능 에픽은 프론트 + 백엔드 동반 진행**(프론트가 뒤처지는 구조를 없앤다).
4. **디자인/프론트 에이전트를 늘리지 않는다.** 기존 frontend-impl + `impeccable` 스킬로 진행. §8 개정·consultant 소환 없음.

## 다음 수 (2026-07-19 마감 시점)
1. **FC-043 인증 목업을 사용자가 브라우저로 확인** → 디자인 게이트 판정. 통과 시 `done` 전이 + KAN-52 완료.
   - **⚠️ 목업 전반이 스크린샷 검증을 못 받았다** — 이 환경에 헤드리스 브라우저가 없다. 정적·산술 검토와 impeccable 검출기만 통과했다. **여백·정렬 감각은 사람이 브라우저로 열어야 확인된다.**
2. **FC-042(KAN-51) 경매 목록·상세 목업** 착수. 티켓 이미 작성됨(`docs/board/tickets/FC-042.md`) — 상태 다양성·아트 실물 참조·"입찰 없음/현재가" 혼동 방지가 DoD.
3. 이후 나머지 화면 목업(인벤토리·등록·마이페이지·시세 등 12개 placeholder 중 우선순위 정해서).
4. **디자인 완성 후** → React 구현 반영 티켓 → 그다음 기능 에픽은 **프론트 + 백엔드 동반**.
5. **사용자 push**(미push 다수).

### 동결 중 (디자인 완성 후 재개)
- EPIC-CLOSING · EPIC-SHOP · FC-039 데모 시드 · FC-040 시각 점검
- **백엔드 후속 티켓 5건**(FC-035 minor) — 특히 **m4 `MEMBER_002` 탈퇴 TOCTOU는 EPIC-CLOSING DoD에 반드시 구속**할 것
- `design-system.md`의 React 반영(`frontend/src/index.css`·`tailwind.config.js`는 **아직 v0.5 토큰이 안 들어갔다** — 목업과 실코드가 현재 다르다)

### 총괄이 새겨야 할 것 (이번 세션 교훈)
- **"규칙 준수 PASS"를 "디자인 완성"으로 전달하지 마라.** 리뷰가 답한 질문과 사용자가 궁금해한 질문이 같은지 항상 확인할 것. FC-038에 총괄이 "위반 여부만 보라"고 지시해놓고 그 PASS를 그대로 전달한 게 이번 방침 전환의 계기다.
- **워킹트리를 파괴하는 git 명령 금지**(`reset --hard`·광범위 `checkout --`·`clean -fd`). 이번 세션에 `git reset --hard`로 미커밋 작업을 날렸고, 그 여파가 **한참 뒤 vite 프록시 토큰 누락으로 드러났다**(백엔드를 처음 붙여본 시점에야 발각).
- **에이전트에 위임할 때 산출 형식을 먼저 못박아라.** FC-041이 단일 파일+토글로 나와 재작업했다. 지시가 늦게 도착했다.
- **에이전트가 자기 오류를 3회 자진 정정했다**(베벨 색 오측 · 금색 대비 엣지/코어 혼동 · prettier 수치). 검증 결과를 그대로 믿지 말고 근거를 되묻는 게 실제로 작동했다.

## 대기 안건(백로그)
- **EPIC-BID**(다음 로드맵) → **EPIC-CLOSING**(마감·정산·주문·즉시구매) → **EPIC-SHOP**(고정가).
- **EPIC-GAME-PROFILE(가칭)**: 게임 차용(프로필·인벤토리 UI) + 게임데이터 통합. 선결 설계 리서치 완료(process-log 항목3), 합의 대기.
- **EPIC-AUCTION 위생 후속(minor, 비차단)**: (1) AUCTION_003 이중용도(startPrice≤0 메시지 오해) 메시지 일반화 or 계약 각주. (2) cancel 경로 자동슬롯 INV_002 표면화 — 재시도 도입 or 계약 각주. 근거 `reviews/FC-029-review.md`.
- **보안 리뷰 관찰 3건(기준미달·비차단, 2026-07-18 `/security-review`)**:
  1. **★ 에스크로 CAS에 owner 조건 부재 → EPIC-CLOSING 이연 확정(FC-030 판정·게이트2 승인 2026-07-18)** — `ItemInstanceRepository.markListedIfInInventory`가 `location`만 조건으로 걸고 소유권 확인은 선행 별도 read라 **원자적이지 않다**. `ItemInstance.owner`에 갱신 경로가 없어 현재는 미착취.
     - **이연 근거**: 지금 고치면 재현할 결함이 없어 회귀 테스트를 쓸 수 없다(정적 확인만 가능). EPIC-CLOSING에서는 **취약해지는 변경(owner UPDATE)과 방어가 같은 리뷰 범위**에 들어와 실제 경합 테스트가 가능하다.
     - **⚠️ EPIC-CLOSING 소유권 이전 티켓 DoD에 반드시 등재할 것**(이연의 유일한 리스크는 "잊혀짐"): *"`markListedIfInInventory` CAS에 `AND i.owner.id = :ownerId` 추가 + 소유권 이전 ∥ 출품 선점 경합 테스트로 검증"*.
  2. `AuctionCursor` sortValue를 활성 정렬필드 기준으로 미검증 — `AuctionRepositoryImpl:148/161`의 `Long.parseLong`/`Instant.parse`에 try-catch 없음. 페이징 중 `sort` 전환 시 400 대신 500. 가용성·견고성 이슈(보안 아님).
  3. `GET /auctions`의 `size` 상한 없음 + 음수 시 `subList` 예외. 기존 프로젝트 패턴(`InventoryController`·`NoticeController`)과 동일 → 전역 위생 항목으로 묶어 처리 권장.
- ~~**문서 드리프트(architect 후속)**: `item-domain-spec.md §3.1`이 제거된 `markListed()`를 전이 메서드로 언급 → 갱신 필요(FC-029 판단#5).~~ → **해소 완료. 이 항목이 stale이었다**(2026-07-19 확인). 실제로는 **2026-07-18 FC-030에서 이미 고쳐졌는데** HANDOVER만 갱신되지 않았다. `item-domain-spec.md:98`은 조건부 CAS(`markListedIfInInventory`)를 정확히 서술하고 `markListed()` 폐기 이유(dirty-checking이라 양쪽 다 성공)까지 적혀 있으며, 헤더 v0.3이 정정 사실을 기록하고 있다. 코드도 일치(`ItemInstanceRepository:35`·`AuctionService:77`). **교훈: 후속 항목을 해소했으면 HANDOVER에서도 지워야 한다 — 안 지우면 다음 세션이 이미 끝난 일을 다시 조사한다.**
- **EPIC-ITEM 위생 후속(minor)**: 자동배정 relocate INV_002 메시지 · temp-storage size @Min/@Max · 카탈로그 max page size. 근거 `reviews/FC-024-review.md`.
- **EPIC-CHARGE**(충전·토스 결제·시크릿) · **EPIC-OAUTH**(소셜 로그인) · PR 워크플로우 도입(도입 시 CI claude-security-review·dependency-review 활성) · 보안 플러그인(로컬 Python 부재로 보류) · design-system Q4(아이템 에픽) · impeccable 벤더링 · Task#1(CLAUDE.md 섹션 2·6 문구 정합).
- (보안 잔여, 사용자 영역) 저장소 Secrets `CLAUDE_API_KEY` + PR 워크플로우 도입 시 CI 활성.

## 핵심 결정·컨벤션(파일에 없는 맥락)
- 커밋 자동·게이트 없음 / push는 사용자 직접(훅 차단) / Done 전이 사용자 승인(게이트3).
- 게이트2 = 스키마·API계약·성능·인가모델 결정(자동 진행 중에도 정지·상신).
- **총괄은 코드를 직접 검증(빌드·테스트·코드리뷰)하지 않는다** — reviewer/backend-impl에 위임.
- **보안 = 별도 역할 아닌 별도 패스**(섹션 13). reviewer 확인소, 커밋 warn-only(플러그인 보류), 온디맨드 /security-review(에픽 완료·경매부터), CI post-push. 경매(입찰·정산) 최고위험.
- 단독 backend 에이전트는 gradle 빌드 허용(병렬 시 경합 주의). 앱 :8080 부팅은 사용자 IntelliJ 점유 → 에이전트는 테스트로만 검증.
- 파일 이동 git mv 금지(C-075). 통신은 파일로.
- **총괄은 워킹트리를 파괴하는 git 명령을 쓰지 않는다**(`reset --hard`·`checkout --` 광범위 사용·`clean -fd`). 2026-07-18 훅 스모크 테스트 정리에 `git reset --hard HEAD~1`을 썼다가 **서브에이전트 2종이 병렬 작업 중인 미커밋 변경을 날렸다**(커밋은 무사). 테스트 정리는 개별 파일 `rm`·`git checkout -- <특정파일>`로 한정한다. 에이전트에게는 의미 단위마다 커밋을 지시한다(커밋=자동 원칙이 사고 보호막이기도 하다). Jira 미러·프로세스 로그 규율은 memory `jira-mirror-discipline`·`portfolio-process-log`.
- 아이템/경매 팬아웃은 전부 순차 단일패스였음(FK 선형 의존 + Flyway 단일 채번 + 공유 파일 교차). EPIC-BID도 유사 예상.
