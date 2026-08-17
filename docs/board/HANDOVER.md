# 총괄 세션 핸드오버

> 갱신: 2026-08-18 00:16 KST / 브랜치 `master`

## Git·환경
- 로컬 HEAD: `83a9b05`
- upstream 원격 HEAD: `83a9b05`
- unpushed commit: 0
- 작업 트리: dirty — FC-313/FC-314 운영 카드·카운트다운 워크벤치·Vuexy 공용 포트·디자인 규약 변경, 기존 SellPage/Navigation 워크벤치 변경, 로컬 `.claude` 설정과 브라우저 캡처 임시파일이 함께 있다.
- 실행 서비스: frontend `5173`, backend `8080`, management `8081`, MySQL `3306`, Redis `6379` 모두 LISTEN 없음.

## 완료
- FC-313 운영 실시간 경매 목록을 아이템 마켓 공용 세로 카드 composition으로 전환했고 reviewer PASS 상태다. 정본: `docs/board/tickets/FC-313.md`.
- 입찰 0건 표기를 제거하고 진행 상태는 우상단, 남은 시간은 우하단에 배치하는 중간안을 거쳐 카운트다운 디자인을 재검토했다.
- FC-314에서 태그·배지 및 실제 경매 카드 레퍼런스를 조사하고 `/__design/auction-countdown-tags`에 3계열 12안을 구성했다.
- 사용자가 워크벤치 `5. 입찰·시간 레일`을 선택했다. 운영 카드는 workbench #5와 동일한 `AuctionInfoRail > AuctionInfoGroup(TbGavel + 입찰 n) + AuctionTimeDisplay(tone="bare")` 구조를 직접 재사용한다.
- 운영 레일은 artwork 다음 flow sibling이라 이미지와 겹치지 않는다. 별도 urgency 색상·추가 clock·2행 변형은 없으며 skeleton은 동일한 37px 한 줄 레일이다.
- reviewer 최종 재검토는 critical 0 / major 0 / minor 0 PASS. FC-314 design gate를 해제하고 파일 보드와 Jira `KAN-357`을 동기화했다.
- 디자인 절대 규칙을 `rules [7.15]`, `templates [16]`, 결정 `C-086`·`C-087`에 반영했다. Vuexy 실물 component/class/anatomy 우선, 직접 import 불가 시 원본 geometry 기반 공용 React 포트를 선행한다.

## 진행 중
- FC-313 / `KAN-356`: `review`, owner `reviewer`, gate 없음, `review_status: passed`.
- FC-314 / `KAN-357`: `review`, owner `reviewer`, gate 없음, `review_status: passed`.
- 두 티켓 모두 구현·리뷰는 끝났으나 사용자 Done/커밋 승인을 받지 않아 `done`으로 전이하지 않았다.
- 변경은 커밋되지 않았다. 기존 SellPage/Navigation 워크벤치 dirty 변경과 섞여 있으므로 atomic staging 범위를 반드시 나눠야 한다.

## 남은 일
- 사용자가 실제 운영 카드의 #5 레일 최종 화면을 확인하고 FC-313/FC-314 Done 및 커밋 여부를 결정해야 한다.
- 표준 `npm run build` prebuild는 이번 범위 밖 dirty `WalletBalanceCandidate.tsx`·`WalletBalanceScenario.tsx`의 production source에 없는 `border-y` 때문에 중단된다. 해당 변경의 소유 맥락을 확인해 별도 수정해야 한다.
- `.tmp-auction-*`, `.tmp-countdown-*`, `.tmp-chrome-countdown-*` 캡처 및 프로필 디렉터리는 검수 임시파일이다. 삭제는 대상 확인 후 별도로 정리한다.
- frontend/backend가 모두 내려가 있으므로 다음 시각 확인 전에 서비스를 다시 실행해야 한다.

## 검증
- 최종 #5 운영 이식 관련 Vitest 21개 통과.
- frontend typecheck 및 대상 ESLint 통과.
- 직접 Vite production build와 production residue 0 통과. 기존 500kB chunk 경고만 비차단으로 남았다.
- 표준 `npm run build`는 범위 밖 WalletBalance workbench guard 위반으로 미통과.
- 390px·1280px 실제 Chrome 캡처로 12안 워크벤치의 반응형·overflow를 검수했다.
- reviewer 최종 판정 PASS: workbench #5와 운영 primitive·직계 자식 순서 일치, artwork 비겹침, 접근성 이름·입찰 0건 숨김·37px skeleton 확인.
- 템플릿·컨벤션 준수: 확인 — HANDOVER `templates [8]`, 사용자 사전 커밋 승인, no-push 규칙 적용.

## Jira 미러 패리티
- Jira 인증과 KAN 프로젝트 접근은 정상이며 로컬 보드 349건 형식 검사를 통과했다.
- FC-314 최신 title/state/gate/review_status는 `KAN-357`에 멱등 보정했다.
- 전건 `--check`에서 과거 티켓의 `Blocks` 관계 링크 중심 드리프트 451건이 남아 있다.
- 전건 `--apply`는 5분 동안 출력 없이 timeout됐고 재검사에서도 451건이 그대로였다. 연결 실패는 아니며 대량 관계 링크 처리 경로의 별도 진단 또는 분할 적용이 필요하다.

## 다음 첫 행동
1. frontend `5173`과 backend `8080`을 실행하고 운영 실시간 경매 목록에서 #5 레일을 실제 데이터로 확인한다.
2. 표준 build를 막는 범위 밖 WalletBalance workbench `border-y` 변경의 소유 맥락을 확인해 별도 처리한다.
3. 사용자의 Done·커밋 승인을 받은 뒤 FC-313/FC-314 코드, 디자인 규약 문서, 기존 SellPage/Navigation 변경을 서로 섞지 않도록 atomic staging한다.
4. Jira 451건 관계 링크 드리프트는 `--only` 분할 적용 또는 sync 스크립트 진단 티켓으로 처리한다.
