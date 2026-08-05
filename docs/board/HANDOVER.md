# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-08-06** (EPIC-ITEM-DELIVERY **완료·push 완료**. 이후 phase-2 게임 지급 연동 **탐색→보류**(리서치로 B=우편함 표준 확정하나 연동 자체는 사용자 보류). 서버 기동 후 **인벤 카드 폭 정렬 버그 수정(FC-195)**. **다음 수 = 미커밋 정리 커밋·push + 신규 에픽 선택**.)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 세션 경위**: (1) 출근 — 직전 세션 배송 에픽(EPIC-ITEM-DELIVERY) 잔여 2커밋 push 완료(origin=`6875781`). (2) **신규 에픽 = 게임 아이템 지급 연동** 선택 → architect가 게임 서버 조사(C++ `Channel32`) + 계약. **게이트2 다수** 상신, 사용자 승인 흐름으로 **EPIC-ITEM-DELIVERY(phase-1, 웹 우편함) 전건 구현**: FC-185(계약)·186(스키마 V21)·187(정산 enqueue)·188(소유이동/가드)·189(Redis 알림)·190(프론트 UI)·192(조회 API)·193(주문 목록 배지). reviewer 2라운드(MAJOR 2건 해소)·보안리뷰 clean·게이트3 done·**push 완료(origin=`0be676d`)**. FC-194(환경 테스트 2건)=백로그. (3) **phase-2(게임 claim) 탐색** — architect 게임 C++ 조사 + **deep-research(업계 리서치)**: 결론 **B(우편함+게임 claim)=업계 표준, A(통합)=안티패턴**. 발견: 게임 실접속 DB=**old_sp**(new_sp 아님), 게임에 **native 우편함 `itemreceive`(sent 플래그·접속 시 드레인) 이미 존재**. (4) **게임 연동 보류**(사용자 결정) — 현행 우편함/임시보관함 유지, 게임 실이식 미착수. (5) 서버 기동 후 **인벤 카드 폭 정렬 버그(FC-195) 수정**(라이브 검증).

---

## 지금 어디인가 — 한 문단

**EPIC-ITEM-DELIVERY(phase-1 웹 우편함 다리) 완료·배포됨(origin=`0be676d`).** 게임 지급 phase-2는 탐색만 하고 **보류**(리서치로 방향=B 확정, 게임 C++ 이식은 미착수). 서버 기동해 인벤 화면 점검 중 카드 폭 정렬 회귀(FC-178부터 잠복)를 발견·수정(FC-195, 라이브 green). **로컬 미커밋 다수**: ItemCardTile 수정 + FC-195 티켓 + phase-2 탐색 문서 3건 + 이 HANDOVER. 백엔드 8080·프론트 5173 **기동 중**.

---

## A. 이번 세션 완료

| 티켓/에픽 | 내용 | 상태 | Jira |
|---|---|---|---|
| **EPIC-ITEM-DELIVERY** | 웹 우편함 다리(스키마·enqueue·소유이동·Redis·프론트·조회·주문배지) | done·**push(`0be676d`)** | KAN-210 ✅ |
| FC-185~193 (9티켓) | 위 하위 전건 | done | KAN-211~219 ✅ |
| FC-194 | 테스트 위생(환경 실패 2건) 백로그 | todo(에픽 밖) | KAN-220 |
| **FC-195** | 인벤 카드 그리드 폭 정렬(ItemCardTile w-full 복구) | done·**미커밋** | KAN-221 ✅ |

- phase-2 탐색 산출(미커밋): `docs/research/web-game-inventory-integration-research.md`, `docs/spec/proposals/{game-claim-phase2,inventory-unification}-proposal-v0.1.md`.

## B. 다음 수 (재개)

1. **⭐ 미커밋 정리 → 커밋·push(사용자 직접)**. 워킹트리:
   - `frontend/.../ItemCardTile.tsx`(FC-195 수정) + `docs/board/tickets/FC-195.md` → `fix(item): 인벤 카드 그리드 폭 정렬` 커밋
   - `docs/research/**` + `docs/spec/proposals/{game-claim-phase2,inventory-unification}-*.md` → `docs(delivery): 게임 연동 phase-2 탐색 자료 보존(연동 보류)` 커밋
   - 이 HANDOVER → `docs(board): 세션 마감 HANDOVER 갱신` 커밋
   - 커밋 매번 사용자 승인([[commit-needs-approval]]). push는 `! git push`(실패 시 IntelliJ, [[git-push-headless-resolver-fail]]).
2. **⭐ 신규 에픽 선택 → 게이트1**. 후보:
   - **관리자 페이지 에픽**(FC-116 언블록, 계약 확정 — 진입장벽 낮음)
   - **게임 지급 phase-2 재개**(보류 해제 시): 시작점 = architect가 게임 **native `itemreceive`가 전체 아이템 속성(레벨·스킬·골드포스) 지급 가능한지** 조사(GetStoredItemReceive 드레인이 items로 어떻게 materialize하나). 가능하면 게임 C++ 거의 안 짜고 web→itemreceive 기록으로 끝. 방향=B(우편함), old_sp 타깃.

## C. Git 상태
- **origin/master=`0be676d`**(EPIC-ITEM-DELIVERY 전건 push 완료). 로컬 **미커밋 다수**(위 B.1). 커밋된 것과 origin 동기, 워킹트리에 fix+docs.

## 환경 기동·상태
- **백엔드 8080 · 프론트 5173 = 기동 중**(이 세션에서 띄움). 헬스 UP(MySQL·ES yellow·Redis·메일). 기동법: env CRLF-safe 주입 + `./gradlew :backend:bootRun --args='--spring.profiles.active=local'`(JAVA_HOME=`C:\Users\howee\.jdks\ms-21.0.11`) · `npm --prefix frontend run dev`. [[env-verify-windows-crlf]].
- **Docker finalcall 스택**(mysql 3306·redis·es·kafka) healthy. 게임 DB **old_sp·new_sp·sp_2019**도 `finalcall-mysql`에 상존(게임 서버 실접속=**old_sp**).
- 데모 계정 demo1~demo10 / `demo1234!`(demo1=파랑기사…).

## 게임 연동 참고 (phase-2 재개용, 보류 중)
- **게임 서버 소스**: `D:\private_server\SP\gameserver\season5-250326\Channel32`(C++·VS2022·`.vcxproj`). 실접속 DB=**old_sp**(`shared/ServerConfig.h` databaseName). 게임 아이템 테이블=`items`(itm_uuid=**int**·itm_skill 패킹·itm_level 0-base·itm_gf 일수). new_sp(user_item·char40 uuid)와 거의 동일한 사본.
- **native 우편함**: 게임에 `itemreceive`(seller=수령자·sent 0/1·접속 시 `GetStoredItemReceive` 드레인) **이미 존재**. web→itemreceive 기록 재사용이 최소경로 후보(단 전체 아이템 속성 지급 가능 여부 미확인 = 재개 시 첫 조사).
- **리서치 결론**: B(단일 writer 게임서버 + 우편함 claim)=업계 표준. A(공유 인벤 직접쓰기)=안티패턴(온라인 충돌). 분리=자원격리 이점이나 지금 불필요. 상세 `docs/research/web-game-inventory-integration-research.md`. [[game-db-integration-model]]

## 이어받는 법 (새 세션)
1. CLAUDE.md 섹션 8~13(오케스트레이션·게이트·티켓·커밋).
2. 이 파일 + `git status`(미커밋 다수 예상) + `git log --oneline -6`(HEAD=origin=`0be676d`).
3. **미커밋 커밋·push**(B.1) 후 **신규 에픽 확정**(B.2).
4. 메모리 상시: `commit-needs-approval`·`commit-consolidation-preference`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`git-push-headless-resolver-fail`·`shared-card-components`·`game-db-integration-model`·`mockup-fidelity-only-fix`.
5. **미러 패리티**: KAN-210~219 done·KAN-220 backlog·KAN-221 done. 드리프트 없음.

## 교훈 (이 세션)
1. **큰 방향 결정 전 레퍼런스 리서치가 값지다** — "통합 vs 다리"에서 내 초기 직관(통합이 깨끗)을 deep-research가 뒤집음(통합=안티패턴). 업계 표준(B)이 우리가 이미 만든 것과 일치 → 확신 + 게임 대공사 회피.
2. **"실제로 쓰는 DB"를 config로 확인하라** — 배송·memo 에픽이 new_sp 가정으로 만들어졌으나 게임 실접속은 old_sp. 조기에 config/스키마 대조 필요.
3. **라이브 DOM 측정이 UI 버그 진단을 확정한다** — 인벤 "각 영역 깨짐" 모호 신고를, 카드 폭 실측(130/147/169 vs 셀 225)으로 근본원인(w-full 유실)까지 못박아 surgical 수정. 스크린샷 인상만으로 추정하지 않음.
4. **회귀 범인 오귀속 주의** — 인벤 폭 버그를 FC-190(최근 변경)으로 의심했으나 실제론 FC-178부터 잠복. git 이력 대조로 정정.
