# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-29** (EPIC-MARKET-QUICKBUY 마켓 즉시구매 카드정보 — **구현·리뷰·커밋·Done·Jira 미러 전건 완료**. 남은 것 = **사용자 push**뿐.)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: 전 세션에서 "커밋 대기"로 마감했던 EPIC-MARKET-QUICKBUY를 이번 세션에서 마무리했다 — 사용자 승인 후 **C1~C4 4개 atomic 커밋 실행**(`d088645`·`f74c20f`·`25d3652`·`f1aa276`), FC-146/149/150 **Done 전이**(+FC-145/147/148 기완료), **에픽 done 롤업**, **Jira KAN-163/165/166/167 완료 미러**까지 완료. **다음 수 = 사용자 push**(에이전트 불가) + 백엔드 재기동해 "거래 N회" 실값 확인.

---

## 지금 어디인가 — 한 문단

**EPIC-MARKET-QUICKBUY(FC-145~150) 전건 완료 — 커밋·Done·Jira 미러까지 끝났고 로컬만 앞서 있다.** 마켓 아이템 카드 클릭 → 카드정보 스타일 구매 모달로 목록에서 즉시 구매 + 판매자 완료 판매 건수("거래 N회") 표시. 로컬 `master`는 origin(`3ef53eb`)보다 **5커밋 앞섬**(C1~C4 + HANDOVER 갱신). **다음 수 = 사용자가 `git push`**(게이트3, 에이전트 차단). push 후 백엔드 재기동해 실값 확인.

---

## A. 완료 — EPIC-MARKET-QUICKBUY (KAN-162~167)

### 티켓 상태 (전건 done · Jira 완료 미러)
| 티켓 | Jira | 내용 | 상태 |
|---|---|---|---|
| FC-145 | KAN-162 | 카드정보 UI 차용 초기 목업(디자인 게이트) | done |
| FC-146 | KAN-163 | 카드정보 구매 모달 실구현(변형 A·다회 리디자인) | done |
| FC-147 | KAN-164 | 전체 디자인 변형 4종 목업(A 선택) | done |
| FC-148 | KAN-165 | 거래 횟수 계약 확정(게이트2 승인 ⓐ) | done |
| FC-149 | KAN-166 | 거래 횟수 백엔드 집계(sellerCompletedSales) | done |
| FC-150 | KAN-167 | 거래 횟수 프론트 표시(카드정보 판매자 영역) | done |

에픽 `EPIC-MARKET-QUICKBUY` = **done**(롤업). 에픽 자체는 Jira `jira_key: null`(에픽 Jira 미생성 — 티켓만 미러됨, 잔여 드리프트지만 무해).

### 커밋 (로컬, origin 미포함 — push 대기)
- **C1 `d088645`** `feat(shop): 판매자 완료 판매 건수 sellerCompletedSales 집계·응답 (FC-149)` — 백엔드 9파일
- **C2 `f74c20f`** `feat(shop): 마켓 카드정보 구매 모달 — 목록 클릭 즉시구매·판매자 거래횟수 (FC-146·150)` — 프론트 8파일
- **C3 `25d3652`** `docs(spec): 판매자 완료 판매 건수 계약 — sellerCompletedSales (FC-148)`
- **C4 `f1aa276`** `docs(board): EPIC-MARKET-QUICKBUY 티켓·목업 (FC-145~150)`
- (+ 본 HANDOVER 갱신 커밋)

### 확정 스펙 (구현 반영됨)
- **상호작용**: 마켓 `ShopCard` **카드 전체 클릭** → `ShopCardInfoDialog` 모달(상세 네비 대체, `/market/:id`는 딥링크 seam 잔존).
- **디자인**: 앱 라이트/클린 커머스 톤(흰 표면·헤어라인·네이비 포인트·오렌지 CTA). 게임 다크패널 아님. 카드 이미지는 **배경/효과 없이 딱 맞게**(PC hover 리프트·그림자 중화, 모바일 `--art-scale:1.3`로 잘림 해소). 헤더 좌측 아이콘=`TbId` 배지. **랭크뱃지 없음·탭 없음(특수스킬만)**. 속성표 5행=타입·명칭·채널제한·속성·남은 골드 포스. 판매자 영역=**특수스킬 하단** 독립 행(아바타 이니셜+"판매자"+닉네임+**"거래 N회"** 우측 칩, 0회="신규 판매자").
- **반응형**: 웹=중앙 2열 모달, 모바일=하단 시트·상단 2열(작은 썸네일 좌·속성 우, 스크롤 감소).
- **거래 횟수(FC-148~150)**: `sellerCompletedSales`(long) = `COUNT(sale_order WHERE seller_id=X)` **경매+마켓 합산**. 목록=배치 IN 집계 1쿼리(N+1 없음), 상세/내판매=단건. 형상 보존(필드 1개 추가). 계약=`shop-spec §11`·`api-contract §3.3`.

### 데이터/판정 메모
- **채널제한** 행은 계약에 없어 `channelLimitOf(level)` **표시 파생**(Lv1-3 초보/4-7 고수/8+ 마스터 채널). 위조 아님(표시 계층, 사용자 A안 수용).
- reviewer minor 2(무해, 후속 대상): ① over-fetch probe 행 seller가 IN 집계에 낄 수 있으나 getOrDefault로 무해 ② `GatewayAccessIntegrationTest` health 200 기대→503은 **헤드리스 환경(mail/ES/redis DOWN) 선재 취약성·FC-149 무관**(회귀 아님).

---

## B. 다음 수 (재개)

1. **★ 사용자 push** — 로컬 `master`가 origin보다 5커밋 앞섬. `git push`는 에이전트 차단(게이트3 훅), **사용자가 직접 실행**. push 후 원격 CI(정적분석·의존성 스캔) 가동.
2. **실값 확인**: 카드정보 "거래 N회" 실숫자는 **IntelliJ 백엔드 재기동** 후 표시(집계가 새로 생겨서). 디자인은 5173 HMR 라이브.
3. **에픽 Jira(선택)**: `EPIC-MARKET-QUICKBUY`는 Jira Epic 미생성(티켓만 미러). 대시보드 롤업이 필요하면 Epic 생성 후 KAN-162~167 Epic Link.

---

## C. Git 상태
- **origin/master = `3ef53eb`**(FC-140~144까지 push 완료). 로컬 `master` = **`(HANDOVER 커밋)` ← f1aa276 ← 25d3652 ← f74c20f ← d088645 ← 3ef53eb**(5 ahead).
- 규율: push는 사용자 직접([[commit-needs-approval]]는 커밋만; push는 게이트3). 워킹트리 클린 예정.

---

## D. 직전 세션 done·push (FC-140~144)
- **FC-140**(KAN-157) 이메일 실발송 로컬 opt-in · **FC-141**(KAN-158) env 관리 검토 · **FC-142**(KAN-161) 설정값 env 전면 외부화 · **FC-143**(KAN-159) 본인인증 카드 모바일 오버플로 수정 · **FC-144**(KAN-160) 진행 중 경매 100개 시드. 전부 done·push(origin=`3ef53eb`)·Jira 완료.
- **SMTP 실발송 end-to-end 작동**(네이버). 진범=엉뚱한 프로젝트 구성에 env 적용([[local-env-mail-setup-gotchas]]).

## 환경 기동·상태
- **백엔드 8080 = 사용자 IntelliJ 실행**(`FinalcallApplication`, local, mail UP). `.env`에 유효한 네이버 메일 크리덴셜 있음(gitignore). ⚠️ 노출된 앱 비밀번호는 검증 후 재발급 권장.
- **프론트 5173 = vite**(HMR). 필요 시 `cd frontend && npm run dev`.
- **Docker**: mysql·redis·es·kafka·connect healthy. 경매 100건 ACTIVE·마켓 5001건.
- 기동 함정: gradle 동시 실행 금지. env는 IntelliJ EnvFile(Enable 체크 필수)·**엉뚱한 프로젝트 구성 주의**. `export default memo(...)` 편집 시 HMR 꼬이면 `.vite` 캐시 삭제+재기동.

## 이어받는 법 (새 세션)
1. CLAUDE.md 섹션 8~13(오케스트레이션·게이트·티켓·커밋).
2. 이 파일 + `git status` + `git log --oneline -8`(origin=`3ef53eb`, 로컬 5 ahead).
3. 메모리: `commit-needs-approval`·`git-mv-prestage-commit-bleed`·`gate2-plain-language`·`design-mockup-first`·`options-need-html-mockup`·`mockup-fidelity-only-fix`·`responsive-separate-design`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`local-env-mail-setup-gotchas`·`config-env-ification-preference`.
4. **미러 패리티**: KAN-162~167 전건 완료 미러됨. 에픽 Jira는 미생성(선택 항목).

## 다음 수
1. **사용자 push**(로컬 5 ahead) → 원격 CI.
2. 백엔드 재기동해 "거래 N회" 실값 확인.

## 교훈
1. **디자인은 라이브 반복이 빠르다**: 목업 게이트(A안 선택) 후, 실 컴포넌트를 HMR로 고치고 사용자가 즉시 육안 확인·재지시하는 루프가 효율적. 단 "게임 구조는 유지·게임 디자인은 폐기" 같은 방향 반전은 명확히 재확인.
2. **계약에 없는 데이터는 위조 금지**: 목업의 "거래 128회"·랭크뱃지·채널제한이 계약 부재 → 랭크/거래횟수는 실데이터화(게이트2) 또는 제거, 채널제한은 표시 파생으로 격리. 목업 연출값을 그대로 구현하지 않는다.
3. **HMR 함정**: `export default memo()` + 다파일 동시 편집 시 "does not provide export 'default'"는 브라우저 하드리프레시로 안 풀림 → **vite 서버 재기동 + `.vite` 캐시 삭제**.
4. **N+1 회피 계약**: 목록 판매자 집계는 페이지당 배치 IN 1쿼리로 못박아 계약(§11.4)·테스트(Statistics=1)로 강제.
