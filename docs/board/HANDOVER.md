# 총괄 세션 핸드오버

> 갱신: 2026-08-14 / 원격 `master` HEAD `b16e3d8`

## 현재 결론

- 사용자가 `git push`를 완료했다. 로컬과 원격 `master`는 `b16e3d8`까지 동기화됐다.
- 작업 트리는 clean이다.
- Jira는 에픽 단위만 미러한다. FC-298~304는 기존 디자인 워크벤치 에픽의 후속 또는 독립 단순 작업이라 개별 Jira 이슈를 만들지 않았다.
- 포트폴리오는 매 작업마다 작성하지 않는다. 프로젝트의 중요하고 기술적인 선택만 에픽 완료 또는 사용자 요청 시 정리한다.

## 8월 13~14일 완료 작업

### 디자인 워크벤치와 배경

- 실제 AppShell·provider·공용 컴포넌트를 재사용하는 DEV 전용 `/__design/*` 워크벤치를 구축했다.
- production build에는 route·scenario·fixture·marker가 남지 않도록 정적/빌드 가드를 적용했다.
- 바람 파티클 10안, 불 10안, 물 10안을 제작했다.
- 운영 배경에는 사용자가 선택한 `겹친 비단 리본형 + 돌풍 펄스` 바람 효과만 왼쪽 하단 wind 영역에 적용했다.
- 불·물 운영 효과는 사용자가 기존 상태 유지를 선택해 변경하지 않았다.
- 회전 원뿔형 스포트라이트는 제거했고 나머지 파티클은 유지한다.

### AppShell과 게시글

- 접점 고정형 상단 navigation을 운영 AppShell에 적용했다.
- navigation·content·footer의 공통 가로 경계와 라운드 처리를 정합화했다.
- 게시글 상세 페이지의 콘텐츠 폭을 다른 페이지와 동일한 공통 영역으로 교정했다.

### 지갑과 화폐 표기 — FC-303~304

- 지갑 디자인 5안을 `/__design/wallet-balance-studies`에 제작했다.
- 사용자 선택인 `모바일 월렛형`을 `WalletBalanceCard`와 `WalletSummaryCard` 운영 화면에 적용했다.
- 핵심 가용액은 32px, 총 보유·입찰 보류·캐시 보조 금액은 20px다.
- 공용 `CodeAmount`에서 `code.png` 이미지를 전면 제거했다.
- 숫자 뒤에 `코드` 또는 `캐시` 텍스트 단위를 표시한다. `currency` 기본값은 `code`, 캐시 소비자는 `currency="cash"`를 명시한다.
- 코드 숫자는 레거시 JSP의 6개 금액 구간 의미를 보존한 WCAG 보정색을 사용한다.
  - `< 10,000`: `#607400`
  - `10,000~99,999`: `#0075A5`
  - `100,000~999,999`: `#CE00A5`
  - `1,000,000~9,999,999`: `#007D00`
  - `10,000,000~99,999,999`: `#A65A00`
  - `>= 100,000,000`: `#BD0000`
- 아이템 마켓과 경매 목록의 상단 가용 잔액 및 카드 가격은 `만/억` 축약 없이 전체 정수로 표시한다.
- 공간이 제한된 글로벌 `TopNavbar`만 `compact` 표기를 유지한다.

## 최종 검증

- frontend 전체 테스트: **106 files / 846 tests 통과**
- `typecheck`, UI/workbench guard, asset sync 통과
- lint 오류 0건, 기존 범위 밖 경고 2건만 유지
- 390px·1280px 및 200% 확대에서 wallet·market·auction overflow 0건
- production build와 workbench residue 0건 가드 통과
- FC-304 reviewer 최종 판정: Critical 0 / Major 0 / Minor 0, PASS

## 최근 핵심 커밋

- `c607bde` 지갑과 화폐 금액 UI 계약 확정
- `f892f10` 모바일 월렛과 텍스트 화폐 표기 적용
- `42f2b33` 지갑 보조 금액과 목록 전체 표기 정합화
- `b16e3d8` FC-304 완료 기록

## 다음 세션 이어받는 순서

1. `AGENTS.md`, `docs/PROJECT-HANDOFF.md`, 이 파일을 읽는다.
2. `git status --short`, `git log --oneline -12`, `git rev-list --count origin/master..HEAD`를 확인한다.
3. 필요하면 frontend `5173`, backend `8080` 실행 상태를 확인한다.
4. 새 사용자 요청을 기다린다. 현재 승인 대기나 미완료 구현은 없다.
5. 새 화면·주요 UI는 디자인 게이트를 거치고, 단순 수정은 자동 진행한다. 목업 리뷰는 최소화하되 운영 변경은 reviewer PASS 후 완료한다.

## 주의

- push는 사용자만 수행한다.
- `logs/`, `mockups/`와 사용자 제외 파일은 커밋하지 않는다.
- 워크벤치 후보를 운영에 채택할 때는 이동하거나 직접 이관하고, production과 후보 사본을 정본처럼 병존시키지 않는다.
- 기존 `InventoryItemCard.test.tsx` lint 경고 2건은 이번 작업 범위 밖이다.
