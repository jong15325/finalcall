# 프론트(F) handover (2026-07-15)

진행 중
- **스켈레톤은 완주했다**(CC 006 보고 흡수 — DoD 6항목 실측 그린). 코드 = `D:\Java\finalcall-frontend`, repo 미생성 유지(062).
- 남은 작업은 **A안 → U-020 토큰 교체 1건뿐**. 교체 표면 = `tailwind.config.js` + `src/index.css` + 컴포넌트 3파일 4곳(`LoginPage`·`SignupPage`·`NotFoundPage`의 `text-primary-500`·`bg-primary-600`).
- 디자인 회신(outbox/009 안건 1·2) 오면 → CC 토큰 교체 지시 발행(다음 번호 010) → 총괄 완료 보고 → 사용자 repo 생성 안내.

대기 중
- **outbox/009 → 디자인** (회신 필요, 유일한 블로커): 드롭인 블록 공백 2건. `focus-ring` 값 미정(그대로 넣으면 미정의 변수로 포커스 링 파손), `primary.fg` 정적값 vs 변수. 추측 금지로 멈춘 상태.
- **미발신 — 다음 세션 첫 할 일**: Glob 결함 총괄 격상(아래 참조). 사용자가 "다음 턴에 진행할지 알려달라"고 한 상태라 착수 전.

휘발성 맥락 (파일에 없는 판단·주의)
- **호스트 Glob이 거짓 0을 반환한다.** 채워진 폴더(`docs/frontend/*`, 파일 14개)에도 0건. 에러가 없어 의심 트리거가 안 걸린다. **Grep·Read는 정상.** 존재·부재·수량 판단은 **Grep으로만** 하라. D-090이 Glob을 호스트 도구로 권장하는데 그 조항이 결함이다 — 이 도구에 나와 디자인이 함께 속아 오판 3건(내 007 발행·008 오회신·디자인 017 [2] 관측)이 났다. **총괄 격상이 미발신 상태다.**
- **`outbox/007`은 VOID다. 절대 실행 금지** — 전문이 전체 scaffold 지시라 실행하면 완성된 스켈레톤을 처음부터 재생성한다. 상태줄에 경고를 박아 뒀지만 CC에게 경로를 주지 마라. 현행 유효한 CC 지시는 없다(006은 완료됨).
- **`outbox/008`은 철회됨. 내용을 근거로 삼지 마라** — 핵심 주장이 거짓이다. 정정본이 009.
- 디자인과의 판정 관계: 토큰 교체 여부는 **내 자율**(D-084 파트 내 유닛 순서). 디자인 017은 지시가 아니라 권고였고, 그 권고(완주 후 교체)가 옳았다. 판정은 교체 진행으로 유지.
- CC 보고 품질이 높다 — 계약 공백 6건을 추측으로 메우지 않고 그대로 올렸다. 그중 **로그인 stub 세션**(스켈레톤 검증 전용 임시 세션 버튼)은 auth feature 착수 시 **반드시 제거**해야 한다. 잊으면 실 API 없이 세션이 서는 구멍이 남는다.
- 계약 공백 2건은 후속 격상 후보(아직 미발신): item `element` enum wire 값 미열거(계약 [3.3]) → 현재 `element: string`으로 열어둠. 상태 enum이 [3.3] 스키마에 값 목록으로 미명시.
- persist 방침 = 메모리 세션. **wallet 도메인 착수 전** 보안 검토 필요(skeleton-plan [6]#5) — `/me/wallet/charge/confirm`이 PG 리다이렉트 복귀라 하드 리로드 시 세션 소실.
- 커밋 규칙: 사용자가 "커밋해야 하는 순간엔 무조건 커밋 내용 같이 달라"고 지시했다. 매 작업 블록 말미에 `git add docs/frontend/` + 메시지 블록을 제시할 것.

재개 필독 (순서대로)
1. `docs/frontend/inbox-log.md` — 최근 처리분(cc-reports/006 흡수·ux/017·092 D-090)부터 역순으로.
2. `docs/frontend/notes/cc-reports/006-skeleton-scaffold.md` — 스켈레톤 실제 산출물·공백 6건.
3. `docs/frontend/outbox/009-디자인-008정정-조건3충족-토큰공백질의.md` — 대기 중인 블로커.
4. `docs/frontend/decision-log.md` — F-001(폴링)·F-002(구성).
5. `docs/frontend-planning/skeleton-plan.md` v0.2 · `docs/api-contract.md` v1.4 — 기준선·계약 정본.
6. `docs/frontend/notes/claude-code-kickoff.md` — CC 재기동 시(작업 번호 교체해 재사용. 현재 007을 가리키므로 **VOID 반영 필요**).
