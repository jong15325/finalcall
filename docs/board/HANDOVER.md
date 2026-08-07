# 총괄(메인 세션) 핸드오버

> **재시작 스냅샷 — 2026-08-07 / EPIC-QUALITY-CLEANUP 진행 중**
>
> - 사용자가 Codex에 Atlassian Rovo MCP를 등록하기 위해 세션을 재시작한다. 등록: `codex mcp add atlassian --url https://mcp.atlassian.com/v1/mcp/authv2` → `codex mcp login atlassian`. 새 세션에서 `/mcp verbose`로 확인한다.
> - Jira는 파일→KAN 단방향 읽기 미러다. 파일 보드가 정본이며 Jira를 읽어 판단하지 않는다. 현재 세션에는 Jira 도구가 없었다.
> - Jira 백필: `EPIC-QUALITY-CLEANUP`, `FC-218`, `FC-219`, `FC-220`, `FC-221`은 `state != todo`·`jira_key: null`. FC-194는 기존 `KAN-220`을 검토 중으로 갱신한다. 새 세션 첫 작업은 Atlassian 도구 확인 후 멱등 백필하고 파일의 `jira_key`를 채우는 것이다.
> - 에픽 게이트1·게이트2 승인 완료. `ownedByMe:boolean` 가법 계약 승인.
> - FC-220·FC-221·FC-194는 구현/계약 작업과 reviewer PASS(critical/major/minor 0) 완료, 상태 `review`, `review_status: passed`. 사용자가 현재 변경 커밋을 승인했다.
> - 남은 순서: Jira 백필 → FC-222 backend → FC-223 frontend → FC-224 OAuth 테스트 격리 → reviewer → 에픽 게이트3.
> - Git HEAD `90d53b0`, `origin/master`보다 1커밋 앞(FC-219 미push). 워킹트리에는 이번 에픽 변경과 사용자 미추적 `docs/AI-KICKOFF-PROMPT.md`가 있다. 사용자 파일은 커밋에서 제외한다.
> - 백엔드 8080·프론트 5173을 기동했으나 재시작 후 포트를 다시 확인한다.

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-08-07** (EPIC-BOARD·EPIC-COMMENT-V2 **두 에픽 완료·push**. 이후 게시판/댓글 UI 다듬기 라운드(FC-205·213~217) 전건 완료·push. **다음 수 = 신규 에픽 선택**(유력: 관리자 게시판 CRUD UI).)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 세션 경위**: (1) 출근 — 직전 배송 에픽 마감 상태에서 신규 에픽 방향 = **커스텀 게시판 시스템** 선택. (2) **EPIC-BOARD**(FC-196~204) — 계약(architect)→백엔드(레지스트리·게시글·댓글·이미지 MinIO/presigned·공지 흡수)∥프론트(허브·목록·상세·작성·댓글·이미지)→reviewer(백 PASS·프론트 MAJOR-1 editable auth 수정)→E2E 그린→security clean→게이트3 커밋4·push(`0be676d`…`7da7802`). notice 도메인 흡수·제거. (3) **EPIC-COMMENT-V2**(FC-206~212) — 평면 댓글을 네이버식으로: 대댓글 1단계·@멘션·공감/비공감(comment_reaction)·정렬(최신 기본)·BEST·tombstone. reviewer(백 M-1 same-user 반응 UK 500→비관적 직렬화+잠금read 수렴·프론트 MAJOR-1 BEST 캐시 무효화)→E2E 7시나리오 그린→security clean→게이트3 커밋5·push(`4ad84f9`). (4) 라이브 사용 중 사용자 피드백 다수 반영 — FC-205(모바일 인벤탭 제거)·FC-213(허브 링크)·FC-214(입력 전폭·대댓글 모바일·자동펼침)·FC-215(액션 배치 재설계 ⋮메뉴·디자인 게이트)·FC-216(인라인 답글폼)·FC-217(**BEST 제거** — 방금 만든 걸 사용자 요청으로 다시 제거). 전건 커밋·push(`37089df`).

---

## 지금 어디인가 — 한 문단

**게시판(EPIC-BOARD) + 네이버식 댓글(EPIC-COMMENT-V2) 완성·배포됨(origin=`37089df`).** 게시판을 DB 레코드로 정의(시드 커뮤니티·공지·이벤트)·게시글·이미지 첨부(MinIO/S3 presigned)·대댓글·공감/비공감·정렬까지 실동작. notice 도메인은 board로 흡수·제거됨(board가 참조 구현 승계, CLAUDE.md §1 갱신). 이후 라이브 피드백으로 UI 다수 조정(네비·입력폼·모바일·액션 ⋮메뉴·인라인 답글). **BEST 댓글은 만들었다가 사용자 요청으로 제거**(정렬 순공감순은 유지). **워킹트리 clean·전건 push 완료.**

---

## A. 이번 세션 완료 (전건 push)

| 에픽/티켓 | 내용 | Jira |
|---|---|---|
| **EPIC-BOARD** (FC-196~204) | 커스텀 게시판 — 레지스트리·게시글·댓글·이미지(MinIO presigned)·공지 흡수 + 프론트 화면 | KAN-222~231 done |
| **EPIC-COMMENT-V2** (FC-206~212) | 네이버식 댓글 — 대댓글 1단계·@멘션·공감/비공감·정렬·(BEST 후에 제거)·tombstone | KAN-233~240 done |
| FC-205 | 모바일 하단탭 인벤토리 제거(→ MY 프로필카드 진입) | KAN-232 done |
| FC-213 | 게시판 목록 상단 허브(← 게시판) 복귀 링크 | KAN-241 done |
| FC-214 | 상세 하단 "목록으로"·댓글 입력 전폭·대댓글 border 제거·모바일 여백/자간·자동펼침 | KAN-242 done |
| FC-215 | 댓글 액션 배치 재설계 — ⋮ 메뉴(수정삭제)·액션바 좌측(공감/비공감/답글)·모바일 메타 별행 (디자인 게이트) | KAN-243 done |
| FC-216 | 인라인 답글폼(클릭한 댓글 하단·단일 오픈) | KAN-244 done |
| FC-217 | **BEST 댓글 기능 제거**(프론트+백엔드+spec, 정렬 LIKES 유지) | KAN-245 done |

- 백로그(에픽 밖): FC-194(환경 테스트 위생 2건, KAN-220) — 미착수.

## B. 다음 수 (재개)

1. **⭐ 신규 에픽 선택 → 게이트1**. 유력 후보:
   - **관리자 게시판 CRUD UI**(FC-116 계열): 게시판을 런타임에 생성/삭제/설정하는 관리자 화면. 이번 EPIC-BOARD가 "시드로만 정의, 관리 UI는 다음 에픽"으로 남긴 부분 → **"완전 커스텀화" 완성**. 데이터 모델은 이미 런타임 CRUD 견디게 설계됨(Board 레지스트리). 계약·인가(admin) 기반 존재라 진입장벽 낮음.
   - 그 외: 게임 지급 phase-2 재개(보류 중)·다른 경매 도메인·이월 minor 처리.
2. **이월 minor**(차기 처리 후보, 비차단):
   - FC-211 중복렌더(중복 노출 없어진 지금은 영향↓) 반응 연타 가드·정렬 메뉴 키보드 roving focus·본인판정 닉 스냅샷 엣지(FC-211 리뷰).
   - FC-194 테스트 위생.

## C. Git 상태
- **origin/master=`37089df`**(전건 push 완료). 워킹트리 clean. 오늘 커밋 다수(EPIC-BOARD 4 + EPIC-COMMENT-V2 5 + UI 라운드 5).

## 환경 기동·상태
- **백엔드 8080 · 프론트 5173 = 기동 중**(이 세션에서 띄움). ★**주의**: 백엔드는 V24 적용 상태로 기동됐으나 **FC-217 BEST 제거 이후 재기동 안 함** → 실행 인스턴스에 폐지된 `/comments/best` 엔드포인트가 아직 살아있다(프론트 미호출이라 무해). **다음 세션에서 백엔드 재기동하면 완전 반영**. 기동법: env CRLF-safe 주입(`backend/.env`) + `./gradlew :backend:bootRun --args='--spring.profiles.active=local'`(JAVA_HOME=`C:\Users\howee\.jdks\ms-21.0.11`) · `npm --prefix frontend run dev`. [[env-verify-windows-crlf]].
- **Docker 스택** finalcall-mysql(3306)·redis·es·**minio(9000/9001)**·kafka healthy. 게이트웨이 토큰=`finalcall-local-gateway-shared-secret-change-me`(backend/.env GATEWAY_INTERNAL_SECRET=프론트 vite 기본과 일치). 직접 curl 시 `X-Gateway-Token` 필요.
- 데모 계정 demo1~demo10 / `demo1234!`. 관리자 테스트는 demo10 등 `is_admin=1` 승격(검증 후 원복).

## 게시판/댓글 시스템 참고 (다음 에픽용)
- **게시판**: `com.finalcall.domain.board`. Board 레지스트리(slug·write_policy ADMIN_ONLY/AUTHENTICATED·allow_comments·board_type). 시드 3(notice·community·event) = Flyway. Post·Comment·PostImage. 이미지=`infra/storage` StoragePort(S3 호환·MinIO 로컬/S3 운영·presigned GET·비공개 버킷). 계약 = `docs/spec/{board-domain-spec v1.2, api-contract v1.25, erd v1.9}`.
- **댓글 v2**: 대댓글 1단계 평탄화(parent=루트·mentioned_nickname 스냅샷)·comment_reaction(UK 유저당1행·원자 카운트·comment FOR UPDATE+잠금read 수렴)·정렬 LATEST(기본)/OLDEST/LIKES·tombstone(답글 보유 루트 마스킹). BEST 제거됨. [[game-db-integration-model]] 무관.
- **관리자 기반**: `User.isAdmin` JWT 클레임·ROLE_ADMIN. 게시판/게시글/댓글 인가에 이미 사용.

## 이어받는 법 (새 세션)
1. CLAUDE.md 섹션 8~13(오케스트레이션·게이트·티켓·커밋).
2. 이 파일 + `git status`(clean 예상) + `git log --oneline -12`(HEAD=origin=`37089df`).
3. **신규 에픽 확정**(B.1) → 게이트1.
4. 메모리 상시: `commit-needs-approval`·`commit-consolidation-preference`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`git-push-headless-resolver-fail`·`shared-card-components`·`design-mockup-first`·`options-need-html-mockup`·`responsive-separate-design`·`palette-source-of-truth`·`env-verify-windows-crlf`.
5. **미러 패리티**: KAN-222~245 done·KAN-220(FC-194) backlog. 드리프트 없음.

## 교훈 (이 세션)
1. **큰 UI 변경 전 목업이 값지다** — 게시판·댓글·댓글액션 모두 HTML 목업으로 방향 먼저 승인받아 재작업 최소화(design-mockup-first).
2. **동시성은 라이브/테스트로만 드러난다** — 댓글 반응 same-user 더블서브밋 UK 500은 리뷰가 잡고, 수정도 "comment 락만으론 부족(post 비잠금 read가 스냅샷 고정)→반응 조회를 잠금 read로"라는 2차 진단이 핵심이었다. E2E 병렬 부하로 최종 확인.
3. **만든 것도 사용자가 빼라면 뺀다** — BEST 댓글을 구현 직후 제거(정렬 LIKES는 유지). 계약·spec까지 함께 되돌려 드리프트 방지.
4. **라이브 피드백 루프가 빠르다** — dev 서버 hot-reload로 UI 조정을 즉시 반영·확인하는 사이클이 효율적이었다.
