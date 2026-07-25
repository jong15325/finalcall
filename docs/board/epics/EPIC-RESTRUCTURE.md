---
id: EPIC-RESTRUCTURE
type: epic
jira_key: KAN-129
title: 패키지 구조 재구성 — feature-first(도메인별) 전환
state: doing
children: [FC-119, FC-120, FC-121, FC-122]
gate: null
---
## 목표
layer-first(`api/domain/infra/common` 최상위 4분할) → **feature-first(도메인별)** 전환. 한 도메인=한 트리, 도메인 내부에 `controller/service/repository/entity/dto` 하위패키지(On-Race 옵션 C 복제). ArchUnit 기계 강제는 **유지·강화**(최상위 레이어 규칙 → 슬라이스 내부 계층방향 + 슬라이스 비순환).

## 확정된 결정 (사용자, 2026-07-25 · 게이트2)
1. **방향 = 옵션 C** (feature-first + 도메인 내부 계층 하위패키지, On-Race 방식).
2. **`domain.` 접두 생략** → `com.finalcall.<feature>.<layer>` (예: `com.finalcall.member.service.MemberService`).
3. **횡단 인프라·공용 커널 = 현행 `common`·`infra` 유지** (feature 아님·제자리). 총괄 기본값 — 사용자가 `global` 등으로 변경 가능.
4. **타이밍 = 재구성 먼저**, EPIC-EMAIL-VERIFY(FC-117·118) hold.

## 근거
- 컨설턴트 개정안 `docs/common/proposals/layer-restructure-proposal-v0.1.md`(DECIDED) + 웹 레퍼런스 리서치. 업계 수렴 = feature/domain-first + 경계 기계강제(ArchUnit/Modulith). D-068 MSA 확장 정합(feature 트리 = 추출 경계).
- 핵심 문제: settlement가 `domain/settlement`+`api/order`+`api/purchase` 3트리 분산 등, 한 도메인 작업 시 왕복.

## 분해 (게이트1 승인, 2026-07-25)
- **FC-119** [consultant] Phase0-docs: feature-first 규약 확정 + CLAUDE.md 개정 + proposal v0.2.
- **FC-120** [backend-impl] Phase0-code+Phase1: ArchUnit 신규 규칙 병존 추가 + 커널 위치 확정.
- **FC-121** [backend-impl] Phase2: feature 단위 순차 이전(10개, 각 원자 커밋, 매 이전 후 test green).
- **FC-122** [backend-impl] Phase3: 구 ArchUnit 규칙 제거 + spec/board 경로 참조 갱신 + 최종 검증.
- 게이트: 대규모 이동은 로직 0줄 변경(기계적 diff). 각 Phase 후 reviewer 확인, done 전 reviewer 필수(섹션 9).

## 파급 (컨설턴트 정량화)
프로덕션 ≈217파일 이동 + 테스트 ≈75파일 import + ArchUnit 1파일 재작성. CLAUDE.md 섹션 1·3·4·5·7 개정. 로직 불변 → 기존 테스트가 회귀 그물.
