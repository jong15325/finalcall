# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 에픽 완료마다 + 세션이 무거워질 때(덮어씀, 이력은 git).
갱신: 2026-07-18 (일 마감 — EPIC-FE-MEMBER 완료 + 백로그 3건 완료 + PRODUCT.md + Jira 전건 동기·드리프트 가드레일 + 보안 층 codify·배선 반영)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 아래 "다음 수"부터 진행한다.

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋 + **섹션 13 보안 층 구성**) 숙지.
2. `docs/board/` 스캔 — 에픽·티켓 상태(YAML `state`), `reviews/`.
3. **Jira 미러 패리티** — `state`가 todo가 아닌데 `jira_key: null`인 티켓/에픽을 스캔해 백필한다(섹션 12). 미러는 상태 전이마다 즉시 반영하며 `비차단`은 실패 허용이지 생략이 아니다. (커밋 전 `check-mirror-drift.js` 훅이 계층① 자동 경고.)
4. `git log --oneline -20` + 미push 확인(`git status`, `@{u}..HEAD`).
5. 이 파일의 "현재 상태"·"다음 수"로 진행.

## 현재 상태
- **워크플로우**: 4에이전트 오케스트레이션(architect/backend-impl/frontend-impl/reviewer) + portfolio-writer + consultant(휴면). 훅 2개 활성: `block-git-push.js`(게이트3 push 차단) · `check-mirror-drift.js`(Jira 미러 계층① warn-only). settings.json에 배선.
- **완료 에픽(전건 done·Jira 완료)**:
  - EPIC-MEMBER(회원 프로필/수정/탈퇴, KAN-2~7).
  - EPIC-CURRENCY(화폐 잔액·교환, KAN-9~13).
  - **EPIC-FE-MEMBER(프론트 내 계정 — auth+마이페이지+잔액, KAN-14~19) ✅ 완료**(오늘). FC-012 architect / FC-013·14·15 frontend-impl 단일 1패스 / FC-016 reviewer passed. spec `docs/spec/frontend-account-spec.md`, 리뷰 `docs/board/reviews/FC-016-review.md`. 하이드레이션(login→GET /me)·COMMON_005 열거방지·탈퇴 동의(Modal)·닉네임 수정(Modal) 구현.
- **완료 백로그(독립, done·Jira 완료)**:
  - FC-006(User.java unique 정리, KAN-8).
  - FC-011(교환 cashAmount @Max 상한, 오버플로 500→400, KAN-20).
  - FC-017(NotFoundPage CTA→ink, KAN-21) · FC-018(ThemeToggle no-op→기본 light+숨김, KAN-22). 리뷰 `docs/board/reviews/FC-011-017-018-review.md`.
- **디자인**: U-021 라이트 커머스 **실코드 반영 완료**(tailwind.config.js·index.css 남색 U-020→라이트값 교체, 커밋 `e9744dd`). CTA=블랙(ink #18181B)·퍼플 액센트(#6E2A9F)·순백 베이스. 디자인 게이트 닫힘. 남은 Q4(element 배지강도)는 아이템 에픽 이연. 게임자산 `docs/game_ui/`(941개). `PRODUCT.md`(루트) 생성(impeccable init — register=product·platform=web).
- **보안 층(오늘 codify·배선)**: CLAUDE.md 섹션 8~13 codify(reviewer=확인소·보안 층 비상주·커밋 보안리뷰 warn-only·게이트 아님·CI post-push·모델 opus-4-8 핀·한도 폴백). 위협모델 정본 A구조 = `.claude/claude-security-guidance.md`(압축 색인 7985B ≤8KB, 항목 ID 36개) + `docs/security/threat-model-checklist.md`(전문). 빌트인 `/security-review`=live(온디맨드·에픽완료). CI 초안 `.github/workflows/security.yml`(npm-audit·dependency-review·claude-code-security-review 액션+위협모델 주입)·`.github/dependabot.yml`. **경매 에픽부터 첫 실적용**. 상세·전이이력은 `docs/portfolio/process-log.md` 항목2.
- **Jira 미러**: KAN-1~22 **전건 완료, 드리프트 0**(2026-07-18 전수 검증). 보드 21항목(티켓18+에픽3)↔KAN-2~22 1:1. 미러는 총괄만(서브에이전트 Atlassian MCP 미접근). 규율 memory `jira-mirror-discipline`.
- **impeccable**: `.claude/skills/impeccable/`(로컬 gitignore), PostToolUse 훅(settings.local.json). DESIGN.md·PRODUCT.md 루트 시드 완료.
- **push 상태**: origin/master 마지막 push `b125456`. 미push 4건: `5c10d97`(위협모델 승격)·`a690f67`(보안 CI)·`55c2456`(process-log)·(이 핸드오버 커밋). push는 사용자 직접.

## 다음 수
1. **사용자 push** — 미push 4건(위협모델·CI·process-log·핸드오버) 원격 동기.
2. **다음 대형 에픽 착수 = 아이템/경매 백엔드**(architect 선행). 핵심 도메인 순: category·item(경매 대상 준비) → **auction·bid(경매·입찰 — 마감 폭주 동시성, 프로젝트 핵심 기술 도전)** → settlement(정산). **경매(입찰·정산)가 보안 층 첫 실적용 대상** — architect 착수 시 위협모델 체크리스트(`docs/security/threat-model-checklist.md`) 참조, reviewer는 확인소로 도메인 인가 최종판정.
3. (보안 잔여, 사용자 영역) 저장소 Secrets에 `CLAUDE_API_KEY` 추가 + PR 워크플로우 도입 시 CI claude-security-review·dependency-review 활성(현재 master 직접 커밋 = dormant). dependabot·npm-audit는 push부터 가동.
4. (선택) 로컬 Python 설치(`winget install Python.Python.3.12` + 스토어 별칭 끄기) — 보안 플러그인 로컬 정적분석을 원할 때만. 현 구성(빌트인+CI)은 불요.

## 대기 안건(백로그)
- **EPIC-CHARGE**: 충전(토스 test 결제, 외부 연동·시크릿) — 별도 에픽. erd 5절 charge.idempotency_key 표기 불일치 함께 정리.
- **EPIC-OAUTH**: 소셜 로그인(카카오·네이버) — 계약 §2 확장(신규 엔드포인트·소셜 연동·시크릿) + 프론트 연동. 프론트 자리확보됨. architect+게이트2 필요.
- **PR 워크플로우 도입 논의**(도입 시 게이트3 훅을 "브랜치 push 허용 + main 머지 차단"으로 국소 수정. 도입하면 CI claude-security-review·dependency-review 활성).
- 보안 플러그인(커밋 warn-only) 도입 — 로컬 Python 설치 시 LLM+정적 재검토(현재 보류).
- design-system.md Q4(element 배지강도) — 아이템 에픽에서 확정.
- impeccable 벤더링: 현재 로컬 gitignore. 팀 재현 원하면 `.gitignore` 2줄 제거해 커밋.
- Task#1: CLAUDE.md 섹션 2·6 문구 오케스트레이션 정합 정리.

## 핵심 결정·컨벤션(파일에 없는 맥락)
- 커밋 자동·게이트 없음 / push는 사용자 직접(훅 차단) / Done 전이 사용자 승인(게이트3).
- 게이트2 = 스키마·API계약·성능 결정(자동 진행 중에도 정지·상신). 보안 결정(스키마·계약·인가 모델)도 게이트2 수렴.
- **총괄은 코드를 직접 검증(빌드·테스트·코드리뷰)하지 않는다** — reviewer 에이전트에 위임(2026-07-17 사용자 정정).
- **보안 = 별도 역할 아닌 별도 패스**(CLAUDE.md 섹션 13). reviewer는 확인소, 자동 층은 커밋 warn-only(비차단)·온디맨드 /security-review·CI. 커밋 보안 리뷰 재프롬프트가 턴 연장 → **후속 편집 수렴 뒤 review 전이**.
- 병렬 backend 에이전트는 gradle 빌드 경합 주의 — 단독 실행 에이전트는 빌드 허용.
- **파일 이동은 git mv 금지(C-075 FUSE 인덱스 손상)** — 호스트 rm/write로.
- 통신은 대화가 아니라 파일로(전달 손상 회피) — consultant 초안은 파일로 반환·검토.
- Jira 미러·프로세스 로그 규율은 memory `jira-mirror-discipline`·`portfolio-process-log`.
