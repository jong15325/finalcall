# EPIC-CONVENTION-V2 최종 리뷰 (게이트3 확인소)

- 대상: EPIC-CONVENTION-V2(KAN-137) 전체 — 규약(FC-123)·ErrorCode 중앙화(FC-124)·Properties 분리(FC-125)·DTO 어휘 축약 8도메인(FC-126)·ArchUnit 신규칙(FC-127).
- 리뷰 커밋 범위: `3d86f89..e8f31e9`(V2 12커밋).
- 판정일: 2026-07-26. reviewer(읽기전용).

## 판정: PASS (critical/major/minor 차단 0)

| 축 | 결론 | 근거 요지 |
|---|---|---|
| **응답 JSON 형상 보존** | ✅ 보존 | 커서 봉투 6종→공용 `CursorResponse<T,C>`(content/nextCursor/hasNext 순서·이름·타입 1:1, notice=Long·나머지=String). View→Response 개명 컴포넌트 순서 동일(record 순서=Jackson 순서 대조). Command/Result 축약 후 서비스가 웹 Response 직접 build, 필드·값 불변. |
| **인가·데이터노출 무회귀** | ✅ 무회귀 | settlement OrderSlice viewerId 마스킹·판매자 전용 NON_NULL, shop MyShop 판매자 전용, item IDOR slot 게이팅 전부 SecurityContext 주체 단일 진실원 유지. |
| **over-fetch 동치** | ✅ 동치 | `CursorResponse.from(fetched,size,mapper,cursorExtractor)` = 구 도메인별 size+1 슬라이싱·hasNext·nextCursor 추출과 경계 3케이스(마지막 페이지·정확히 size·빈 결과) 동치. ES 경로는 `of(...)`로 ES 판정값 보존. |
| **규약·ArchUnit 유효** | ✅ 유효 | `ConventionArchitectureTest` (e)(f)(g) 강제 실행·공허참 아님. 화이트리스트(`FieldErrorDetail` 스코프 제외·`GatewayErrorCode` FQN 제외) 과도성 없음. 구 어휘(`*View`/`*Slice`·feature 루트 ErrorCode/Properties) 잔존 0. |

## 빌드/테스트
- reviewer 환경 Docker 미가용 → `compileTestJava` + `ConventionArchitectureTest`·`SliceArchitectureTest` `--rerun-tasks` green.
- 각 도메인 패스에서 backend-impl이 이미 풀 스위트(`:backend:test`, Testcontainers) green 확인 → 통합 커버리지 확보.

## minor (정보성, 조치 불요)
- auction `getList`/`getDetail`의 display-status 파생 `Instant.now()`를 서비스에서 단일 캡처(구 컨트롤러 2차 호출 대비 스냅샷 일관성 개선) — 형상/회귀 아님.

## 계약 파급
- 응답 JSON 형상 불변 → 프론트/계약서 갱신 불요. 정본 = `docs/spec/convention-v2-contract-impact.md`.
