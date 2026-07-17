# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: 에픽 완료마다 + 세션이 무거워질 때(덮어씀, 이력은 git).
갱신: 2026-07-17 (EPIC-FE-MEMBER 착수 + 디자인 커머스 개정 + impeccable 도입 반영)

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
  - **EPIC-FE-MEMBER(프론트 내 계정, 게이트1 승인 안 A) — 진행 중**: auth+마이페이지+잔액 표시.
    - FC-012 ✅ done — architect. spec `docs/spec/frontend-account-spec.md`. 계약 사본 폐기(단일정본), **login은 GET /me 하이드레이션**(응답에 user 없음), 잔액=마이페이지 카드. 팬아웃 판정=**단일 frontend-impl 1패스**(공유파일 교차).
    - FC-013/014/015 ⏭ todo(frontend-impl) — auth·마이페이지·잔액. **디자인 게이트 대기**.
    - FC-016 ⏭ todo(reviewer) — 통합 리뷰.
    - 스켈레톤 성숙: lib/api/client(401 회전)·authStore·레이아웃4종·feedback 재사용. login/signup은 stub 세션 → 실 API 대체.
- **독립 완료**: FC-006(User.java unique=true 정리, KAN-8).
- **백로그 신규**: FC-011(todo, 에픽 미귀속) — 교환 cashAmount 상한 위생(FC-010 minor 1 파생, 오버플로 500→검증 400/422).
- **디자인(중대 정정 2026-07-17)**: 구 `design-system.md` U-020(남색 게임스킨 전면)은 **오류** — 사용자 정정으로 **무신사(미니멀 에디토리얼)+마켓컬리(화이트+딥퍼플) 참조 라이트 커머스**로 개정. 게임색(element)은 **아이템 표시 전용 부분차용**. 개정 제안·목업: `docs/ux/redesign-commerce-proposal.md`·`mockups/redesign-commerce.html`(커밋 `de06c4e`, 아티팩트 게시됨). **미확정 4개 질문**: CTA 퍼플vs블랙·퍼플톤·베이스(#FAFAFA vs #FFFFFF)·element 배지강도. 확정 시 `design-system.md`+`DESIGN.md` 갱신. 참조는 감각만·자산/hex 복제 금지(고유 퍼플 #6E2A9F).
- **impeccable 도입**: 디자인 스킬 impeccable 설치(frontend-design 상위집합, 택일). `.claude/skills/impeccable/`(로컬·gitignore), PostToolUse 훅=UI편집 후 안티패턴 탐지(settings.local.json). **`DESIGN.md`(루트) 개정 팔레트로 시드 완료·파서 검증**(커밋 `08c7458`). **PRODUCT.md 미생성** — `/impeccable init` 인터뷰로 사용자가 생성(전략·브랜드). **주의: `/impeccable` 슬래시명령은 세션 재시작 후 등록**(중간 설치라 현 세션 미인식).
- **대기 게이트**: 디자인 게이트(FC-013/014/015 새 화면 — 로그인·가입·마이페이지). 사용자 4개 질문 확정 필요.
- **push 상태**: origin 마지막 push `4239e38`. 이후 로컬 커밋 다수 미push(`cba14bb`~`08c7458`: 보드·portfolio·FE보드·spec·디자인개정·DESIGN.md). push는 사용자 직접.

## 다음 수
1. **(재시작 후) `/impeccable init`** — PRODUCT.md 생성(DESIGN.md는 이미 시드됨 → PRODUCT.md만 물음). 재시작 사유: impeccable 슬래시명령 등록.
2. **디자인 4개 질문 확정**(아티팩트 목업 리뷰) → 나: `design-system.md`+`DESIGN.md` 확정 갱신.
3. **frontend-impl 착수**(FC-013/14/15 단일 1패스) — impeccable `audit`/`polish` 자기검증 활용 → FC-016 reviewer → 게이트3.
4. (백로그) FC-011 위생, EPIC-CHARGE.

## 대기 안건(백로그)
- FC-011: 교환 cashAmount 상한 위생(FC-010 minor 1). 독립 백로그.
- Task#1: CLAUDE.md 섹션 2·6 문구 오케스트레이션 정합 정리.
- EPIC-CHARGE: 충전(토스 test 결제, 외부 연동·시크릿) — 별도 에픽.
- 디자인 정본 갱신: 4개 질문 확정 후 `design-system.md`를 U-021(라이트 커머스)로 개정(현재는 제안 단계, 목업·DESIGN.md만 반영).
- impeccable 벤더링 판단: 현재 로컬 gitignore. 팀 재현 원하면 `.gitignore`의 impeccable 2줄 제거해 커밋.
- PR 워크플로우 도입 논의(도입 시 게이트3 훅을 "브랜치 push 허용 + main 머지 차단"으로 국소 수정).
- erd 5절 charge.idempotency_key 표기 불일치(기존 사안) — EPIC-CHARGE에서 정리.

## 핵심 결정·컨벤션(파일에 없는 맥락)
- 커밋 자동·게이트 없음 / push는 사용자 직접(훅 차단) / Done 전이 사용자 승인.
- 게이트2 = 스키마·API계약·성능 결정(자동 진행 중에도 정지·상신).
- **총괄은 코드를 직접 검증(빌드·테스트·코드리뷰)하지 않는다** — 검증·리뷰는 reviewer 에이전트에 위임(2026-07-17 사용자 정정). 과거 "메인세션 일괄 검증" 문구 폐기.
- 병렬 backend 에이전트는 gradle 빌드 경합 주의 — 단독 실행 에이전트는 빌드 허용, reviewer가 최종 재확인.
- 서브에이전트는 general-purpose에 역할 주입(네이티브 커스텀 타입은 세션 재시작 후 등록).
