# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 에픽 완료마다 + 세션이 무거워질 때(덮어씀, 이력은 git).
갱신: 2026-07-17 (EPIC-CURRENCY done·미push 반영)

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋) 숙지.
2. `docs/board/` 스캔 — 에픽·티켓 상태(YAML `state`), `reviews/`.
3. `git log --oneline -20` + 미push 확인(`git status`, `@{u}..HEAD`).
4. 이 파일의 "현재 상태"·"다음 수"로 진행.

## 현재 상태
- **워크플로우**: 4에이전트 오케스트레이션(architect/backend-impl/frontend-impl/reviewer) + portfolio-writer(**등록 완료**, CLAUDE.md 섹션 8·9) + consultant(휴면). 게이트3 push 차단 훅 활성(`.claude/hooks/block-git-push.js`).
- **완료 에픽**:
  - EPIC-MEMBER(회원 프로필/수정/탈퇴, KAN-2~7) — **원격 push됨**(마지막 push `1fac4cc`).
  - EPIC-CURRENCY(화폐 잔액·교환, KAN-9~13) — **done(게이트3) · 원격 push됨**(`4239e38`):
    - FC-007 ✅ done — 교환비율=`@ConfigurationProperties`(1캐시=1,000,000), money_exchange 멱등 게이트2 승인 → erd v0.8.
    - FC-008 ✅ done — UserBalance 원자 증감 5연산(`91e1138`). review_status=passed는 FC-010 통합 리뷰서 부여(80스레드 경합 실증).
    - FC-009 ✅ done — 교환(money_exchange+V5+POST /exchanges+EXC_001/002, 커밋 `eb48b96`). 멱등: ExchangeService(오케스트레이터)+ExchangeWriter(원자 쓰기 빈) 분리, 복합 UK로 동시경쟁 승자 재조회.
    - FC-010 ✅ done — 화폐 통합 리뷰 passed(critical/major 0, minor 3). `docs/board/reviews/FC-010-review.md`.
- **독립 완료**: FC-006(User.java unique=true 정리, KAN-8).
- **백로그 신규**: FC-011(todo, 에픽 미귀속) — 교환 cashAmount 상한 위생(FC-010 minor 1 파생, 오버플로 500→검증 400/422).
- **대기 게이트**: 없음.
- **push 상태**: `master` origin과 동기(마지막 push `4239e38`). 이 보드 동기 커밋만 미push 가능성(다음 push에 포함).

## 다음 수
1. 다음 에픽 착수 판단 — 후보: EPIC-CHARGE(충전, 외부 연동·시크릿) 또는 프론트 member 에픽(백엔드 계약 확정됨). 게이트1 분해안 상신.
2. (백로그) FC-011 위생 티켓 — 여유 시 backend-impl 위임.

## 대기 안건(백로그)
- FC-011: 교환 cashAmount 상한 위생(FC-010 minor 1). 독립 백로그.
- Task#1: CLAUDE.md 섹션 2·6 문구 오케스트레이션 정합 정리.
- EPIC-CHARGE: 충전(토스 test 결제, 외부 연동·시크릿) — 별도 에픽.
- 프론트 member 에픽 — 백엔드 계약 확정됨.
- PR 워크플로우 도입 논의(도입 시 게이트3 훅을 "브랜치 push 허용 + main 머지 차단"으로 국소 수정).
- erd 5절 charge.idempotency_key 표기 불일치(기존 사안) — EPIC-CHARGE에서 정리.

## 핵심 결정·컨벤션(파일에 없는 맥락)
- 커밋 자동·게이트 없음 / push는 사용자 직접(훅 차단) / Done 전이 사용자 승인.
- 게이트2 = 스키마·API계약·성능 결정(자동 진행 중에도 정지·상신).
- **총괄은 코드를 직접 검증(빌드·테스트·코드리뷰)하지 않는다** — 검증·리뷰는 reviewer 에이전트에 위임(2026-07-17 사용자 정정). 과거 "메인세션 일괄 검증" 문구 폐기.
- 병렬 backend 에이전트는 gradle 빌드 경합 주의 — 단독 실행 에이전트는 빌드 허용, reviewer가 최종 재확인.
- 서브에이전트는 general-purpose에 역할 주입(네이티브 커스텀 타입은 세션 재시작 후 등록).
