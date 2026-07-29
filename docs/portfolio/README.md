# FinalCall 포트폴리오 도시에 (인덱스)

> 이 폴더는 포트폴리오(케이스 스터디·이력서 불릿·소개 페이지)로 **재가공하기 위한 중간 산출물(도시에)**을
> 모은다. 정본이 아니라 코드·spec·계약·보드·리뷰·결정로그에서 큐레이션한 파생 요약이며, 모든 주장은
> 증거(파일 경로·커밋 해시·테스트)로 뒷받침한다. 진행 중 항목은 "진행 중"으로만 표기한다.
>
> 구조 표준: `_TEMPLATE.md`(개요 / 해결한 기술 도전과 해법 / 핵심 결정과 근거 / 아키텍처 / 증거).

## 프로젝트 개요

**FinalCall** — 게임 아이템 경매 플랫폼. 게임 아이템을 등록·경매·입찰·낙찰하는 대규모 트래픽 경매
백엔드다. 핵심 기술 도전은 **마감 직전 입찰 폭주(동시성 제어)**와 **실시간 최고가 갱신**이며,
Java 21 + Spring Boot 3.5 모놀리식 서비스 + SCG 엣지 게이트웨이(별도 배포) 토폴로지로 구성된다.
개발은 메인세션 총괄 + 서브에이전트 오케스트레이션(파일 티켓 보드 기반)으로 진행한다.

## 도시에 목록

| 도시에 | 상태 | 한 줄 요약 |
|---|---|---|
| [skeleton.md](skeleton.md) | 완료 | Stage 0~G 프로덕션 스켈레톤 — 분산락·회복탄력성·JWT·관측성 + SCG 엣지 게이트웨이(rate limit·직접접근 차단) + 모노레포. 대규모 트래픽·동시성 인프라 선점. |
| [orchestration.md](orchestration.md) | 완료·운영 중 | 파일 티켓 보드 기반 멀티에이전트 오케스트레이션 — contract-first·게이트 정책·상태 머신·Jira 단방향 미러·게이트3 push 차단 훅. "AI 협업 개발 프로세스 설계"라는 메타 성과. |
| [process-log.md](process-log.md) | 누적 로그 | 프로세스 개선·트러블슈팅·열린 논의의 누적 이력. 항목1=Jira 미러 드리프트 사건→규율화(해결됨, warn-only 훅+HANDOVER 패리티). 항목2=보안 층 도입 논의(**OPEN·미결**). 케이스 스터디가 아니라 재개용 이슈·의사결정 로그. |
| [member.md](member.md) | 완료·push됨 | 회원 도메인(EPIC-MEMBER) — 프로필/수정/탈퇴. refresh 회전·세션 일괄 폐기(SEC-006), soft delete 재가입 UK(D-081), 열거 방지(COMMON_005/SEC-007), 탈퇴 잔액 소멸 동의(D-080). |
| [fe-member.md](fe-member.md) | 완료·게이트3 Done | 프론트 내 계정(EPIC-FE-MEMBER) — auth·마이페이지·잔액 표시. contract-first 단일 1패스(팬아웃 교차 분석), `GET /me` 하이드레이션(계약 변경 없이 정합), 디자인 U-020 남색→U-021 라이트 커머스 실코드 교체, COMMON_005 열거방지·메모리 세션·탈퇴 동의(D-080), Jira 미러 누락→규율 전환. |
| [shop.md](shop.md) | 완료·게이트3 Done | 고정가 마켓(EPIC-SHOP) — "입찰 없는 즉시 SOLD". 정산 꼬리(SettlementRecorder·sale_order source_type=SHOP·수익원장·인벤토리 CAS) **코드 변경 0 재사용**(3번째 소비처), shop 애그리거트 머리만 신규. 동시성 3중 방어(행 FOR UPDATE+status CAS+sale_order UK)·구매/만료 시간축 배타·잔액 user_id 오름차순(A4)·만료 워커 TEMP 직행. contract-first 게이트2 기한 모델 정정→재작업 0, 목업 fidelity+상세 경매디자인 재사용, FC-096 취소 UI 후속 분리. |
| [market-quickbuy.md](market-quickbuy.md) | 완료·게이트3 Done | 마켓 즉시구매(EPIC-MARKET-QUICKBUY) — 목록에서 게임 "카드정보" UI 차용 모달로 인라인 구매. **구매 API 계약 변경 0**(POST /shops/{id}/purchase 재사용). 규율 2건: **N+1 회피**(판매자 거래횟수를 페이지당 배치 IN 집계 1쿼리로 계약·슬라이스 테스트 Statistics=1 강제)와 **데이터 위조 금지**(연출값을 실데이터/표시파생/제거로 3분 — 거래횟수 실집계 sellerCompletedSales, 채널제한 표시파생 격리, 랭크뱃지 제거). 형상 보존(필드 1개 추가). 디자인 게이트 반복→게이트2 계약 승격→병렬 팬아웃. |

## 향후 도메인 (자리표시 — 미착수/진행 중)

- **화폐(EPIC-CURRENCY) — 진행 중**: `UserBalance` 원자적 증감(조건부 UPDATE, D-008) + 캐시↔게임머니
  교환(`POST /exchanges`, 멱등키 SEC-004). 완료 시 도시에 추가 예정.
- **충전(EPIC-CHARGE) — 미착수**: 토스 테스트 결제 연동(외부 연동·시크릿, pg_tx_id 멱등).
- **경매(auction)** — 구현됨(EPIC-CLOSING 마감·즉시구매 EPIC-PURCHASE 완료): 시작가·즉시구매가·마감시각·상태. 별도 도시에 미작성(SettlementRecorder·sale_order 정산 꼬리는 shop.md에서 재사용 관점으로 다룸).
- **입찰(bid)** — 미착수: 마감 직전 동시성 제어의 핵심.
- **정산(settlement)** — 구현됨: SettlementRecorder·sale_order·수익원장(경매·즉시구매·고정가 3소비처 공통). 전용 도시에 미작성.
- **아이템/카테고리(item/category)** — 부분 구현(ItemInstance 에스크로·인벤토리 CAS). 전용 도시에 미작성.

_최종 갱신: 2026-07-29 (portfolio-writer, market-quickbuy.md 신설 — EPIC-MARKET-QUICKBUY 카드정보 모달 인라인 구매·N+1 회피 배치 집계·데이터 위조 금지 3분)_
