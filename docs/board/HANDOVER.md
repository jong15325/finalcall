# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-21** (EPIC-FE-REBUILD 완료·푸시 반영 — 사용자 지시)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

---

## 지금 어디인가 — 한 문단

**EPIC-FE-REBUILD(KAN-73) 완료·푸시됨.** 사용자 목업(장터, Vuexy Bootstrap5)을 **정본으로 1:1 재구축**하고
**색만 장터 브랜드**(navy `#16213a`/gold/orange)로 치환했다. Ecme 템플릿 513파일 폐기, 계약 인코딩 lib 49
승계. **실연동 12화면 + 준비중 자리 4** 완성(FC-066~080, 15티켓 전건 done·review passed·보안 0건).
**test 451/55 files·build 216 modules.** **백엔드는 여전히 동결** — 미래 백엔드 에픽 3종(EPIC-CLOSING
수수료·EPIC-GRADE 등급·EPIC-SEARCH 검색)은 정책/spec만 확정된 채 구현 대기다.

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋 + 보안 층) 숙지.
2. 이 파일 + `git log --oneline -25` + `git status`.
3. 메모리 `brand-identity`(장터) · `mockup-fidelity-only-fix`(목업 그대로·색만 브랜드) 확인.
4. 프론트 계약 성경 = `docs/ux/rebuild-contract-map.md`(§2.9 색·팔레트 원칙 포함) · `docs/ux/design-brief.md`.
5. 아래 "다음 수"로 진행.

---

## ★ 완료된 것 — EPIC-FE-REBUILD (2026-07-21)

- **정본**: 사용자 목업 `D:\web_template\vuexy-admin-v10.7.0 - test\...\game-market\`(레포 밖, 읽기 전용).
  핸드오프 = `HANDOVER_FULLSTACK.md`. 프론트 계약 매핑 = `docs/ux/rebuild-contract-map.md`(FC-066).
- **실연동 12화면**: 홈·경매목록·경매상세+입찰·판매·로그인·회원가입·마이·지갑·인벤토리·임시보관·아이템상세·비교.
- **준비중 자리 4**(백엔드 미구현·미호출·정직한 "준비 중"): 고정가 마켓·커뮤니티·충전·알림.
- **핵심 방어**: FC-064 함정 6건(모달 초점·금액 덮어쓰기·마감 클라판정 등)·교환 Idempotency-Key·returnUrl
  sanitize·탈퇴 명시동의·마스킹 격리(`isOwnAuction` 1지점).
- **검수**: 경매 축(070~073)·마이/인증/비교/자리 축(074~080) reviewer 전부 PASSED(결함 0). 리뷰 기록
  `docs/board/reviews/FC-067-068·FC-070-073·FC-074-080-review.md`.
- **색·팔레트 원칙(§2.9)**: 구조=목업 1:1, 색=장터 브랜드. 목업의 Vuexy 기본색(#3867df 등)은 브랜드 아님 → 치환.

### 원격 CI 결과 (push 후)
- master push Security 워크플로 = **success**(단, `npm-audit`이 `continue-on-error` 리포트 전용).
- **npm audit 5건**(1 critical vitest-UI·1 high vite dev서버·3 moderate esbuild) — **전부 dev/test 툴체인,
  프로덕션 빌드 무관.** 수정은 major 파괴 변경(vitest 4·vite 8) 필요 → dependabot PR #9(vite 8)·#10(react-dom) 실패(파괴적).
- LLM `claude-security-review` CI 잡은 **PR 전용 + `CLAUDE_API_KEY` 시크릿 필요** → master 직접 커밋인 이번 push엔 미실행.
  (로컬 `/security-review`로 에픽 diff 이미 커버 — 0건.)

---

## ★ 브랜드 — 장터 (확정, 프론트에 적용됨)
- 서비스명 **장터**. 로고 `docs/game_ui/common/`(logo2=워드마크·logo=심볼). 팔레트 네이비 `#16213a`·골드·오렌지 `#ef8a2c`.
- **아이템 프레임/골드포스**: 목업 투명 PNG 오버레이 방식 채택(`docs/game_ui/item_info/frames/` 5장 tracked). 종전 CSS 재구성 폐기.

---

## ★ 미래 백엔드 에픽 3종 (전부 동결 · 구현 대기 · 게이트2 대기)

### EPIC-CLOSING — 수수료/정산 (**정책 확정**, D-101) ← 가장 준비됨
- 정본 `docs/spec/fee-policy-spec.md` v1.0. 판매자 단독·구간별 누진 6/5/4/3%·최소 100/cap 300,000·`settle=final−fee`.
- **프론트 판매화면(FC-073)에 예상 계산 이미 반영**(검산 일치). 스키마 컬럼(`fee_amount`/`settle_amount`) 존재.
- 구현 유의: 누진 계산 SOLD 정산 TX 1회, 순서=누진→반올림→cap→최소, money_hold CAPTURED 분개.

### EPIC-GRADE — 등급 제도 (**초안**, D-102)
- 정본 `docs/spec/grade-tier-spec.md` v0.1. 포인트=경험치형·판매1.0/구매0.5·5단계·수수료 할인 혜택.
- 게이트2 8항목(적립배수·등급경계·수수료계수·시점·부스트·강등·스키마 `user`+`point_ledger`·계약필드).

### EPIC-SEARCH — 검색 (**초안**)
- 정본 `docs/spec/search-spec.md` v0.1. MySQL FULLTEXT MVP → ES 승격, Outbox/CDC·alias 무중단 재색인.
- 게이트2: 계약축 C1~C3 / 인프라축 A1~A5.

---

## 백엔드 — 동결 유지
**235 테스트 / 실패 0.** 구현 컨트롤러: Auction·Auth·Bid·Exchange·Inventory·ItemInstance·ItemTemplate·Member·Notice.
**미구현(프론트에서 준비중 자리로 처리)**: `/shops`(고정가 마켓)·`/charges`(충전)·커뮤니티 CRUD·`/notifications`(알림)·
`/auctions/{id}/purchase`(즉시구매)·OAuth·이메일 인증·슬롯 확장.

---

## 이월 미결 (문서로 추적 · 백엔드 동결 해제/게이트2 시 수렴)
- **마스킹 게이트2**: 계약 §3.3 판매자 마스킹 vs 구현 `sellerNickname` 원문. 프론트는 `isOwnAuction` 1지점 격리(교체 용이).
- **토큰 저장소**: localStorage → httpOnly 쿠키+CSRF(미결4). 현행 백엔드가 토큰을 응답 바디로 줘 무변경 불가 → 백엔드 변경 선행.
- **location enum 문구 정정**: `design-brief §B-11`의 `AUCTION`→실측 `LISTED`(architect, 백엔드 무변경).
- **dev 툴체인 취약점**: vitest/vite dev 서버(critical/high, prod 무관). vitest4·vite8 파괴적 업그레이드 필요(dependabot PR 대기).
- **LLM 보안 CI 미가동**: PR 워크플로 도입 + `CLAUDE_API_KEY` 시크릿 추가해야 원격 LLM 리뷰 발동(현재 master 직접 커밋).
- **운영 DB 시드 오염**(데모 계정·경매 20건 부팅 유입 — 프로파일별 시드 분리).

---

## 다음 수
1. **사용자 "출근" 후 지시 대기** — 후보:
   - **(a) 백엔드 동결 해제 → EPIC-CLOSING**: 정책 확정·스키마·프론트 예상계산 존재로 가장 준비됨. 게이트1 분해 + 게이트2 상신.
   - **(b) 이월 미결 정리**: 마스킹 게이트2 결정 · dev deps 위생(vitest4/vite8) · PR 워크플로+CLAUDE_API_KEY로 LLM CI 가동.
   - **(c) EPIC-GRADE / EPIC-SEARCH** 게이트2 항목 확정.
2. 백엔드 착수 시 EPIC-CLOSING부터가 자연스럽다.

---

## 환경 기동 — ★ 함정 (변동 없음)
```bash
docker start finalcall-mysql finalcall-redis     # 재부팅 시 내려감(볼륨 보존)
# 백엔드: IntelliJ FinalcallApplication (local, JDK 21 C:\Users\howee\.jdks\ms-21.0.11), Flyway V1~V13 자동
# 프론트: cd frontend && npm run dev  (predev=sync-assets 크로마키+브랜드 복사, localhost:5173, /api→8080 프록시+X-Gateway-Token)
```
- **함정 A — 시드 시각 되돌리기**: V13 주석 [B]의 재적용 SQL 4문장(안 하면 카운트다운 전부 "마감").
- **함정 B — 아트 크로마키**: 아이템·프레임 PNG는 알파 없음(colorType 2)·네 귀퉁이 `#0000FF`. `predev`/`prebuild`가
  복사본만 RGBA 변환. **프론트도 이 처리 필요(sync-assets).**
- **⚠ Flyway 체크섬**: `V11` 커밋 후 편집 이력 — `flyway repair` 없이 부팅 실패 가능(FC-035 m9).

---

## 교훈 (이번 세션 추가)
1. **목업이 정본, 색만 브랜드.** 사용자가 "목업 그대로·오류만 수정" 지시 → 구조는 1:1 이식, 색은 장터 브랜드로 치환(§2.9).
   에이전트가 카드 종류·필터를 임의 변경/추가한 이탈은 총괄이 market.css 실측으로 잡아 되돌렸다.
2. **화면마다 목업 카드 레이아웃이 다르다.** 공용은 ItemFrame(이미지 영역), 카드 래퍼는 화면별(마켓=세로·경매=가로).
   "카드=ItemCard" 식 과잉 제약이 이탈을 유발했다 — 화면 티켓엔 "해당 목업 뷰 그대로"로 지시.
3. **에이전트가 목업 접근 실패 시 재구성하지 말고 총괄에 경로 요청.** FC-070이 접근 실패→재구성했다가 총괄이 실제 #home 인라인 전달로 재정렬.
4. **미구현은 정직한 자리.** 가짜 데이터로 채우지 않는다(홈 공지 스켈레톤 폴리시). 미구현 엔드포인트 호출 0(FC-048).
5. **밀스톤 단위 리뷰**가 효율적이다(티켓마다 reviewer 팬아웃은 과함). 토대·경매·마이 축으로 묶어 검수.
