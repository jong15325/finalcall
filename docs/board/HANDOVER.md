# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-30** (소셜 후속 + 닉네임/아이디 중복확인 UX — **EPIC-NICKNAME-UX·EPIC-LOGINID-CHECK 2개 에픽 + FC-158·159·164 전건 완료·리뷰 PASS·커밋**. push만 대기.)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 세션 경위**: (1) 대기였던 `.env`→`backend/.env` 이동 커밋, (2) **FC-158** 회원가입 소셜버튼 제거, (3) **FC-159** 닉네임 유니크 게이트2 — A(해제) 잠정→철회→**B(유지) 확정**(닉네임=판매자 표시 노출), (4) **EPIC-NICKNAME-UX**(FC-160~163) 닉네임 라이브 중복확인 API + 소셜 항상-꼬리표 — reviewer 1차 MAJOR-1(게이트웨이 rate-limit 미배선)→재작업→PASS, (5) **FC-164** oauth rate-limit 선존 gap 수정, (6) **EPIC-LOGINID-CHECK**(FC-165~168) 아이디 라이브 중복확인(준비중 placeholder 교체·닉네임 미러·공용 컴포넌트 일반화) — reviewer PASS. **다음 수 = ① push(사용자 직접) ② 후속 관찰 검토.**

---

## 지금 어디인가 — 한 문단

**두 에픽 + 단발 3건 전부 done·커밋 완료, push만 남음.** 회원가입에 닉네임·아이디 **라이브 중복확인**이 붙었고(공용 `AvailabilityCheck` 컴포넌트), 소셜 최초가입은 provider명+**항상 랜덤 꼬리표**, 게이트웨이 auth rate-limit에 신규 3경로(nickname/availability·oauth/**·login-id/availability) 배선 완료. origin/master = `45a657e`, 로컬은 **10커밋 앞섬**(코드/spec 9 + board 1). **다음 수 = ① 사용자 push ② 후속 관찰 3건 검토.**

---

## A. 완료 (이 세션)

### EPIC-NICKNAME-UX (KAN-179~183) — done, reviewer PASS
닉네임 유니크 **유지**(FC-159 B) 하 UX 2건. FC-160 계약(architect)·FC-161 백엔드(가용성 조회 API+소셜 항상-꼬리표)·FC-162 프론트(닉네임 라이브 확인)·FC-163 리뷰(1차 MAJOR-1 게이트웨이 rate-limit→재작업→PASS).
- 엔드포인트 `GET /api/v1/auth/nickname/availability`(permitAll·advisory·최종 AUTH_002). 소셜: provider 스템(≤25)+항상 `_XXXX`.

### EPIC-LOGINID-CHECK (KAN-185~189) — done, reviewer PASS
아이디 라이브 중복확인(준비중 placeholder 교체, 닉네임 미러). FC-165 계약·FC-166 백엔드·FC-167 프론트·FC-168 리뷰(PASS, 게이트웨이 배선 처음부터 포함).
- 엔드포인트 `GET /api/v1/auth/login-id/availability`(permitAll·advisory·최종 AUTH_001). 프론트 공용 `AvailabilityCheck`/`AvailabilityCheckButton` 일반화(닉네임·아이디 공유).

### 단발
- **FC-158**(KAN-177) 회원가입 소셜버튼 제거(로그인엔 유지) — done, reviewer PASS.
- **FC-159**(KAN-178) 닉네임 유니크 검토 — 게이트2 **B(유지)** 결정 — done.
- **FC-164**(KAN-184) oauth `/api/v1/auth/oauth/**` 게이트웨이 rate-limit 배선(선존 gap, FC-163 발견) — done.

---

## B. 다음 수 (다음 세션)

1. **★ push(사용자 직접)** — 로컬 10커밋(아래 C). 소켓 정상이면 `! git push`, 아니면 IntelliJ Push([[git-push-headless-resolver-fail]]).
2. **후속 관찰 3건(비차단, reviewer 지적)**:
   - **loginId param 완전 누락 통합테스트 1건**(현 `@NotBlank`가 null 400 보장, 안전망 강화용).
   - **auth 엔드포인트 신설 시 게이트웨이 predicate 등재 = DoD 고정** — 이번 2회 발생(FC-161 MAJOR-1·FC-164). 컨벤션/체크리스트化 검토(consultant 소환 후보).
   - loginId/nickname **정규화(trim/lowercase) 도입 시 조회·signup 동반 개정** 필수(현재 둘 다 원문·정합).
3. **라이브 검증**: 회원가입 화면에서 닉네임·아이디 중복확인 버튼 실동작 + 소셜 로그인 닉네임 꼬리표 눈으로 확인(교훈: 라이브 검증까지가 완료).

---

## C. Git 상태
- **origin/master = `2d49760`**(사용자가 push함 — 두 에픽+FC-158/159/164 전부 원격 반영). 이후 **FC-169 커밋 3건 로컬 미push**: `aa87527`(fix 프론트 게이팅)·`2bbacbb`(docs spec v1.19)·(+board docs 커밋). **다음 push는 이 3건.**
- 규율: 커밋 매번 사용자 승인(이 세션 전부 승인받음). push는 사용자 직접.

## C-2. FC-169 (KAN-190) — 회원가입 중복확인 필수 게이팅 · done
사용자 보고("중복확인 없이 회원가입 뚫림") 수정. advisory→필수 게이팅: 아이디·닉네임 둘 다 available 확인해야 제출, 미확인/중복/값변경 시 차단+안내+포커스, **비동기 경합 가드**(reviewer 1차 MAJOR M1→재작업→PASS), 백엔드 409 최종 방어선 유지. api-contract v1.19.

## 환경·미러
- **보드↔Jira 정합**: KAN-177~**190** 전부 미러(에픽 2개 KAN-179·185 done, 하위·단발·FC-169 done). 이 세션 상태 전이마다 즉시 미러.
- **환경 가동 중(세션 말)**: 백엔드 8080(`./gradlew :backend:bootRun` local+`backend/.env`)·프론트 5173(`npm run dev`) background. Docker finalcall 스택 재기동됨. 다음 세션 재기동 시 8080/5173 점유 확인·kill 후. 라이브 스모크 통과(가용성 API·400·403 게이트웨이 강제).
- **.env**: `backend/.env`(백)·`frontend/.env`(프). 카카오·네이버 키 유지. IntelliJ EnvFile 경로는 `backend/.env`.
- 함정: `.env` 검증 bash 정본([[env-verify-windows-crlf]]), git push 셸 소켓([[git-push-headless-resolver-fail]]).

## 이어받는 법 (새 세션)
1. CLAUDE.md 섹션 8~13(오케스트레이션·게이트·티켓·커밋).
2. 이 파일 + `git status`(board 커밋 여부) + `git log --oneline -14`(origin=`2d49760`, 로컬은 FC-169 3커밋 앞섬·미push).
3. 메모리: `commit-needs-approval`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`git-push-headless-resolver-fail`·`gateway-authroute-ratelimit-dod`.
4. **미러 패리티**: KAN-177~190 done 미러 완료.

## 교훈 (이 세션)
1. **게이트웨이 배선은 auth 엔드포인트 DoD의 일부**: FC-161이 rate-limit predicate 누락으로 reviewer MAJOR-1 → 재작업. loginId(FC-166)는 처음부터 포함해 재발 없음. "신규 permitAll auth 경로 = 게이트웨이 등재 동반"을 계약 DoD에 고정하라.
2. **작은 결정도 스키마·인가면 게이트2**: 닉네임 유니크(A→철회→B)는 UK/signup 파급이라 게이트2로 수렴. 사용자가 표시 노출을 근거로 B 선택.
3. **패턴 미러는 공용화 기회**: 아이디 중복확인이 닉네임을 그대로 미러 → 프론트가 `AvailabilityCheck`로 일반화(중복 제거).
4. **advisory 일관성**: 가용성 조회는 예약 아님·UK가 최종 원자 방어 — 코드/프론트/테스트에 일관 반영. 정규화 도입 시 조회·signup 동반 개정.
