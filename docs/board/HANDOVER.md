# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 에픽 완료마다 + 세션이 무거워질 때(덮어씀, 이력은 git).
갱신: 2026-07-18 (**EPIC-AUCTION 완료·push** / **EPIC-BID 게이트1 승인·티켓 생성(KAN-36~42)** / end-of-turn 보안 훅 신규 배선·on / old_sp DB 임포트)

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
2. **백엔드**: IntelliJ에서 `FinalcallApplication` 실행(default 프로파일=local, JDK 21 `C:\Users\howee\.jdks\ms-21.0.11`). 부팅 시 Flyway V1~V10 검증.
3. **프론트(선택)**: `cd D:/Java/finalcall/frontend && npm run dev`(:5173, vite 프록시 `/api/v1`→:8080 + X-Gateway-Token 주입 — `vite.config.ts`, **미커밋** dev 편의). 화면 확인 시에만.
4. **게임 DB**: `new_sp`(docker finalcall-mysql 내, 유저 `sp/sp`, 42테이블) 볼륨 보존 — 재임포트 불요.

## 현재 상태
- **워크플로우**: 4에이전트 오케스트레이션 + portfolio-writer + consultant(휴면). 훅 2개: `block-git-push.js`·`check-mirror-drift.js`.
- **완료 에픽(done·Jira 완료·push됨)**:
  - EPIC-MEMBER(KAN-2~7) · EPIC-CURRENCY(KAN-9~13) · EPIC-FE-MEMBER(KAN-14~19) · 백로그 FC-006/011/017/018(KAN-8/20/21/22).
  - **EPIC-ITEM(아이템·인벤토리, KAN-23~29) ✅ 완료·push됨**. FC-019 architect / FC-020~023 backend-impl 순차(V6~V9) / FC-024 reviewer PASSED. item_template·item_instance·인벤토리(96칸+temp)·소유이력 + 카탈로그/상세/인벤토리 API + 최소 시드. spec `docs/spec/item-domain-spec.md`(v0.2), erd v0.9.
  - **EPIC-AUCTION(경매, KAN-30~35) ✅ 완료·push됨**. FC-025 architect(spec v0.2·계약 v1.7, 게이트2 6결정) / FC-026~028 backend-impl 순차 단일패스(V10) — 등록·목록·상세·취소 + item LISTED CAS(G4 교정)·에스크로 왕복, 테스트 슬라이스5+통합21+동시성1 / FC-029 reviewer PASSED(critical 0·major 0·minor 8).
  - **보안 층 첫 실적용 완료**(섹션 13): 에픽 완료 온디맨드 `/security-review` 1회 실행 → **HIGH/MEDIUM 발견 0건**. 인가(주체=SecurityContext·IDOR 없음)·SecurityConfig permitAll GET 한정 스코프·에스크로 CAS 단일승자·QueryDSL 인젝션 없음·응답 PII 미노출 전부 확인. 기준미달 관찰 3건은 백로그 등재.
  - 주의: 스킬이 `origin/HEAD` 미설정으로 1차 실패 → `git remote set-head origin master`로 해소. 또 **push 완료 후엔 기본 diff 범위가 비므로** 범위를 수동 지정해야 한다(이번엔 `415e6e3..HEAD`).
- **EPIC-BID(입찰, KAN-36~42) — 착수(게이트1 승인 2026-07-18)**: 티켓 FC-030~035 생성·Jira 미러 완료, 전건 `todo`. 다음 수 1번대로 FC-030 architect부터.
- **end-of-turn 보안 리뷰 = 배선·on**(2026-07-18 신규): `.claude/hooks/stop-security-review.js` + `settings.json`(`Stop` 훅 + `env.ENABLE_STOP_REVIEW=1`).
  - 섹션 13에 `ENABLE_STOP_REVIEW`가 있었지만 **실배선은 없었다**(문서상 의도만). 이번에 Node로 신규 구현 — 민감경로(bid·auction·settlement·currency·auth·money_hold·SecurityConfig·jwt/token/secret·db/migration) 변경 시 재프롬프트, **warn-only**(커밋·push 무간섭). Python 의존 없음.
  - 스모크 7케이스 검증 통과. 중복 억제 서명은 **민감파일 내용 해시 기반**(git status 문자열 기반은 dirty 파일 재편집을 못 잡아 폐기). 상태파일 `.claude/.stop-review-state`는 gitignore(추적 시 서명이 매 턴 바뀜).
  - **EPIC-BID 종료 시 `0` 복귀 필수.**
- **old_sp 웹 DB**: `sp_web-210715.sql`(phpMyAdmin 5.6 덤프, 80KB) → docker finalcall-mysql DB `old_sp`(utf8mb3), 유저 `sp/sp` 권한 부여. 임포트 exit 0. **⚠️ 검증(테이블 수·행수·한글 정합) 미실시** — 사용자 지시로 생략. 사용 전 확인 필요.
- **new_sp 게임 DB**: 원게임(SP) 백업 임포트 완료(docker finalcall-mysql, DB `new_sp`, 유저 `sp/sp`, 42테이블·user 2440행). D-067 원게임 실데이터 소스·게임 차용 UI 매핑 원천. finalcall과 격리.
- **게임데이터 통합 논의(OPEN)**: `docs/portfolio/process-log.md` 항목3. new_sp가 라이브 인게임 DB로도 쓰일 예정 → 정규화 시 단일진실원 이원화·크로스DB 조인·화폐 소유권 문제. 업계 리서치 완료(옵션 A read-only복제·B CDC·C API·절충=읽기 복제·쓰기 소유자 위임). 합의는 EPIC-GAME-PROFILE 착수 시.
- **디자인**: U-021 라이트 커머스 실코드 반영. 게임차용 노트 `docs/game_ui/게임 차용 디자인 및 erd.txt`(미커밋 참조자료).
- **push 상태**: origin/master = `08c31d7`까지 push 완료(EPIC-AUCTION 전건 포함). 이 Done 전이 커밋만 미push.
- **미커밋(의도적)**: `frontend/vite.config.ts`(dev 프록시 편의)·`docs/game_ui/` 참조자료 2건.

## 다음 수
1. **FC-030 architect 소환**(KAN-37) — EPIC-BID 계약 검증·bid-domain-spec 확정·슬라이싱. **게이트2 5건 상신 예정**(직렬화 메커니즘★·홀드 원자성 경계·소프트클로즈 연장 규칙·SCHEDULED→ACTIVE 영속 전이·BID_004 판정 근거) → 사용자 승인 후 FC-031 착수.
2. 이후 FC-031→032→033→034→035 순차. 각 티켓 완료마다 보드·Jira 전이.
3. **에픽 종료 시 필수**: `ENABLE_STOP_REVIEW`를 `0`으로 복귀(`.claude/settings.json`) + 에픽 완료 `/security-review` 1회.
4. (병렬 가능) EPIC-GAME-PROFILE 합의(리서치 완료됨) — 사용자 결정 시.

## 대기 안건(백로그)
- **EPIC-BID**(다음 로드맵) → **EPIC-CLOSING**(마감·정산·주문·즉시구매) → **EPIC-SHOP**(고정가).
- **EPIC-GAME-PROFILE(가칭)**: 게임 차용(프로필·인벤토리 UI) + 게임데이터 통합. 선결 설계 리서치 완료(process-log 항목3), 합의 대기.
- **EPIC-AUCTION 위생 후속(minor, 비차단)**: (1) AUCTION_003 이중용도(startPrice≤0 메시지 오해) 메시지 일반화 or 계약 각주. (2) cancel 경로 자동슬롯 INV_002 표면화 — 재시도 도입 or 계약 각주. 근거 `reviews/FC-029-review.md`.
- **보안 리뷰 관찰 3건(기준미달·비차단, 2026-07-18 `/security-review`)**:
  1. **★ 에스크로 CAS에 owner 조건 부재** — `ItemInstanceRepository.markListedIfInInventory`가 `location`만 조건으로 걸고 소유권 확인은 선행 별도 read라 **원자적이지 않다**. `ItemInstance.owner`에 갱신 경로가 없어 현재는 미착취지만, **EPIC-CLOSING이 소유권 이전을 도입하는 순간 실 TOCTOU가 된다**. CAS에 `AND i.owner.id = :sellerId` 추가 = 저렴한 심층방어. **EPIC-BID/CLOSING 선결 검토 대상.**
  2. `AuctionCursor` sortValue를 활성 정렬필드 기준으로 미검증 — `AuctionRepositoryImpl:148/161`의 `Long.parseLong`/`Instant.parse`에 try-catch 없음. 페이징 중 `sort` 전환 시 400 대신 500. 가용성·견고성 이슈(보안 아님).
  3. `GET /auctions`의 `size` 상한 없음 + 음수 시 `subList` 예외. 기존 프로젝트 패턴(`InventoryController`·`NoticeController`)과 동일 → 전역 위생 항목으로 묶어 처리 권장.
- **문서 드리프트(architect 후속)**: `item-domain-spec.md §3.1`이 제거된 `markListed()`를 전이 메서드로 언급 → 갱신 필요(FC-029 판단#5).
- **EPIC-ITEM 위생 후속(minor)**: 자동배정 relocate INV_002 메시지 · temp-storage size @Min/@Max · 카탈로그 max page size. 근거 `reviews/FC-024-review.md`.
- **EPIC-CHARGE**(충전·토스 결제·시크릿) · **EPIC-OAUTH**(소셜 로그인) · PR 워크플로우 도입(도입 시 CI claude-security-review·dependency-review 활성) · 보안 플러그인(로컬 Python 부재로 보류) · design-system Q4(아이템 에픽) · impeccable 벤더링 · Task#1(CLAUDE.md 섹션 2·6 문구 정합).
- (보안 잔여, 사용자 영역) 저장소 Secrets `CLAUDE_API_KEY` + PR 워크플로우 도입 시 CI 활성.

## 핵심 결정·컨벤션(파일에 없는 맥락)
- 커밋 자동·게이트 없음 / push는 사용자 직접(훅 차단) / Done 전이 사용자 승인(게이트3).
- 게이트2 = 스키마·API계약·성능·인가모델 결정(자동 진행 중에도 정지·상신).
- **총괄은 코드를 직접 검증(빌드·테스트·코드리뷰)하지 않는다** — reviewer/backend-impl에 위임.
- **보안 = 별도 역할 아닌 별도 패스**(섹션 13). reviewer 확인소, 커밋 warn-only(플러그인 보류), 온디맨드 /security-review(에픽 완료·경매부터), CI post-push. 경매(입찰·정산) 최고위험.
- 단독 backend 에이전트는 gradle 빌드 허용(병렬 시 경합 주의). 앱 :8080 부팅은 사용자 IntelliJ 점유 → 에이전트는 테스트로만 검증.
- 파일 이동 git mv 금지(C-075). 통신은 파일로. Jira 미러·프로세스 로그 규율은 memory `jira-mirror-discipline`·`portfolio-process-log`.
- 아이템/경매 팬아웃은 전부 순차 단일패스였음(FK 선형 의존 + Flyway 단일 채번 + 공유 파일 교차). EPIC-BID도 유사 예상.
