# 경매 축 통합 검수 — FC-070 홈 · FC-071 목록 · FC-072 상세+입찰 · FC-073 판매

검수: reviewer · 2026-07-21 · 커밋 `050f919`+`b58bd75` · `f22dfb9`+`b3a2c30` · `ed426d7` · `b6f3c16`
정본: rebuild-contract-map(§2.9 색=브랜드·구조=목업)·design-brief B-1/2/3/4/12·fee-policy-spec·목업(레포 밖)

## 게이트 판정: **PASSED** (critical 0 · major 0 · minor 2 비차단)

## 검증 재현 (EXIT=0)
typecheck 0 · lint 0 warning · **test 328/33 files** · build 성공(184 modules).

## 중점 축 (전부 PASS)
1. 목업 충실도: 홈 배너 3슬라이드·마감임박·자리 / 경매목록 가로카드 112px·3/2/1@1200/576·command 필터 / 상세 1.55·0.75·hero245·bid-panel sticky·bid-dialog / 판매 .sell-grid. 색=브랜드(§2.9, Vuexy 블루 미적용 정상).
2. FC-064 함정 6/6(FC-072): 모달 초점 [open]+ref · 금액 덮어쓰기 reconcileAmountWithMin · 비활성 DOM · 스킬 슬롯 · minNextBid 서버파생 · endAt 재동기.
3. 계약: 퍼플 0·마감 now>=endAt·즉시구매 버튼 없음·스킬 중립·금액 정수·preview/browse 분리·미구현 호출 0(FC-048).
4. 수수료(FC-073): fee-policy-spec v1.0 정확(P=2,480,000→110,200·settle 2,369,800), "예상·서버확정" 표기.
5. 접근성: 비활성 DOM·aria-pressed·aria-label·noValidate·다이얼로그 초점가둠·Escape·스크롤복원.
6. 보존 lib 무결(diff 0) · 7. 마스킹 미결 isOwnAuction 1지점 격리.

## Minor (비차단)
- **M-1(폴리시)**: 홈 공지 자리보류가 가짜 제목·날짜를 렌더 → 실제처럼 보임(마켓 자리의 빈 스켈레톤과 불일치). 정직성·통일성 권고. → **마무리 폴리시(FC-077 구간)에서 공지 자리를 스켈레톤으로 통일**.
- **M-2**: FC-071 중간 churn(필터 컨트롤 생성 후 삭제) — 최종 트리 무영향, 관찰 기록만.

## 후속
경매 축 4티켓 review_status=passed. 마이 축(FC-074~076) + 자리(FC-077, 홈 공지 스켈레톤 통일 포함) 착수 가능.
