# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 에픽 완료마다 + 세션이 무거워질 때(덮어씀, 이력은 git).
갱신: 2026-07-17

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13(오케스트레이션·게이트·티켓·Jira·커밋) 숙지.
2. `docs/board/` 스캔 — 에픽·티켓 상태(YAML `state`), `reviews/`.
3. `git log --oneline -20` + 미push 확인(`git status`, `@{u}..HEAD`).
4. 이 파일의 "현재 상태"·"다음 수"로 진행.

## 현재 상태
- **워크플로우**: 4에이전트 오케스트레이션(architect/backend-impl/frontend-impl/reviewer) + portfolio-writer(신규, 도입 중) + consultant(휴면). 게이트3 push 차단 훅 활성(`.claude/hooks/block-git-push.js`).
- **완료 에픽**: EPIC-MEMBER(회원 프로필/수정/탈퇴, KAN-2~7) — **원격 push됨**(마지막 push `1fac4cc`).
- **진행 에픽**: EPIC-CURRENCY(화폐 잔액·교환, KAN-9~13):
  - FC-007 ✅ done — 교환비율=`@ConfigurationProperties`(1캐시=1,000,000 게임머니), money_exchange 멱등 게이트2 승인 → **erd v0.8** 반영(idempotency_key + (user_id,idempotency_key) UK).
  - FC-008 ✅ review — UserBalance 원자적 증감 5연산(커밋 `91e1138`). 메인세션 검증서 `@Transactional` 누락 발견·수정.
  - FC-009 ⏭ todo — 교환(money_exchange 엔티티 + V5 마이그레이션 + POST /exchanges + EXC_001/002). **erd 반영됨·의존 FC-008 충족 → 착수 가능**.
  - FC-010 ⏭ todo — 화폐 통합 리뷰.
- **독립 완료**: FC-006(User.java unique=true 정리, KAN-8).
- **미완 설정**: portfolio-writer — `.claude/agents/portfolio-writer.md` **커밋됨(c367906)**. 남은 것: 도시에 템플릿(`docs/portfolio/_TEMPLATE.md`) + CLAUDE.md 섹션 8 표·9 파이프라인 등록 + 소급 도시에 생성(스켈레톤+오케스트레이션+member, 한국어, 넓게).
- **대기 게이트**: 없음(FC-009 착수 가능).
- **미push**: EPIC-CURRENCY + FC-006 + portfolio 에이전트 등 다수 로컬 커밋. push는 사용자 직접.

## 다음 수
1. FC-009(교환) 착수 — backend-impl 위임(money_exchange+V5+POST /exchanges, FC-008 원자 메서드·erd v0.8 사용).
2. FC-010 리뷰 → EPIC-CURRENCY 게이트3(push+Done) 상신.
3. portfolio-writer 마무리(템플릿·등록·소급 도시에).

## 대기 안건(백로그)
- Task#1: CLAUDE.md 섹션 2·6 문구 오케스트레이션 정합 정리.
- EPIC-CHARGE: 충전(토스 test 결제, 외부 연동·시크릿) — 별도 에픽.
- 프론트 member 에픽 — 백엔드 계약 확정됨.
- PR 워크플로우 도입 논의(도입 시 게이트3 훅을 "브랜치 push 허용 + main 머지 차단"으로 국소 수정).
- erd 5절 charge.idempotency_key 표기 불일치(기존 사안) — EPIC-CHARGE에서 정리.

## 핵심 결정·컨벤션(파일에 없는 맥락)
- 커밋 자동·게이트 없음 / push는 사용자 직접(훅 차단) / Done 전이 사용자 승인.
- 게이트2 = 스키마·API계약·성능 결정(자동 진행 중에도 정지·상신).
- 병렬 backend 에이전트는 gradle 빌드 금지(경합) → 메인세션 일괄 검증.
- 서브에이전트는 general-purpose에 역할 주입(네이티브 커스텀 타입은 세션 재시작 후 등록).
