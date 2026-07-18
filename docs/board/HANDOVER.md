# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 에픽 완료마다 + 세션이 무거워질 때(덮어씀, 이력은 git).
갱신: 2026-07-18 (**PC 재부팅 대비 마감** — EPIC-ITEM 완료·push / EPIC-AUCTION 구현·리뷰 PASSED·커밋(미push)·Done 잔여 / new_sp 게임DB 임포트 / 게임데이터 통합 리서치 완료)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 아래 "다음 수"부터 진행한다.

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋 + 섹션 13 보안 층) 숙지.
2. `docs/board/` 스캔 — 에픽·티켓 상태(YAML `state`), `reviews/`.
3. **Jira 미러 패리티** — `state`가 todo 아닌데 `jira_key: null`인 티켓/에픽 스캔·백필(섹션 12). (커밋 전 `check-mirror-drift.js` 훅이 계층① 자동 경고.)
4. `git log --oneline -20` + 미push 확인(`git status`, `@{u}..HEAD`).
5. 이 파일의 "현재 상태"·"다음 수"로 진행.

## ★ 재부팅 후 환경 복구 (2026-07-18 마감 — 필수 선행)
재부팅으로 Docker 컨테이너·백그라운드 프로세스가 내려간다. **작업 트리·git·Docker 볼륨(데이터)은 디스크에 보존**된다.
1. **Docker 인프라 기동**: `cd D:/Java/finalcall/backend && docker compose -f docker-compose.local.yml up -d` → MySQL(3306)·Redis(6379). (finalcall DB + new_sp DB 볼륨 보존됨.)
2. **백엔드**: IntelliJ에서 `FinalcallApplication` 실행(default 프로파일=local, JDK 21 `C:\Users\howee\.jdks\ms-21.0.11`). 부팅 시 Flyway V1~V10 검증.
3. **프론트(선택)**: `cd D:/Java/finalcall/frontend && npm run dev`(:5173, vite 프록시 `/api/v1`→:8080 + X-Gateway-Token 주입 — `vite.config.ts`, **미커밋** dev 편의). 화면 확인 시에만.
4. **게임 DB**: `new_sp`(docker finalcall-mysql 내, 유저 `sp/sp`, 42테이블) 볼륨 보존 — 재임포트 불요.

## 현재 상태
- **워크플로우**: 4에이전트 오케스트레이션 + portfolio-writer + consultant(휴면). 훅 2개: `block-git-push.js`·`check-mirror-drift.js`.
- **완료 에픽(done·Jira 완료·push됨)**:
  - EPIC-MEMBER(KAN-2~7) · EPIC-CURRENCY(KAN-9~13) · EPIC-FE-MEMBER(KAN-14~19) · 백로그 FC-006/011/017/018(KAN-8/20/21/22).
  - **EPIC-ITEM(아이템·인벤토리, KAN-23~29) ✅ 완료·push됨**. FC-019 architect / FC-020~023 backend-impl 순차(V6~V9) / FC-024 reviewer PASSED. item_template·item_instance·인벤토리(96칸+temp)·소유이력 + 카탈로그/상세/인벤토리 API + 최소 시드. spec `docs/spec/item-domain-spec.md`(v0.2), erd v0.9.
- **EPIC-AUCTION(경매, KAN-30~35) — 구현·리뷰 완료, Done 미완(재부팅으로 중단)**:
  - FC-025 architect **done**(KAN-31 완료) — auction-domain-spec v0.2·api-contract v1.7. 게이트2 6결정 승인 반영.
  - FC-026~028 backend-impl **review·review_status=passed**(KAN-32~34 검토중) — 순차 단일패스(V10). 등록·목록·상세·취소 + item LISTED CAS(G4 교정)·에스크로 왕복. 테스트 BUILD SUCCESSFUL(슬라이스5+통합21+동시성1).
  - FC-029 reviewer **PASSED**(KAN-35, review_status=passed) — critical 0·major 0·minor 8(비차단). 리뷰 `docs/board/reviews/FC-029-review.md`.
  - **커밋됨(미push)**: `2da8230`(feat auction)·`1eaa937`(spec)·`b9671c6`(board). **Done 전이·push·에픽완료 /security-review는 잔여**(아래 다음 수).
- **new_sp 게임 DB**: 원게임(SP) 백업 임포트 완료(docker finalcall-mysql, DB `new_sp`, 유저 `sp/sp`, 42테이블·user 2440행). D-067 원게임 실데이터 소스·게임 차용 UI 매핑 원천. finalcall과 격리.
- **게임데이터 통합 논의(OPEN)**: `docs/portfolio/process-log.md` 항목3. new_sp가 라이브 인게임 DB로도 쓰일 예정 → 정규화 시 단일진실원 이원화·크로스DB 조인·화폐 소유권 문제. 업계 리서치 완료(옵션 A read-only복제·B CDC·C API·절충=읽기 복제·쓰기 소유자 위임). 합의는 EPIC-GAME-PROFILE 착수 시.
- **디자인**: U-021 라이트 커머스 실코드 반영. 게임차용 노트 `docs/game_ui/게임 차용 디자인 및 erd.txt`(미커밋 참조자료).
- **push 상태**: origin/master 마지막 push `415e6e3`(EPIC-ITEM). **미push 4건**: `d62522a`(게임데이터 리서치)·`2da8230`·`1eaa937`·`b9671c6`(EPIC-AUCTION) + 이 핸드오버 커밋. 커밋은 디스크 보존이라 재부팅 안전.

## 다음 수 (재부팅 후)
1. **환경 복구**(위 절차) — docker up + IntelliJ 백엔드.
2. **EPIC-AUCTION 마무리(게이트3)**:
   - (a) **에픽 완료 온디맨드 `/security-review` 1회** — 보안 층 첫 실적용(경매 에픽부터). 빌트인 스킬.
   - (b) 통과 시 **게이트3 사용자 Done 승인** → FC-025~029 + EPIC-AUCTION **done 전이**(보드 + Jira KAN-30~35 완료).
   - (c) **사용자 push**(미push 5건).
3. **로드맵 다음 = EPIC-BID**(입찰 — 마감 폭주 동시성·money_hold 에스크로·소프트클로즈·분산락, **프로젝트 핵심 기술 도전 + 보안 최고위험**). architect 선행. 계약 §3.1 /bids. end-of-turn 보안 리뷰 한시 on 검토(입찰·정산 구간).
4. (병렬 가능) EPIC-GAME-PROFILE 합의(리서치 완료됨) — 사용자 결정 시.

## 대기 안건(백로그)
- **EPIC-BID**(다음 로드맵) → **EPIC-CLOSING**(마감·정산·주문·즉시구매) → **EPIC-SHOP**(고정가).
- **EPIC-GAME-PROFILE(가칭)**: 게임 차용(프로필·인벤토리 UI) + 게임데이터 통합. 선결 설계 리서치 완료(process-log 항목3), 합의 대기.
- **EPIC-AUCTION 위생 후속(minor, 비차단)**: (1) AUCTION_003 이중용도(startPrice≤0 메시지 오해) 메시지 일반화 or 계약 각주. (2) cancel 경로 자동슬롯 INV_002 표면화 — 재시도 도입 or 계약 각주. 근거 `reviews/FC-029-review.md`.
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
