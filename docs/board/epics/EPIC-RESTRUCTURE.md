---
id: EPIC-RESTRUCTURE
type: epic
jira_key: KAN-129
title: 패키지 구조 재구성 — feature-first(도메인별) 전환
state: done
children: [FC-119, FC-120, FC-121, FC-122]
gate: null
---
## 목표
layer-first(`api/domain/infra/common` 최상위 4분할) → **feature-first(도메인별)** 전환. 한 도메인=한 트리, 도메인 내부에 `controller/service/repository/entity/dto` 하위패키지(On-Race 옵션 C 복제). ArchUnit 기계 강제는 **유지·강화**(최상위 레이어 규칙 → 슬라이스 내부 계층방향 + 슬라이스 비순환).

## 확정된 결정 (사용자, 2026-07-25 · 게이트2)
1. **방향 = 옵션 C** (feature-first + 도메인 내부 계층 하위패키지, On-Race 방식).
2. **`domain` 그룹 도입** → `com.finalcall.domain.<feature>.<layer>` (예: `com.finalcall.domain.member.service.MemberService`). On-Race 원형. 커널(`common`·`infra`·`common.entity`)은 domain 밖 제자리. **(2026-07-25 변경 — 종전 "접두 생략"을 사용자가 뒤집음. sample·notice·member 재배치 동반.)**
3. **횡단 인프라·공용 커널 = 현행 `common`·`infra` 유지** (feature 아님·제자리). 총괄 기본값 — 사용자가 `global` 등으로 변경 가능.
4. **타이밍 = 재구성 먼저**, EPIC-EMAIL-VERIFY(FC-117·118) hold.

## 관련 결정 — MSA 분리 유보 (사용자, 2026-07-25)
member/auth를 별도 MSA 모듈/서비스로 분리하는 안을 검토했으나 **유보**한다(모놀리스 우선 유지, D-068 재확인). 근거: (1) 방금 리서치·컨설턴트 결론 = "성급한 MSA 대신 잘 나눈 모놀리스로 시작, 추출은 실제 드라이버 생길 때만"(Thoughtworks microservice envy 경계), (2) 이 프로젝트의 핵심 도전은 auth가 아니라 입찰 동시성(bid·auction·settlement), (3) **feature-first가 곧 추출 준비** — 완주하면 member/auth는 통째로 들어낼 수 있는 경계가 되어 미루는 비용이 0. 향후 실제 드라이버(독립 스케일·팀 경계·전시 목적) 발생 시 feature-first 완료 후 별도 에픽으로.

## 근거
- 컨설턴트 개정안 `docs/common/proposals/layer-restructure-proposal-v0.1.md`(DECIDED) + 웹 레퍼런스 리서치. 업계 수렴 = feature/domain-first + 경계 기계강제(ArchUnit/Modulith). D-068 MSA 확장 정합(feature 트리 = 추출 경계).
- 핵심 문제: settlement가 `domain/settlement`+`api/order`+`api/purchase` 3트리 분산 등, 한 도메인 작업 시 왕복.

## 분해 (게이트1 승인, 2026-07-25)
- **FC-119** [consultant] Phase0-docs: feature-first 규약 확정 + CLAUDE.md 개정 + proposal v0.2.
- **FC-120** [backend-impl] Phase0-code+Phase1: ArchUnit 신규 규칙 병존 추가 + 커널 위치 확정.
- **FC-121** [backend-impl] Phase2: feature 단위 순차 이전(10개, 각 원자 커밋, 매 이전 후 test green).
- **FC-122** [backend-impl] Phase3: 구 ArchUnit 규칙 제거 + spec/board 경로 참조 갱신 + 최종 검증.
- 게이트: 대규모 이동은 로직 0줄 변경(기계적 diff). 각 Phase 후 reviewer 확인, done 전 reviewer 필수(섹션 9).

## 후속 (범위 밖) — feature 단위 순환 강제 보류
슬라이스 순환 규칙을 `com.finalcall.domain.(*)..`(feature 단위)로 올리면 red다. 원인은 패키지 배치가 아니라 **레거시 도메인 간 실제 양방향 결합**: auction↔bid(Bid가 Auction 보유·BidService↔AuctionRepository·AuctionService↔BidIncrementProperties), auction↔search↔shop↔settlement. 이 결합을 이벤트/인터페이스로 끊는 건 **로직 변경**이라 FC-121("로직 0줄") 범위 밖. 따라서 순환 규칙은 **top-level `com.finalcall.(*)..` 유지**(green, 현 baseline 동일)하고, feature 단위 승격은 **레거시 순환 해소 별도 티켓 이후로 미룬다**(auction·bid는 핵심 동시성 도메인이라 신중히). member/sample/notice는 순수 leaf로 무관.

## 파급 (컨설턴트 정량화)
프로덕션 ≈217파일 이동 + 테스트 ≈75파일 import + ArchUnit 1파일 재작성. CLAUDE.md 섹션 1·3·4·5·7 개정. 로직 불변 → 기존 테스트가 회귀 그물.
