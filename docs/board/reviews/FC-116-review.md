# FC-116 리뷰

> **역사 기록**: 아래 평가는 2026-08-07 관리자 재색인 API를 한 차례 구현했을 때의 리뷰다. 사용자가 관리자 기능은 전역 아키텍처 계획 후 진행하기로 재확정해 공개 관리자 Controller·DTO·인가 배선은 FC-225에서 전부 롤백했다. FC-116은 관리자 에픽 대기 `todo`이며 아래 PASS는 현재 구현 완료를 뜻하지 않는다.

## 1차 판정

CHANGES REQUESTED — critical 0, major 2, minor 1.

## Major

1. `REBUILD`가 `listings*` 템플릿·분석기·핵심 매핑 적용을 검증하지 않고 count 일치만으로 alias를 전환할 수 있다.
2. 화해 워커의 `isRunning()` 확인과 보정 시작이 원자적이지 않아 관리자 재색인 접수와 TOCTOU 경합이 가능하다.

## Minor

- Elasticsearch 내부 예외 메시지가 관리자 상태 응답의 `error`에 그대로 노출될 수 있다.

## 재작업 DoD

- alias 전환 전에 템플릿 적용과 핵심 매핑/분석기 또는 동등한 검색 sanity를 검증하고 실패 시 기존 alias를 유지한다.
- 화해 보정과 관리자 재색인이 동일한 원자적 실행 가드를 공유해 중첩되지 않게 한다.
- 외부 error는 제한된 단계·요약으로 정규화하고 상세 예외는 서버 로그에만 남긴다.
- 위 실패 경계와 회귀 테스트를 추가한다.

## 재작업 결과

- 정본 `listings-template.json`을 실제 설치하고 `listingType=keyword`, `price=long`, `nameSnapshot=text`, `nori_kr` 분석 토큰을 alias 전환 전에 검증한다.
- 템플릿 누락·오염 시 신규 인덱스 생성이 실패하고 기존 alias가 유지되는 통합 테스트를 추가했다.
- 관리자 job과 화해 보정이 동일 `SearchReindexGuard` 원자 permit을 공유해 TOCTOU를 제거했다.
- API의 job error는 단계별 고정 한국어 요약만 저장하고 상세 예외는 서버 로그에만 남긴다.
- 검색 전체·ArchUnit, 전체 backend test, Spotless/Checkstyle, diff-check 통과.

## 2차 판정

CHANGES REQUESTED — critical 0, major 1, minor 1.

### Major

- 검증이 `nameSnapshot.ngram`/`ngram_kr`와 실제 필터·정렬 핵심 keyword/date/number 매핑 전체를 보장하지 않아 부분 오염된 템플릿으로 alias가 전환될 수 있다.

### Minor

- executor 제출 실패 시 permit은 반환되지만 current job이 영구 `PENDING`으로 남아 후속 요청이 계속 409가 될 수 있다.

### 2차 재작업 DoD

- 실제 검색 쿼리·필터·정렬이 의존하는 핵심 매핑과 analyzer를 모두 전환 전에 검증하고 부분 오염 시 alias 불변을 테스트한다.
- executor 제출 실패 시 job을 롤백하거나 terminal `FAILED`로 전환해 후속 요청이 복구되게 한다.

## 2차 재작업 결과

- `nameSnapshot`의 `nori_kr`, `nameSnapshot.ngram`의 `ngram_kr`와 두 분석기의 실제 토큰을 검증한다.
- 검색 필터·정렬 핵심 keyword 9종, `level=integer`, `price=long`, `gfExpireAt=date`를 alias 전환 전에 검증한다.
- ngram 서브필드 및 `publicId` 타입 부분 오염 시 신규 생성 실패와 기존 alias 불변을 통합 테스트로 고정했다.
- executor 제출 실패 시 current PENDING CAS를 롤백하고 permit을 반환해 후속 요청이 성공한다.
- 검색·ArchUnit, context load, 전체 backend test, Spotless/Checkstyle, diff-check 통과.

## 최종 판정

PASS — critical 0, major 0, minor 0.

## 최종 확인

- 실제 검색 계약의 핵심 매핑·분석기·분석 토큰을 alias 전환 전에 검증한다.
- 템플릿 누락과 부분 오염 시 신규 인덱스를 거부하고 기존 alias를 유지한다.
- executor 제출 거절 시 PENDING과 permit을 복구해 후속 요청이 정상 실행된다.
- 관리자 job과 화해 보정은 동일 원자 permit으로 전체 실행 구간이 배타된다.
- 외부 오류 정규화, count 검증, alias 단일 remove+add, 구 인덱스 보존, catch-up 실패 표현을 유지한다.
- 인가·경합·복구·실제 ES·strict bulk·화해·ArchUnit 테스트가 통과했다.
