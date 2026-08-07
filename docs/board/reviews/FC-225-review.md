# FC-225 리뷰

## 1차 판정

CHANGES REQUESTED — critical 0, major 2, minor 0.

## 해소 확인

- FC-116 신규 관리자 Controller·API DTO·controller test·SecurityConfig admin matcher·SEARCH_002/003 제거.
- 기존 User.isAdmin/JWT ROLE_ADMIN과 게시판 권한은 유지.
- 검색 코어는 외부 HTTP 매핑 없이 내부 Spring 자산으로만 유지.

## Major

1. 재활성화 후 다시 retired된 인덱스에 과거 timestamp alias가 남으면 cleanup의 anyMatch가 최신 retention 전에 조기 삭제할 수 있다.
2. shutdownNow 후 FAILED 처리한 task가 늦게 반환하면 SUCCEEDED로 덮어쓰고, 실제 종료 전 permit 반환으로 다음 작업과 겹칠 수 있다.

## 재작업 DoD

- 재-retire 시 과거 retired alias를 원자적으로 교체하거나 최신 timestamp만 만료 판단에 사용하고 롤백·재활성화 시나리오를 테스트한다.
- 종료 중 task가 완전히 끝나기 전 permit을 반환하지 않고 FAILED terminal 상태가 후속 완료에 덮이지 않도록 identity/state CAS를 적용해 경합 테스트한다.

## 재작업 결과

- alias 전환 시 구 인덱스의 과거 retired alias를 동일 원자 요청에서 모두 제거하고 최신 timestamp alias 하나만 추가한다.
- v1→v2→v1 롤백→v3 재-retire에서 최신 보존기간 전 유지·이후 삭제·현재 v3 보호를 실제 ES로 검증했다.
- task별 FutureTask 추적과 jobId/state CAS로 FAILED terminal 상태를 늦은 성공이 덮지 못한다.
- 실제 실행 task는 interrupt 후 늦게 반환해도 finally 종료 전까지 permit을 유지한다.
- 검색 전체·ArchUnit, 전체 backend test, Spotless/Checkstyle, diff-check 통과.

## 최종 판정

PASS — critical 0, major 0, minor 0.

## 최종 확인

- 관리자 신규 공개 표면은 완전히 제거되고 기존 ROLE_ADMIN 자산은 보존됐다.
- 재-retire는 최신 timestamp 하나만 원자적으로 남기며 현재 read alias 대상은 삭제하지 않는다.
- 강제 종료 중 늦은 task가 terminal 상태를 덮지 않고 실제 종료 전 permit을 반환하지 않는다.
- 실제 ES retention·경합·화해·JWT 권한·ArchUnit 회귀 테스트가 통과했다.
