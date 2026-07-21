# EPIC-CLOSING 온디맨드 보안 리뷰 (에픽 완료 직전)

검토: 2026-07-21 · 대상 = 정산 도메인 백엔드(FC-082 커밋 7110c9d 외) · single-shot LLM 보안 패스(§13)

## 판정: **고신뢰(≥8) 취약점 0건**

## 검토 영역·제외 사유
- **네이티브/JPQL injection**: 신규 CAS·정산 쿼리(findClosableIds·markSold/UnsoldIfClosable·markWonIfActive·captureIfHeld·transferListed*·capture) 전부 JPQL + **명명 파라미터**(:id·:now·:amount·:userId 등). nativeQuery·문자열 연결·동적 조립 0. enum 분기는 FQCN 리터럴(사용자 입력 아님). injection 표면 없음.
- **application.yml 시크릿**: `fee.policy`(정책값)·`closing.worker`(`${ENV:기본값}` 튜닝값) — 자격증명 아님. 디스크 시크릿 없음.
- **마감 워커 인가**: `CloseWorker.sweep`=내부 `@Scheduled`(사용자 트리거 아님). closeOne의 auctionId=내부 스캔, 금전 주체(winner/seller/price)=락 잡은 auction 행 파생. 컨트롤러·요청 파라미터 미접촉 → IDOR·권한상승·임의 금전이동 신규 없음.
- **금전 무결성**: capture·credit·CAS가 `WHERE held>=amount AND balance>=amount` 조건부 UPDATE + 영향행 0=롤백. settle 음수·오버플로는 DB CHECK + cap/min 클램프. 낙찰가가 입찰자 잔액 제약 → 공격자 조종 경로 없음.
- **역직렬화/RCE/로그**: 지점 없음. 로그는 auctionId+예외만(PII·시크릿 없음).

## 결론
에픽 완료 보안 게이트 통과. 원격 CI(정적분석·의존성)는 push 후 GitHub Actions 이중화(§13).
