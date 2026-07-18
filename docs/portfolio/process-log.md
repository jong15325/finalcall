# 도시에: 프로세스 로그 (개선·트러블슈팅·열린 논의)

> 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지) 재가공용 **중간 산출물**이다. 정본이 아니라
> CLAUDE.md·보드·훅·대화에서 큐레이션한 파생 요약이다. 모든 주장은 증거(파일·커밋·섹션)로 뒷받침한다 —
> 과장·미구현을 구현으로 쓰지 않는다.
>
> **성격**: 이 문서는 완결된 기능 케이스 스터디가 아니라 **"프로세스가 어떻게 진화했는가"의 누적 로그**다.
> 각 항목은 상태(해결됨 | OPEN·미결)를 명시하며, **덮어쓰지 않고 축적**한다. "어떤 문제가 있었고,
> 어떻게 개선됐고, 무엇이 아직 논의 중인가"를 남겨 추후 참조·재개를 돕는다.
> 완료된 오케스트레이션 체계 전반은 [orchestration.md](orchestration.md)를 참조한다.

- **영역**: AI 협업 개발 프로세스 — 운영 중 발견된 이슈와 개선, 진행 중 논의
- **관련 산출물**: CLAUDE.md 섹션 8~13, `.claude/hooks/`, `docs/board/HANDOVER.md`, 세션 대화

---

## 항목 1 — Jira 미러 드리프트 사건 → 규율화 · 상태: 해결됨 (2026-07-17~18)

### 증상
사용자 대시보드인 Jira(KAN 프로젝트, 파일 보드의 단방향 읽기 미러)와 정본인 파일 티켓 보드가 **조용히
갈라져** 있었다. 두 갈래로 드러났다:
- **미생성(계층①)**: EPIC-FE-MEMBER(FC-012~016)가 Jira에 **아예 미러되지 않음** — 에픽·티켓 전건 누락.
- **상태 전이 미러 누락(계층②)**: EPIC-CURRENCY는 보드에서 done인데 Jira는 FC-008=검토중,
  FC-009/010=해야할일에 멈춰 있었다.

사용자가 "FC-009/010이 왜 아직 todo(해야할일)냐"고 물으며 **수동으로 발견**한 것이 계기였다("이력관리는
중요하다"는 검토 지시). 자동 탐지 계기가 없어 사람 눈에 걸릴 때까지 생존했다.

### 근본원인 (4겹)
1. **미러 누락**: 에픽 생성·상태 전이 시점에 미러 반영을 빠뜨림(일부는 이전 세션).
2. **`비차단`의 오독**: CLAUDE.md 섹션 12의 "비차단"을 "생략 가능"으로 해석해 인수 세션이 의도적으로 연기.
3. **가드레일 부재**: `git push`는 훅(`block-git-push.js`)이 막지만, **미러엔 검사 계기가 전혀 없어** 드리프트가
   조용히 생존. `state != todo`인데 `jira_key: null`이 유일한 신호였는데 아무도 보지 않음.
4. **인수(핸드오버) 시 확인 계기 부재**: HANDOVER "이어받는 법"에 미러 패리티 확인 단계가 없어, 세션 교체가
   백필 계기가 되지 못함.

### 조치 (개선)
- **(a) 전건 백필**: EPIC-FE-MEMBER=KAN-14 · FC-012~016=KAN-15~19를 상태·Epic Link·Blocks 링크·라벨까지
  소급 반영하고 `jira_key`를 보드에 기록(불변). 화폐 에픽(KAN-9~13) 상태도 정합화.
- **(b) HANDOVER 하드닝**: "이어받는 법"에 **"`state`가 todo가 아닌데 `jira_key: null`인 티켓/에픽을 스캔해
  백필한다"는 미러 패리티 확인 단계**(계층② 수동 대조)를 신설(`HANDOVER.md` line 10).
- **(c) 커밋 전 warn-only 훅 도입**: `.claude/hooks/check-mirror-drift.js`를 `git commit` 직전에 실행하도록
  `settings.json`에 배선. **계층①(=`state≠todo`인데 `jira_key` 빈 값)을 파일만으로 자동 탐지**해 경고한다.
  설계상 **항상 exit 0(warn-only, 커밋 비차단)**이며, 파싱·스캔 실패 시 무반응(fail-open) — 미러 규율을
  상기시키되 개발 흐름은 막지 않는다. `git commit` 매칭은 커밋 메시지 내 "commit" 문자열 오탐을 피하도록
  하위명령이 commit일 때만 정규식으로 매칭(`block-git-push.js`와 동일 패턴). 계층②(보드 done인데 Jira
  미완료)는 Jira 읽기가 필요해 훅이 못 잡으므로 **총괄이 HANDOVER 패리티 단계에서 수동 대조**하도록 역할 분리.
- **(d) CLAUDE.md 섹션 12 명문화**: "**비차단은 미러 실패 시 파일 작업을 멈추지 않는다는 뜻이며 — 실패
  허용이지 생략 허용이 아니다**"를 못박고, 드리프트 가드레일 조항(계층①·자동 / 계층②·수동)을 신설.

### 증거
- `CLAUDE.md` 섹션 12 line 379(비차단 재정의)·line 382(드리프트 가드레일 계층①·②)
- `.claude/hooks/check-mirror-drift.js` — warn-only·fail-open·계층① 자동 탐지
- `.claude/settings.json` — PreToolUse(Bash)에 `block-git-push.js` + `check-mirror-drift.js` 2단 배선
- `docs/board/HANDOVER.md` line 10(미러 패리티 단계)·line 34(백필 완료 기록)
- 커밋 `2b2527a` chore(board): Jira 미러 드리프트 가드레일 도입 (계층① 커밋 전 훅) — 훅+settings+CLAUDE 3파일
- 커밋 `41a6598` chore(board): EPIC-FE-MEMBER 리뷰 passed·Jira 미러·HANDOVER 하드닝

### 교훈
**"실패를 규율로."** 자동 탐지 없는 수작업 규율은 조용히 갈라진다 — 사람의 성실성에 기대는 대신
탐지 계기(훅)와 확인 계기(핸드오버 단계)를 프로세스에 심어야 드리프트가 봉쇄된다. push는 훅으로
막혀 안전했지만 미러는 계기가 없어 방치됐다는 비대칭이 근본원인이었다.

---

## 항목 2 — 보안 층 도입 논의 → 확정·codify·배선 · 상태: 해결 (2026-07-18, 잔여는 사용자 영역)

> **상태 전이 이력**: OPEN(미결·사용자 결정 대기) → **해결**(사용자 5개 판단 확정 → CLAUDE.md 섹션
> 8~13 codify → 위협모델 정본 승격 → CI 초안 배선). 아래는 최초 OPEN 시점의 논의를 보존한 뒤(맥락),
> 무엇이 어떻게 확정·반영됐는지 전이 결과를 이어 기록한다. 단, **완전 종결은 아니다** — 저장소
> Secrets·PR 워크플로우 등 **사용자 영역 잔여**가 남아 있으며 아래 "잔여"에 정확히 명시한다.

### 배경 · 제안 (사용자, OPEN 시점 원안 — 보존)
상주 5번째 "보안 에이전트"를 두지 **않는다**(과거 코드 감사 과중을 재유발하므로). 대신 보안을 별도
**"역할"이 아니라 별도 "패스(pass)"**로 여러 층에 얹는다. 근거:
- Anthropic 설계는 보안을 범용 리뷰에 섞지 않고 **신선 컨텍스트 + 보안 전용 프롬프트의 별도 패스**로
  돌린다(자기 채점 편향 회피).
- LLM 보안 리뷰는 완결이 아니라 **defense-in-depth의 한 층**으로 다룬다.

### 제안 파이프라인 (OPEN 시점 원안 — 보존)
기존 골격(architect → backend-impl ∥ frontend-impl → reviewer → Done)은 유지하고 **보안 층만 추가**:
- 구현 중 security-guidance 플러그인 훅 자동 발동
- reviewer를 보안 "확인소"로 재정의(인가·`/me` IDOR·세션 폐기 최종판정)
- 에픽 완료 직전 온디맨드 보안 브랜치 패스(신선 컨텍스트)
- push 시 원격 CI 정적분석 + 의존성 스캔
- 공통 위협모델 체크리스트 문서

### 사용자 확정 (전이 결과) — 5개 판단 채택 (3번만 메커니즘 교정)
OPEN 시점의 "총괄 예비 판단 5건"을 사용자가 검토해 **방향 전건 채택**했다. 다만 **3번(토큰 비용)은
메커니즘을 교정**했다 — 위협 표면 "경로 게이팅" 대신 **상시 구성으로 단순화**:
1. **consultant 소환 → 채택**: 섹션 8·9·10·13 다중 섹션 개정이라 방향 확정 후 **codify 용도로만** 반영.
2. **규약 충돌 3건 → 채택**: (a) 커밋 보안 리뷰 warn-only(섹션 13·10) (b) 원격 CI post-push(섹션 13)
   (c) 모델 opus-4-8 핀(섹션 13·CI).
3. **토큰 비용 → 채택하되 메커니즘 교정**: 경로 게이팅(위협 표면 패턴 매칭 발동) 대신 **상시 구성**으로 —
   end-of-turn 리뷰 **기본 off**(`ENABLE_STOP_REVIEW=0`, 최고위험 구간만 한시 on), 커밋 보안 리뷰
   **warn-only 상시**, 온디맨드 `/security-review` **에픽 완료 시 상시 1회**. 한도 폴백 명문화(자동층 off,
   온디맨드 유지).
4. **Windows 제약 → 채택**: 정적도구 의존이 크면 원격 CI(리눅스)로 이관해 이중화. 헤드리스 스모크 전제.
5. **도입 시점 → 채택**: 경매(입찰·정산) 에픽부터 첫 적용, member/account 소급 안 함.

### codify (CLAUDE.md 섹션 8~13 반영 — 커밋 `b125456`)
- **섹션 8**: reviewer를 **확인소**로 재정의(보안 첫 검문소 아님, 도메인 인가 최종 판정) + "보안 층은
  상주 에이전트 아님"(별도 도구 층으로 구현) 불릿(line 296·303).
- **섹션 9**: 보안 층 5요소 불릿 — 커밋 warn-only·reviewer 확인소·온디맨드 `/security-review`·post-push
  CI·공통 위협모델 체크리스트, 경매 에픽부터·member 소급 안 함(line 324).
- **섹션 10**: "보안 리뷰는 게이트 아님" — 커밋 게이트 신설 안 함, 보안 결정은 게이트2로 수렴(line 335).
- **섹션 13**: "보안 층 구성" 소절 — warn-only·end-of-turn 기본 off·post-push CI·모델 opus-4-8 핀·한도
  폴백·Windows 스모크 전제·재프롬프트↔review 타이밍 주의(line 393~402).
- 섹션 11·12 무변경.

### 위협모델 정본 승격 (A 구조: 색인 + 상세 — 커밋 `5c10d97`)
- **압축 색인** `.claude/claude-security-guidance.md`: 플러그인 8KB 캡을 지키려 8416B→**7985B 트림**
  (≤8000·8192 통과), **항목 ID 36개 보존**. 플러그인 자동 리뷰·reviewer가 공유 참조.
- **전문 정본** `docs/security/threat-model-checklist.md`(25744B): draft 전문 + 보강 1~3(로깅 위생 LOG·
  레이트리밋 경계 RL·마이너). 기존 STRIDE 원장(`threat-model.md`) 인용 보존. draft는 호스트 rm으로
  삭제(git mv 회피, C-075).

### 배선 (CI 초안 — 커밋 `a690f67`)
- **빌트인 `/security-review`** = **live**(온디맨드·에픽 완료 층). 지금 가동.
- `.github/workflows/security.yml`: npm-audit(프론트, push+PR, 리포트 전용 continue-on-error) +
  dependency-review(PR, gradle·npm, GitHub 네이티브·시크릿 불요) + claude-security-review(PR, Anthropic
  액션에 우리 위협모델 `docs/security/threat-model-checklist.md` 주입, `claude-model: claude-opus-4-8` 핀).
- `.github/dependabot.yml`: gradle·npm·github-actions 주간 의존성 감시.

### 트러블슈팅 노트 (신규) — Windows 로컬 Python 부재 → 정적분석 원격 이관
- **증상**: 로컬 Windows의 `python`이 **WindowsApps 스토어 스텁**이라 실행이 무효였다 → 플러그인이 부르는
  정적도구(Python 의존)가 로컬에서 작동하지 않음을 확인.
- **조치**: 계획 item 4대로 **정적분석을 원격 CI(리눅스 러너)로 이관**해 흡수(`security.yml`이 ubuntu-latest).
  로컬은 LLM 패스(`/security-review`), 원격은 정적분석·의존성 스캔으로 이중화. 커밋 warn-only 플러그인은
  로컬 정적도구 부재로 **LLM-only 한계**가 있어 **보류**(필요 시 추후 추가).

### 잔여 (사용자 영역 — 전부 해결 아님)
- 저장소 **Secrets에 `CLAUDE_API_KEY` 추가** 전까지 `claude-security-review` 잡은 dormant.
- 현재 **master 직접 커밋**이라 PR 트리거 잡(dependency-review·claude-security-review)은 미발동 —
  **PR 워크플로우 도입은 백로그**. 도입 시 활성.
- npm-audit·dependabot은 시크릿 불요라 push부터 가동(잔여 아님).
- **보안 플러그인(커밋 warn-only) 도입**은 추후 선택(로컬 Python 부재로 보류 중).

### 증거 · 근거
- codify: CLAUDE.md 섹션 8(line 296·303)·섹션 9(line 324)·섹션 10(line 335)·섹션 13(line 393~402) —
  커밋 `b125456`.
- 위협모델: `.claude/claude-security-guidance.md`(7985B, ID 36개)·`docs/security/threat-model-checklist.md`
  (25744B) — 커밋 `5c10d97`.
- 배선: `.github/workflows/security.yml`·`.github/dependabot.yml` — 커밋 `a690f67`.
- 선례: 항목 1의 warn-only·fail-open 훅(`check-mirror-drift.js`)이 "커밋 비차단 리뷰"의 설계 패턴 선례.

### 교훈
**"보안은 역할이 아니라 층."** 상주 감사자를 늘리는 대신 신선 컨텍스트의 별도 패스를 여러 지점(커밋 warn-only
·reviewer 확인소·에픽 완료 온디맨드·post-push CI)에 얇게 얹어 defense-in-depth를 구성했다. 로컬 플랫폼
제약(Windows Python 부재)은 정적분석을 원격 CI로 이관해 우회 — **환경 한계를 층 재배치로 흡수**한 사례.

---

## 항목 3 — 게임 데이터 통합(정규화 vs 라이브 인게임 DB) 설계 논의 · 상태: OPEN(미결)

> **성격**: 향후 "게임 차용(프로필·인벤토리 UI) + 게임데이터 통합" 에픽(가칭 EPIC-GAME-PROFILE)의
> **선결 설계 결정**이다. 지금 착수 대상이 아니며, 해당 에픽 스코핑 시 architect + 게이트2로 확정한다.
> 아래는 논의 맥락과 열린 쟁점을 보존한다(미결).

### 배경
- 원게임(SP) DB 백업 `new_sp-211025.sql`(2MB·42테이블·`user` 2,440행 등)을 로컬 MySQL(`finalcall-mysql`
  컨테이너)에 **별도 데이터베이스 `new_sp`**로 임포트했다(유저 `sp/sp`, finalcall과 격리). 2026-07-18.
- 용도: (1) D-067 "원게임 실데이터"의 소스(gameshop 492건 아이템 정의·user_item·user_equipments 등),
  (2) 프로필/인벤토리 UI 차용(`docs/game_ui/게임 차용 디자인 및 erd.txt`) 시 값 매핑 원천.
- 게임 `user` 컬럼(usr_char·level·type·points·code=머니·conis=코인·cash=캐시·water/fier/earth/wind=정령카드
  ·inventory=슬롯수 max96·wins/losses/ko/down/mission=전적)을 finalcall 계정·프로필에 어떻게 반영할지가 쟁점.

### 열린 쟁점 (미결)
1. **정규화 vs 비정규화**: 게임 데이터를 finalcall `user`에 직접 넣지 말고 **별도 `game_profile`(1:1) 정규화**가
   총괄 1차 권고(계정↔잔액 분리 유지, 경매 플랫폼은 게임 본체 아님). 단 아래 2·3 제약으로 재검토 필요.
2. **★ new_sp가 라이브 인게임 DB로도 쓰일 예정**(사용자, 2026-07-18): 정적 임포트 소스가 아니라 **게임이
   계속 write하는 살아있는 DB**다. → finalcall이 데이터를 복사/정규화하면 **단일 진실원 이원화**(게임이
   new_sp.user 갱신 ↔ finalcall 사본 staleness/동기화), **화폐 소유권**(게임머니가 양쪽에?) 문제가 생긴다.
3. **크로스 DB 조인 문제**: 추후 인게임에서 finalcall 데이터와 join 등으로 발생할 수 있는 문제를 사전 검토해야
   함. finalcall DB ↔ new_sp DB 경계(같은 인스턴스 내 별도 스키마) 간 조인·트랜잭션·FK 불가 제약.
4. **업계 레퍼런스로 합의 필요**: 현재 업계에서 쓰는 설계 레퍼런스(게임 플랫폼/컴패니언 서비스의 공유 DB vs
   API 연동, CDC/복제, read-replica, 소유 경계 등)를 찾아 **합의점**을 도출해야 함. 미조사.

### 조사 결과 (병렬 리서치, 2026-07-18 — general-purpose, 출처 35건)
> EPIC-AUCTION architect와 병렬로 업계 레퍼런스를 조사(WebSearch/WebFetch). 결정 아님, 합의 근거.

**패턴별 트레이드오프**(write 소유권이 게임에 있다는 제약 하): 공유DB 양방향 write=최악(Fowler "integration
database") / 공유DB read-only=강경론 반대·절충론은 ACL 전제 조건부 / read replica=조회 OK·write 판단엔 stale
위험 / API 동기 연동=경계 깨끗하나 게임팀 API 필요·가용성 결합 / CDC(Debezium)=게임 앱 무변경·eventual /
Outbox+CDC=결합 최저·게임 코드 변경 필요. **핵심: 결합 낮을수록 게임팀 협조 비용↑, 협조 불요일수록 게임 스키마 결합↑**(정반대).

**변하지 않는 원칙 4**: (1) new_sp write 소유권은 게임(single writer), 마켓은 참조만. (2) 잔액·에스크로·정산=마켓
소유(감사 원장), 게임 내 화폐·아이템 상태=게임 소유(Steam·AWS 지갑 모델). (3) 크로스DB 조인 회피=로컬 reference
복제/API composition/CQRS 뷰. (4) 낙찰 후 게임 아이템 이전은 마켓이 new_sp 직접 write 금지 → 게임 API/이벤트 위임.

**후보 3안**: A) read-only 참조 + 로컬 reference 복제(경량·협조 최소·복제지연/스키마결합 단점). B) CDC(Debezium)
→이벤트→마켓 로컬 뷰(표준·확장·Kafka 운영부담). C) 게임이 데이터/지갑 API 제공(경계 최상·협조 최대·raw DB엔 API 없음).
**현실적 절충**: 조회=A/B(eventual OK), 거래 확정·아이템 이전 write만=C(게임 API, 강정합) — "읽기는 복제, 쓰기는 소유자 위임".

**합의 시 분기점**: (i) 같은 MySQL 인스턴스 read-only 조회 허용 여부(강경 vs 절충), (ii) eventual consistency 수용
범위와 강정합 요구 지점(경매 확정·이중판매 방지). 전문·인용 = 스크래치패드 `game-integration-research.md`(휘발성).

### 다음 (해당 에픽 착수 시)
- 위 조사 기반 **사용자+총괄 합의**(옵션 A/B/C·read-only 쟁점) → architect가 (c) 화폐·소유권 경계 확정 →
  (d) 조인/동기화 리스크 완화안을 게이트2로 상신.
- UI 차용 상세 설계·이미지·값 매핑은 그 뒤(노트가 "추후"로 명시).

### 증거
- 임포트: `new_sp` DB(docker `finalcall-mysql`), 세션 대화(2026-07-18).
- 차용 노트: `docs/game_ui/게임 차용 디자인 및 erd.txt`.
- 관련: EPIC-ITEM(item_template.element 축 ↔ 정령카드, item_instance.goldforce ↔ 차용 UI 골드포스 테두리).

### 교훈 (잠정)
**"살아있는 외부 DB는 복사 대상이 아니라 경계 설계 대상."** 임포트가 쉬웠다고 통합이 쉬운 건 아니다 —
데이터의 write 소유권이 외부(게임)에 있으면 정규화 복제는 동기화 부채를 낳는다. 결정 전 업계 패턴 조사가 선행.

---

_최초 작성: 2026-07-18 (portfolio-writer, 프로세스 로그 신설 — 항목 1 해결됨 · 항목 2 OPEN)_
_갱신: 2026-07-18 (portfolio-writer, 항목 2 OPEN → 해결 전이 — 확정·codify `b125456`·정본 `5c10d97`·배선 `a690f67`, 사용자 영역 잔여 명시)_
_갱신: 2026-07-18 (총괄, 항목 3 신설 — 게임 데이터 통합 설계 논의 OPEN, new_sp 라이브 인게임 DB 제약·업계 레퍼런스 합의 필요)_
