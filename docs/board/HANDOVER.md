# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-08-01** (메모/쪽지 에픽 **EPIC-MEMO 전건 완료·리뷰 PASS·보안 clean·커밋·push 완료**. 라이브 검증만 익일 예정, 그 외 대기 없음.)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 세션 경위**: FC-113(메모/쪽지 백로그) 착수 → 게임 연동 아키텍처 리서치·결정 → **EPIC-MEMO**(FC-170~173)로 구현·완료. (1) 레거시 웹(`KSPWEB-master`)·실게임 DB(`new_sp.user_memo`) 검토 + **전수 조사**(`docs/spec/proposals/game-db-survey.md`), (2) **게이트2급 아키텍처 결정 — finalcall DB가 곧 게임 DB(통합 스키마)·nickname=게임계정·서버 재컴파일 가능/클라 고정·우편함 클레임 패턴**([[game-db-integration-model]]·[[game-memo-byte-format]]), (3) 계약 확정(memo-domain-spec v1.0·api-contract §2.6 v1.20·erd §4.1 V20), (4) 백엔드(FC-171)∥프론트(FC-172) 구현, (5) 디자인 게이트(팔레트 A=navy/gold/orange 확정, [[palette-source-of-truth]]), (6) reviewer(FC-173) **1차 CHANGES-REQUESTED(MAJOR 2)→재작업→재검토 PASS**, (7) 보안 리뷰 clean, (8) 4 atomic 커밋·push. **다음 수 = 라이브 검증(익일) + 백로그(사용자 선택).**

---

## 지금 어디인가 — 한 문단

**EPIC-MEMO 전건 완료·push까지 끝. 라이브 검증만 익일 예정.** 회원 간 메모/쪽지를 finalcall 네이티브 도메인으로 구현 — 발신·받은함/보낸함(커서)·상세+읽음전이·삭제, 게임 클라 호환(닉 스냅샷·28바이트 자동 줄바꿈 boundary·레벨/성별 스냅샷 기본 Lv.1·남·`user_memo` V20). origin/master = **`d6a9a43`**, 로컬 동기화(0/0 — `be0ff87` HANDOVER 갱신·`d6a9a43` jira_key 역기록 push 완료). ✅ **Jira 미러 백필 완료**(2026-08-03): KAN-191(에픽)+KAN-192~195(FC-170~173) 생성·Done·Blocks 링크, 보드 `jira_key` 역기록·패리티 일치. 백/프론트 서버는 이 세션에서 재기동 안 함(라이브 검증 시 기동).

---

## A. 완료 (이 세션) — 전부 done·push (origin=`fbe8ef1`)

| 티켓 | 내용 | 커밋 |
|---|---|---|
| FC-170 | 메모 도메인 계약·스키마 확정(게이트2 4결정) | `7c78f32` docs(spec) |
| FC-171 | 백엔드 도메인(6엔드포인트·바이트 유틸·V20·인가 IDOR 가드) | `6bb8223` feat(memo) |
| FC-172 | 웹 UI(2단 메신저형·모바일 전환형·안 A 자유입력+28byte 미리보기) | `c03754c` feat(memo) |
| FC-173 | 통합 리뷰 PASS(1차 MAJOR2→재작업→재검토) | `fbe8ef1` docs(board) |

- **게이트2 4결정 확정**: (a) 레벨/성별=메모 스냅샷·기본 Lv.1·남, (b) body 순수 원문 저장·게임출력 시에만 28byte 패딩, (c) `user_memo` 신규+V20, (d) 안 A 자유입력+**28byte 자동 줄바꿈 필수**.
- **재작업 이력**: MAJOR-1(커서 size 미보정→normalizeSize 이식)·MAJOR-2(발신자 닉 30자→VARCHAR(16) 오버플로→§8.2 16byte 절단) + 인가/전이/경계 테스트 추가.
- **보안 리뷰 clean**(에픽 완료 직전 온디맨드 1회): IDOR·SQL·XSS·데이터노출 전부 안전.

## B. 다음 수 (사용자 선택)
1. **⭐ 라이브 검증(익일 — 사용자 예정)**: 백엔드 8080·프론트 5173 기동 후 브라우저에서 쪽지 발신/받은함/보낸함/읽음/삭제 확인. "라이브 검증까지가 완료"(지난 세션 교훈).
2. ~~**Jira 미러 백필**~~ ✅ **완료(2026-08-03)**: KAN-191~195 upsert·Done·Blocks·`jira_key` 역기록([[jira-mirror-discipline]]).
3. **게임 아이템 지급 연동(신규 에픽 후보)**: 웹 구매→인게임 지급. 이번 에픽의 **우편함 클레임 패턴**을 확장(웹은 지급 대기함에만 기록, 게임이 멱등 claim). 기존 인벤토리 모델(`item_instance.location`)·Kafka 인프라 재사용. 근거 = [[game-db-integration-model]].
4. **관리자 페이지 에픽**(미착수) — 착수 시 FC-116(재색인 API) 언블록.
5. **FC-114** 회원가입 이메일 인증(todo) — ⚠️ EPIC-EMAIL-VERIFY 이미 done → stale 의심, cancelled 정리 필요(대조 후).
6. **FC-151**(blocked) 백엔드 TCP 커넥션 누수 — 재발 시 재개. kill 전 커넥션 캡처 필수.

## C. Git 상태
- **origin/master = `fbe8ef1`**, 로컬 동기화(0/0). 이 세션 4커밋(`7c78f32`~`fbe8ef1`) 전부 push됨.
- 규율: 커밋 매번 사용자 승인(이 세션 4커밋 승인). push는 사용자 직접(`! git push` 성공).

## 환경 기동·상태
- **백엔드 8080 · 프론트 5173 = 이 세션 미기동**(익일 라이브 검증 시 기동). 기동법: `./gradlew :backend:bootRun`(local 프로파일 + `backend/.env` 셸 주입·JAVA_HOME=`C:\Users\howee\.jdks\ms-21.0.11`) · `npm run dev`. 8080/5173 점유 확인·kill 후.
- **게임 DB `new_sp`**: `finalcall-mysql` 컨테이너(3306, root/root)에 상존(`new_sp`·`old_sp`·`sp_2019`·`finalcall`). 이번 세션 전수 조사에 사용. `new_sp.user_memo`=게임 메모 원본(3897행).
- **Docker finalcall 스택**(mysql·redis·es·kafka): 기동 여부 익일 확인. `docker compose -f backend/docker-compose.local.yml up -d`.
- **.env**: `backend/.env`·`frontend/.env`(gitignore). CRLF strip·빈값 skip([[env-verify-windows-crlf]]).
- **게이트웨이(8000) 미기동**: 로컬 프론트 검증은 vite 프록시 8080 직결(X-Gateway-Token 주입). 메모 엔드포인트(`/api/v1/me/memos`)는 `anyRequest().authenticated()`가 커버 — 게이트웨이 신규 배선 불요(게이트웨이 auth-rate-limited는 permitAll 경로만 대상, 메모는 인증 필요라 해당 없음).

## 이어받는 법 (새 세션)
1. CLAUDE.md 섹션 8~13(오케스트레이션·게이트·티켓·커밋).
2. 이 파일 + `git status`(0/0 예상) + `git log --oneline -6`(origin=`fbe8ef1`).
3. 메모리(이번 세션 신규): `game-db-integration-model`·`game-memo-byte-format`·`palette-source-of-truth`. 상시: `commit-needs-approval`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`git-push-headless-resolver-fail`·`env-verify-windows-crlf`·`design-mockup-first`.
4. **미러 패리티**: ✅ KAN-191~195 백필 완료(2026-08-03)·`jira_key` 역기록·패리티 일치. 추가 대기 없음.

## 교훈 (이 세션)
1. **아키텍처 결정을 리서치로 뒷받침**: 웹구매→인게임지급 패턴을 레퍼런스 조사 후 "우편함 클레임 + 단일 쓰기자"로 정리. "DB 통합"은 절반이고 쓰기 소유자 규칙이 핵심.
2. **정본 목업 ≠ 실제 앱 색**: 목업 HTML(퍼플/블랙 U-021)이 shipping index.css(navy/gold/orange)와 stale 괴리 → frontend-impl 재작업. 신규 화면 색 정본 = index.css([[palette-source-of-truth]]).
3. **선택지는 인터랙티브 목업으로**: 입력 방식(자유입력 vs 고정폼)을 28byte 실시간 미리보기 목업으로 보여주고 사용자가 A안 선택.
4. **리뷰가 슬라이스 사각을 잡는다**: 슬라이스 테스트가 짧은 닉만 써 발신자 닉 오버플로(MAJOR-2)를 못 잡음 → reviewer가 발견, 재작업 시 20자 닉 회귀가드 추가.
5. **바이트 규칙 동치**: 프론트(코드포인트)↔백엔드(코드유닛) 순회 불일치를 리뷰가 발견 → 백엔드=정본으로 프론트 정렬.
