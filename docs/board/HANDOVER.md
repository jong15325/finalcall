# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-08-04** (EPIC-CARD-SYSTEM 착수 — 카드 컴포넌트 통합. T1·T2·T3 완료·커밋, **T4 착수 직후 사용자 중지 → 다음 세션 재개**. 그 앞 세션분: 메모 라이브검증→세션 신원버그(FC-174/175)·음수정산(FC-176)·인벤토리=마켓카드(FC-177/178) 전건 완료.)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 세션 경위**: (1) EPIC-MEMO **Jira 백필**(KAN-191~195, 도구 복구). (2) 메모 **라이브 검증** 중 **계정 전환 신원 노출 버그 발견**(demo2로 보낸 쪽지가 sender=demo1 저장) → **FC-174**(세션 원자 리셋+refresh 세대 가드)·**FC-175**(minor 하드닝) 수정·라이브 재검증. (3) 보안 점검(로그인·구매·판매·경매, 대중적 수준) → critical/major 0, 유일 실질결함 **FC-176 음수 정산**(게이트2 B=수수료 클램프) 수정. (4) 판매 UX 개편 — **FC-177**(인벤토리 개편+인벤토리→판매 직접 플로우, /sell?item 선점)·**FC-178**(인벤토리=아이템 마켓 카드정보 모달). (5) 사용자 피드백("카드 재사용이 매번 달라짐") → **EPIC-CARD-SYSTEM**(카드 통합) 게이트1 승인 → **T1**(스킬명 API)·**T2**(카드 규약 rules.md §9)·**T3**(ItemCardGrid 정본+인벤 간격) 완료·커밋. **T4**(CardInfoDialog) 착수 직후 사용자 중지. **다음 수 = push + T4→T5→T6 재개.**

---

## 지금 어디인가 — 한 문단

**EPIC-CARD-SYSTEM 1차(T1~T3) 완료·커밋, T4 재개 대기.** 카드 영역을 정본 공유 컴포넌트로 통합 중 — 규약(rules.md §9)·정본 그리드(ItemCardGrid, 마켓·경매 픽셀 보존+인벤 gap-2)·스킬명 백엔드 API(ItemSummaryResponse += skill1/2Name)가 done. **T4(CardInfoDialog 정본 셸)는 착수 직후 하네스가 사용자 중지로 종료** — 부분 산출물(신규 셸·CSS/channelLimit 이동·소비자 편집)은 **전부 복구**, 코드는 b69e3e1 상태로 green. origin/master=**`fae437d`**, 로컬 **6 ahead(미push)**. 워킹트리엔 `FC-182.md`(todo 복귀 편집)만.

---

## A. 이번 세션 완료 (전부 done)

| 티켓/에픽 | 내용 | 커밋 | Jira |
|---|---|---|---|
| EPIC-MEMO 백필 | KAN-191~195 upsert·Done·링크 | `be0ff87`~`d6a9a43` | 완료 |
| FC-174 | 계정 전환 세션·캐시 오염 수정(원자 리셋·refresh 세대 가드) | `a37a84d` | KAN-196 |
| FC-175 | 세션 수정 minor 하드닝(MePage 컨텍스트 clear·세대 가드) | `7c575f2` | KAN-197 |
| FC-176 | 음수 정산 방지(수수료 판매가 클램프, 게이트2 B) | `fae437d` | KAN-198 |
| FC-177 | 인벤토리 개편 + 인벤토리→판매 직접 플로우(/sell?item 선점) | `291d9d0` | KAN-199 |
| FC-178 | 인벤토리=아이템 마켓 카드정보 모달('바로구매'→'판매 등록') | `27c3165` | KAN-200 |
| **FC-179 (T1)** | 인벤토리 스킬명 API(ItemSummaryResponse += skill1/2Name, api-contract v1.21) | `e71404b` | KAN-201 |
| **FC-180 (T2)** | 카드 정본 재사용 규약(docs/frontend/rules.md §9) | `b69e3e1` | KAN-203 |
| **FC-181 (T3)** | ItemCardGrid 정본 + 3그리드 이관 + 인벤 gap-3→gap-2 | `328385a` | KAN-204 |
| (기타) FC-151 | TCP 커넥션 누수 조사 **취소**(재현 불가) | — | KAN-168 완료 |
| (기타) nav/UI | 좌측 네비 쪽지·마이페이지 제거·모바일 보유코드 숨김 | `697acc8` | — |

- **보안 점검 결과**(보드 미기록·HANDOVER만): 로그인·구매·판매·경매 critical/major 0. minor(로그인 타이밍·게이트웨이 상수시간·availability 열거)는 저신호로 보류. 유일 실질결함=FC-176 처리 완료.

## B. 다음 수 (재개)

1. **⭐ push(사용자 직접)**: origin=`fae437d` 대비 로컬 **6커밋** 미push — `697acc8`·`291d9d0`·`27c3165`·`e71404b`·`328385a`·`b69e3e1`. `! git push`(실패 시 IntelliJ, [[git-push-headless-resolver-fail]]).
2. **⭐ EPIC-CARD-SYSTEM 재개(KAN-202)** — 계획 정본 `docs/common/proposals/card-system-consolidation-proposal-v0.1.md`. 직렬 T4→T5→T6:
   - **T4** FC-182(KAN-205, todo 복귀): `CardInfoDialog` 정본 셸 + Shop/Inventory 포크 리팩터(구매 뮤테이션 footer 슬롯)·CSS/channelLimit shop→item 승격. **위험↑ 모달 a11y·마켓 시각** — 시각 diff·a11y 테스트 게이트. (이번 세션 착수분은 전량 폐기됨, fresh 재실행.)
   - **T5** FC-183: `ItemCardTile` 정본 + ShopCard/InventoryItemCard 어댑터화 + CardCompareOverlay auction→item 승격. (T4 후)
   - **T6** FC-184: `ItemCard` variant 정비(hidePrice→nullable price·skillFlip→variant) + **스킬명 FE 배선**(T1 API 소비 → 인벤 "스킬 #코드" 해소). (T1·T4·T5 후)
   - T7(경매 카드 프리미티브 추출) 보류.
3. 백로그(사용자 선택): 게임 아이템 지급 연동 에픽 · 관리자 페이지 에픽(FC-116 언블록) · FC-114 이메일 인증 stale 정리.

## C. Git 상태
- **origin/master=`fae437d`**, 로컬 HEAD=`b69e3e1`, **6 ahead·미push**. 워킹트리 = `docs/board/tickets/FC-182.md`(T4 todo 복귀) M 하나뿐.
- 규율: 커밋 매번 사용자 승인(이번 세션 다수 승인). push 사용자 직접([9.3]). **관련 문서는 묶어 커밋**([[commit-consolidation-preference]]).

## 환경 기동·상태
- **백엔드 8080 · 프론트 5173 = 가동 중**(이번 세션 기동, HMR). 기동법: `./gradlew :backend:bootRun`(local + `backend/.env` 셸 주입·JAVA_HOME=`C:\Users\howee\.jdks\ms-21.0.11`) · `frontend`에서 `npm run dev`. env는 CRLF strip·빈값 skip([[env-verify-windows-crlf]]).
- **Docker finalcall 스택**(mysql 3306·redis 6379·es 9200·kafka 9092·kafka-connect 8083) healthy. `new_sp` 게임 DB도 `finalcall-mysql`에 상존.
- 브라우저 탭 열려 있음(demo1 로그인). 데모 계정 demo1~demo10 / `demo1234!`(닉: demo1=파랑기사, demo2=홍염상단, demo3=표류대장장이…).

## 이어받는 법 (새 세션)
1. CLAUDE.md 섹션 8~13(오케스트레이션·게이트·티켓·커밋).
2. 이 파일 + `git status`(FC-182.md 1건 예상) + `git log --oneline -8`(HEAD=`b69e3e1`, origin=`fae437d`).
3. **EPIC-CARD-SYSTEM**: 계획 `card-system-consolidation-proposal-v0.1.md`, 규약 `docs/frontend/rules.md §9`. T4(FC-182)부터 재개.
4. 메모리(이번 세션 신규): `shared-card-components`·`live-verify-multi-account`·`commit-consolidation-preference`. 상시: `commit-needs-approval`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`git-push-headless-resolver-fail`·`design-mockup-first`·`git-mv-prestage-commit-bleed`.
5. **미러 패리티**: KAN-191~205 미러됨(EPIC-CARD-SYSTEM=KAN-202 진행중, T4=KAN-205 해야할일). 드리프트 없음.

## 교훈 (이 세션)
1. **킬된 에이전트는 부분 산출물을 남긴다.** T4 중지 시 신규 셸 파일 + git mv 파일이동 + 소비자 편집이 워킹트리에 남아 빌드가 깨졌다 — 마감 정리 시 `git status`로 **전수 복구**(rename 원위치·수정 restore·미추적 삭제) 필수([[git-mv-prestage-commit-bleed]]).
2. **카드 재사용은 정본 공유 컴포넌트로**(EPIC-CARD-SYSTEM) — "똑같이"가 매번 다른 건 페이지마다 재구현 탓([[shared-card-components]]).
3. **라이브 검증은 계정 전환·신원 격리까지**(FC-174 발견, [[live-verify-multi-account]]).
4. **스킬명 등 마스터 데이터는 백엔드 단일 원천(SkillDefinition) 노출**, 프론트 enum 복제 금지(게이트2 A).
5. **가법 계약 델타는 저위험**(ItemSummaryResponse += 스킬명, fetch join 기존이라 N+1 없음).
