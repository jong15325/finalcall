# FinalCall 포트폴리오 도시에

> 케이스 스터디·이력서·소개 페이지로 재가공하기 위한 근거 중심 중간 산출물이다. 정본은 코드,
> `docs/spec/`, `docs/board/`, 리뷰와 Git 이력이다. 최종 감사: 2026-08-24.

## 프로젝트 한눈에 보기

FinalCall은 게임 아이템의 등록·경매·입찰·낙찰·정산·게임 지급을 다루는 모놀리식 서비스다. Java 21,
Spring Boot 3.5, MySQL, Redis를 사용하며 SCG 엣지 게이트웨이를 별도 배포한다. 업무 코드는 현재
`com.finalcall.domain.<feature>.<layer>` feature-first 구조이고 공용 커널은 `common`·`infra`에 둔다.

Claude Code와 Codex에 같은 역할 분리와 파일 보드 규율을 적용해 `architect → backend/frontend → reviewer`
흐름을 운영하되, 계약·성능·인가처럼 되돌리기 큰 결정과 Done은 사용자가 승인했다. 핵심 주장은 “AI가 전부
만들었다”가 아니라 **AI를 통제 가능한 개발 파이프라인으로 구성하고 사람이 기술 판단과 검증 책임을 유지했다**는 것이다.

## 대표 도시에

| 도시에 | 상태 | 포트폴리오에서 증명하는 것 |
|---|---|---|
| [ai-development-journey.md](ai-development-journey.md) | 완료·운영 중 | 공통 파일 보드로 기획부터 구현·디자인·리뷰·수정까지 운영한 여정 |
| [auction-bid-settlement.md](auction-bid-settlement.md) | 완료 | 경매 행 비관적 락+금전 CAS로 입찰·소프트클로즈·마감·정산 불변식 구현 |
| [search-cdc.md](search-cdc.md) | 완료 | MySQL 정본·Elasticsearch 파생 모델, nori, Kafka/Debezium CDC와 라이브 장애 해결 |
| [item-delivery.md](item-delivery.md) | 1단계 완료 | DB 우편함+Redis 알림, 트랜잭셔널 아웃박스, 멱등 claim. 게임 실이식 phase-2는 미구현 |
| [shop.md](shop.md) | 완료 | 고정가 구매 동시성 3중 방어와 공통 정산 꼬리 재사용 |

## 기반·프로세스·기능 도시에

| 도시에 | 상태 | 한 줄 요약 |
|---|---|---|
| [skeleton.md](skeleton.md) | 완료 | Spring·Flyway·Redis·JWT·관측성·SCG 기반. 분산락은 데모이며 입찰 정확성 수단은 아님 |
| [orchestration.md](orchestration.md) | 완료·운영 중 | contract-first, 역할별 AI, 사용자 게이트, 파일 보드·Jira 미러·push 통제 |
| [process-log.md](process-log.md) | 누적 로그 | Jira 드리프트·보안 리뷰·게임 연동 논의의 시점별 기록 |
| [frontend-ui-system.md](frontend-ui-system.md) | 완료 | semantic token·AppShell·카드 composition·접근성 대비와 완료 당시 765테스트 |
| [quality-cleanup.md](quality-cleanup.md) | 완료 | 댓글 소유권을 SecurityContext 회원 ID로 전환하고 테스트 환경 격리 |
| [member.md](member.md) | 완료 | 회원·탈퇴·refresh 세션 폐기·soft-delete 재가입·열거 방지 |
| [fe-member.md](fe-member.md) | 완료 | 인증·마이페이지·잔액 UI와 계약 기반 프론트 구현 |
| [market-quickbuy.md](market-quickbuy.md) | 완료 | 구매 API 재사용, 배치 집계 N+1 회피, 연출 데이터 위조 방지 |

## 전체 범위와 선별 원칙

보드 기준으로 회원·화폐·아이템·경매·입찰·마감·즉시구매·고정가 장터·검색·이메일 인증·OAuth·게시판·
댓글·메모·채팅·판매관리와 다수 UI 에픽이 완료됐다. 모든 에픽을 장문으로 만들지 않고 기술 선택과
트레이드오프가 강한 사례만 선별했다. EPIC-RESTRUCTURE와 EPIC-CONVENTION-V2도 완료되어 현재 구조에 반영했다.

진행 중 항목은 구현 완료로 쓰지 않는다. 2026-08-24 현재 `EPIC-OPS-SEED`와 포트폴리오 최신화 에픽은 진행
중이다. 검색 운영 재색인 코어는 구현됐지만 관리자 API는 별도 범위로 되돌린 이력이 있다.

[portfolio-outline.md](portfolio-outline.md)는 FinalCall 독립본 12페이지 초안이다. OnRace의 대기열·처리량
최적화를 반복하지 않고 AI 개발 운영체계·경매 금전 정합성·검색 CDC·검증 책임에 집중한다.

## 감사 메모

- 기존 인덱스의 `EPIC-CURRENCY 진행 중`, `입찰 미착수` 표기는 보드와 불일치해 수정했다.
- 과거 `api → domain → infra → common` 설명은 현재 구조가 아니므로 정정했다.
- 테스트 개수는 각 에픽 완료 당시 리뷰 기록의 수치이며 현재 전체 테스트 총계가 아니다.
- Git 작성자만으로 Claude Code/Codex 개별 기여를 단정하지 않는다. 역할 정의와 공통 정본 운영을 증거로 삼는다.
