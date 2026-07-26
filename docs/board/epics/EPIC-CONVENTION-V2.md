---
id: EPIC-CONVENTION-V2
type: epic
jira_key: KAN-137
title: feature 내부 어휘·구조 정리 — DTO 축약·ErrorCode·Properties·Service
state: done
children: [FC-123, FC-124, FC-125, FC-126, FC-127]
gate: null
---
## 목표
feature-first 배치(EPIC-RESTRUCTURE) 완료 후, feature **내부** 어휘·구조를 On-Race 실소스 정본으로 정리한다. 순수 이동+개명, **로직 무변경**. RESTRUCTURE가 *배치*였다면 이건 *내부 어휘*다.

## 확정된 결정 (사용자, 2026-07-26 · 게이트1 승인 · 되돌리지 말 것)
On-Race 실소스(`D:\Java\ktcloud\backend\On-Race\backend`) 정본. 실측: DTO=Request/Response만(23/23), **Command 0개**(서비스가 web DTO 직접 수령·반환), ErrorCode=`common/exception`의 `BusinessErrorCode`+`InfraErrorCode`, Properties=`domain/<feature>/config/`.

- **축1 = C (하이브리드)**: 웹 계층 전면 = `Request`/`Response`만. **`View`·`Detail`·`Slice` 제거** → 중첩 read는 `Response` 내부 static record, 커서 목록은 common `CursorResponse<T>`. 서비스 계층 = **bid·settlement만** `Command`/`Result` 유지, **auction·shop·search의 Command/Result는 축약**.
- **축2 = b**: 15개 `*ErrorCode` enum을 **`common/exception`로 파일 이동**(도메인별 분리 유지, 병합 X). "ErrorCode=feature 루트" 규약 **명시적 번복**.
- **축3**: Properties **소비범위 분리** — 공통→`common`(적절 서브패키지), feature 전용→`domain/<feature>/config/`(현 feature 루트에서 이동).
- **축4**: Service VO를 `service/`에서 분리(`SoftCloseDecision`·`SampleCacheValue` 등), 헬퍼 네이밍 표준화(On-Race `*Service`+책임분리 헬퍼).
- **AGENTS.md/.agents**: feature-first + V2 규약 이식(구 layer-first 드리프트 해소, FC-127).

## 분해 (게이트1 승인, 2026-07-26)
- **FC-123** [consultant] Phase0 규약 확정: proposal §9(배치표)·§10(신 ArchUnit 규칙 스펙 + minor 2건 정정)·CLAUDE.md §5 반영. + architect 계약영향 패스. **코드 무변경. ★게이트2 상신 지점.**
- **FC-124** [backend-impl] 축2: ErrorCode 15종 → common/exception 이동(분리 유지). 원자 커밋.
- **FC-125** [backend-impl] 축3: Properties 소비범위 분리. @EnableConfigurationProperties 스캔 갱신. (FC-124와 파일 무교차 → 병렬 가능)
- **FC-126** [backend-impl] 축1+축4: DTO 어휘 축약 + Service 정리. 도메인 단위 순차 원자 커밋.
- **FC-127** [backend-impl] Phase4: 신 ArchUnit 규칙 추가 + AGENTS.md 이식 + 최종 :backend:test green.
- 의존: FC-123 → (FC-124 ∥ FC-125) → FC-126 → FC-127. reviewer(done 전 필수) → 게이트3.

## 게이트2 승인 (사용자, 2026-07-26)
1. **ErrorCode 규약 번복 승인** (feature 루트 → common/exception, 분리 유지·병합 X).
2. **형상 보존 원칙 승인** — 어휘 정리는 타입명·패키지만 변경, 응답 JSON 형상 불변. architect 검증: 21개 대상 DTO 전부 서비스 내부 전용 → 실질 무해. **예외 1건 = 공지 목록 커서**: `nextCursor`가 공지만 `Long`, 나머지 `String`. → **결정: 공지 커서 Long 유지**(공용 `CursorResponse`를 제네릭화해 공지만 숫자 보존, 형상 무변경). 문자열 표준화는 후속 계약정리 티켓으로 미룸.
3. **bid·settlement Command/Result 유지 경계 승인** (그 외 auction·shop·search 축약).
4. **총괄 자율 기본값 확정**: Command/Result=`dto/` 유지 · 서비스 계산 VO=`service/` 잔류 · `GatewayErrorCode`=`infra/security` 잔류 · `AppProperties`=`infra/config` 잔류.

## 실행 순서 조정 (총괄 팬아웃 재판정)
FC-124(ErrorCode)·FC-125(Properties)는 **동일 서비스 파일의 import를 공유 편집**할 수 있어(한 서비스가 ErrorCode·Properties 동시 참조) 쓰기 파일이 교차한다 → **병렬 아닌 순차**로 진행(FC-124 → FC-125). 계약영향 노트 = `docs/spec/convention-v2-contract-impact.md`.

## reviewer minor 2건 흡수 (RESTRUCTURE done 리뷰 이월)
1. proposal §10(b) 순환규칙 line 375 자기모순(top-level 레이블 + feature-level 패턴 표기) 정정.
2. `TokenBundle` §9.5 분류 편차(service 분류 vs 실제 dto/).

## 근거
On-Race 실소스 조사(2026-07-26), 드리프트 실태(DTO Response37/Request14/Slice6/Result6/View5/Command3/Detail1), docs/board/HANDOVER.md A절.

## 후속 (범위 밖)
feature 단위 순환 강제(레거시 auction↔bid 등 결합 해소 선행) — V2도 top-level 순환 규칙 유지.
