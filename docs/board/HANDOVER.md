# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-30** (닉네임/아이디 중복확인 UX + 소셜 후속 + 회원가입 게이팅 버그픽스 — **전건 완료·리뷰 PASS·커밋·push·라이브 검증 완료**. 대기 작업 없음.)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 세션 경위**: (1) `.env`→`backend/.env` 이동, (2) **FC-158** 회원가입 소셜버튼 제거, (3) **FC-159** 닉네임 유니크 게이트2 → **B(유지) 확정**, (4) **EPIC-NICKNAME-UX**(FC-160~163) 닉네임 라이브 중복확인 API + 소셜 항상-꼬리표(reviewer 1차 MAJOR-1 게이트웨이 rate-limit→재작업→PASS), (5) **FC-164** oauth rate-limit 선존 gap 수정, (6) **EPIC-LOGINID-CHECK**(FC-165~168) 아이디 라이브 중복확인(준비중 placeholder 교체·공용 `AvailabilityCheck` 일반화), (7) **FC-169** 회원가입 중복확인 **필수 게이팅**(사용자 버그보고 "뚫림"; reviewer 1차 MAJOR M1 비동기 경합→재작업→PASS; 라이브 검증 완료). **다음 수 = 백로그(사용자 선택).**

---

## 지금 어디인가 — 한 문단

**이 세션 전건 완료·push·라이브 검증까지 끝. 대기 작업 없음.** 회원가입에 아이디·닉네임 **라이브 중복확인 + 필수 게이팅**(미확인 시 차단·안내·재확인), 소셜 최초가입 provider명+**항상 랜덤 꼬리표**, 게이트웨이 auth rate-limit에 신규 3경로 배선 완료. origin/master = **`1ee6f3a`**, 로컬 동기화(0/0). Jira KAN-177~190 전부 done 미러. 백엔드 8080·프론트 5173 가동 중.

---

## A. 완료 (이 세션) — 전부 done·push

| 항목 | 내용 | Jira |
|---|---|---|
| FC-158 | 회원가입 소셜버튼 제거(로그인 유지) | KAN-177 |
| FC-159 | 닉네임 유니크 게이트2 → **B(유지)** | KAN-178 |
| **EPIC-NICKNAME-UX** (FC-160~163) | 닉네임 라이브 중복확인 API(`GET /api/v1/auth/nickname/availability`) + 소셜 항상-꼬리표 | KAN-179~183 |
| FC-164 | oauth `/api/v1/auth/oauth/**` 게이트웨이 rate-limit 배선(선존 gap) | KAN-184 |
| **EPIC-LOGINID-CHECK** (FC-165~168) | 아이디 라이브 중복확인(`GET /api/v1/auth/login-id/availability`), 준비중 placeholder 교체, 공용 `AvailabilityCheck` 일반화 | KAN-185~189 |
| **FC-169** | 회원가입 중복확인 **필수 게이팅**(미확인 차단·재확인·비동기 경합가드), api-contract v1.19 | KAN-190 |

- 계약: api-contract v1.15→**v1.19**(가용성 2엔드포인트 + 게이팅 문구). 판정=기존 `existsBy...AndIsDeletedFalse` 재사용(조회↔가입 동일경로). advisory 엔드포인트 + 백엔드 409 최종방어 + 프론트 필수 게이팅.
- 게이트웨이 `auth-rate-limited` predicate 최종: login·signup·refresh·nickname/availability·oauth/**·login-id/availability.

## B. 다음 수 (백로그 — 대기 작업 없음, 사용자 선택)
1. **관리자 페이지 에픽**(미착수) — 착수 시 **FC-116**(온디맨드 재색인 API+alias 스위치, KAN 미발행) 언블록. 총괄 추천 우선순위 1순위.
2. **FC-113** 메모/쪽지 기능(회원 간 메시지) — 독립 신규 도메인(todo).
3. **FC-114** 회원가입 이메일 인증(todo) — ⚠️ **EPIC-EMAIL-VERIFY 이미 done** → stale 의심, cancelled 정리 필요(대조 후).
4. **FC-151**(KAN-168, blocked) 백엔드 TCP 커넥션 누수 — 재발 시 재개. **kill 전 `Get-NetTCPConnection | Group State,LocalPort,RemotePort` 캡처** 필수.
5. **리뷰 후속 관찰(비차단)**: loginId param 누락 통합테스트 1건 · auth 엔드포인트 신설 시 게이트웨이 predicate 등재 DoD 고정([[gateway-authroute-ratelimit-dod]]) · loginId/nickname 정규화 도입 시 조회·signup 동반개정.

## C. Git 상태
- **origin/master = `1ee6f3a`**, 로컬 동기화(0/0). 이 세션 13커밋 전부 push됨(`.env`~FC-169).
- 규율: 커밋 매번 사용자 승인(이 세션 전부 승인). push는 사용자 직접(이 세션 소켓 정상, `! git push` 성공).

## 환경 기동·상태
- **백엔드 8080 · 프론트 5173 가동 중**(총괄 background): `./gradlew :backend:bootRun`(local 프로파일 + `backend/.env` 셸 주입·JAVA_HOME=`C:\Users\howee\.jdks\ms-21.0.11`) · `npm run dev`. 다음 세션 재기동 시 8080/5173 점유 확인·kill 후.
- **Docker finalcall 스택**(mysql·redis·es·kafka·kafka-connect) 재기동됨(14h 전 종료돼 있던 것 → `docker compose -f backend/docker-compose.local.yml up -d`). ※ 별개 `on-race-main-*` 컨테이너 상존(포트 무충돌).
- **.env**: `backend/.env`·`frontend/.env`(gitignore). 카카오·네이버 키 유지. gradle bootRun은 .env를 **셸 환경변수로 주입**(dotenv 의존 없음) — CRLF strip·빈값 skip 필수([[env-verify-windows-crlf]]). IntelliJ EnvFile 경로는 `backend/.env`.
- **게이트웨이(8000) 미기동**: 로컬 프론트 검증은 vite 프록시가 8080 직결+X-Gateway-Token 주입(토큰=`finalcall-local-gateway-shared-secret-change-me`, 백/프론트/local yml 3자 일치)이라 게이트웨이 불요. `GATEWAY_INTERNAL_ENFORCED=true`라 토큰 없는 직접 8080 접근은 403.
- **라이브 스모크 통과**: 닉네임/아이디 가용성 API(true/false)·400 검증·403 게이트웨이 강제·FC-169 게이팅(브라우저 사용자 확인).

## 이어받는 법 (새 세션)
1. CLAUDE.md 섹션 8~13(오케스트레이션·게이트·티켓·커밋).
2. 이 파일 + `git status`(0/0 예상) + `git log --oneline -14`(origin=`1ee6f3a`).
3. 메모리: `commit-needs-approval`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`git-push-headless-resolver-fail`·`env-verify-windows-crlf`·`gateway-authroute-ratelimit-dod`.
4. **미러 패리티**: KAN-177~190 done 미러 완료.

## 교훈 (이 세션)
1. **게이트웨이 배선 = auth 엔드포인트 DoD**: FC-161 rate-limit predicate 누락→reviewer MAJOR-1→재작업. loginId(FC-166)는 처음부터 포함해 재발 없음. 신규 permitAll auth 경로는 게이트웨이 등재 동반([[gateway-authroute-ratelimit-dod]]).
2. **작은 결정도 스키마·인가면 게이트2**: 닉네임 유니크(A→철회→B)는 UK/signup 파급이라 게이트2 수렴. 사용자가 표시 노출 근거로 B.
3. **패턴 미러는 공용화 기회**: 아이디 중복확인이 닉네임 미러 → 프론트 `AvailabilityCheck` 일반화.
4. **비동기 경합은 리뷰가 잡는다**: FC-169 "값 변경 시 재확인"이 동기 경로만 맞고 in-flight 응답 경합에서 뚫림 → reviewer MAJOR M1. resolve 시점 값비교(ref) 가드로 해소. 상태-비동기 UX는 stale resolve 가드를 기본 점검.
5. **라이브 검증까지가 완료**: FC-169는 커밋·push 후 브라우저에서 실제 차단 동작을 사용자가 눈으로 확인해 종료.
