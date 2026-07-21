# 토대 레이어 통합 검수 — FC-067(앱 셸·폐기) + FC-068(공통 컴포넌트)

검수: reviewer · 2026-07-21 · 대상 커밋 `bdc5779`(FC-067) · `15c0608`+`7f3b29f`(FC-068)
정본: `docs/ux/rebuild-contract-map.md` + 목업(장터, 레포 밖) + 사용자 지시 "목업 그대로·오류만 수정"

## 게이트 판정: **PASSED** (critical 0 · major 0 · minor 3, 전부 비차단)

## 검증 재현 (EXIT=0)
typecheck ✓ · lint 0 warning · **test 249 (22 files)** · build 96.75KB gzip.
보존 lib 무결: `git diff d6570d2..HEAD -- features/*/lib lib` = **0줄**(45 lib·209 테스트 인코딩 무손상).

## 중점 축
| 축 | 판정 |
|---|---|
| 1 목업 충실도 | PASS — 사이드바 260/70/44·TopNavbar 7·MobileBottomNav 5탭+safe-area·카드텍스트 토큰·hover 개별·골드포스 좌표 일치 |
| 2 계약 준수 | PASS — 퍼플 0·element 폴백·프레임 골드포스만·스킬 중립·CodeAmount 정수·minNextBidAmount 카드 부재 |
| 3 접근성 | PASS — 비활성 DOM 속성·aria-pressed·아이콘 aria-label·금액 full aria (M-2 보강 여지) |
| 4 보존 lib | PASS — diff 0·209 테스트 유지 |
| 5 FC-064 함정 예방 | PASS — 매초 리렌더·초점강탈 씨앗 없음(Dropdown/AppShell effect deps 최소) |
| 6 번들/구조 | PASS — 무거운 배럴 유입 0 (M-1 매니페스트 잔재) |

## Minor (비차단)
- **M-1** package.json 미사용 Ecme 템플릿 deps ~40종 잔존(트리셰이크로 번들 무유입, but FC-065 lodash 재인입 씨앗). → **FC-069에서 prune**.
- **M-2** `card-number`/`card-rank` span aria-label이 role 없음(SR 노출 불확실, 골드포스 잔여일 유일 채널). → **FC-069에서 role 부여**.
- **M-3** 접힘(70px) 사이드바 그룹 하위메뉴 도달 불가 — FC-067이 명시 유예. 후속 인지(플라이아웃).

## 정당한 예외 (확인됨)
- 특수 SS 마크 미렌더 = 계약 데이터 없음(죽은코드 금지). 정당.
- 광택 reduced-motion 정지 = §6.3 a11y("오류·이슈만" 부합). 정당.

## 후속
화면 티켓(FC-070+) 착수 가능. FC-069(M-1·M-2 정리)를 화면 착수 전 처리 권장.
