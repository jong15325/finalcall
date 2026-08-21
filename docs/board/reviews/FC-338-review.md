# FC-338 리뷰

- 티켓: FC-338 / KAN-382
- 판정: passed
- 일자: 2026-08-21
- critical: 0건
- major: 0건
- minor: 0건

## 확인 결과
- Kafka fan-out consumer는 양 app에서 `chat.kafka.consumer.enabled`로 독립 유지된다.
- 전역 outbox/Kafka lag monitor와 `collection.age` gauge는 active collector 한 곳에서만 활성화된다.
- 첫 실제 수집 성공 전 age는 `NaN`이며, 실패 시 마지막 성공 시각을 보존해 stale 경과가 증가한다.
- monitor 비활성 replica에는 age gauge가 없어 가짜 stale alert와 topology 오판이 발생하지 않는다.
- Linux workflow는 app1 monitor 존재·app2 monitor 부재·Kafka consumer group member 2개를 부하 전에 fail-fast 검증한다.
- 설정 누락·consumer-only·monitor-only 조합과 비활성 replica metric 부재 테스트가 추가됐다.
- artifact 수집·시크릿 검사·PID ownership teardown은 기존 안전 계약을 유지한다.

## 검증
- 관련 단위 테스트 5개 클래스 통과.
- `checkstyleMain`, `checkstyleTest`, `spotlessCheck` 통과.
- backend-impl의 `bootJar`, `git diff --check` 통과 증거를 확인했다.

## 원격 부팅 회귀와 재판정
- run `32444494562`에서 두 backend가 `ChatEventPipelineMetrics` 생성자를 선택하지 못해 `No default constructor found`로 부팅 실패했다. fixture와 부하는 실행되지 않았다.
- production 생성자에 `@Autowired`를 명시하고 실제 `ApplicationContextRunner` 기반 설정 조합 테스트로 교체했다.
- monitor 설정 누락·consumer-only에서는 monitor 빈과 age gauge가 없고, monitor-only에서는 빈과 gauge가 생성됨을 확인했다.
- fan-out consumer의 독립 `chat.kafka.consumer.enabled` 계약과 workflow의 monitor 1개·consumer 2개 assertion은 유지된다.
- 재리뷰 결과 critical 0건, major 0건, minor 0건으로 passed다.
- 관련 채팅 테스트 4개 클래스와 `checkstyleMain`, `checkstyleTest`, `spotlessCheck`를 캐시 없이 재실행해 통과했다.

## 원격 topology 검증기 재판정
- run `32445323757`에서 backend 생성자 부팅 회귀는 해소됐으나, 라벨이 붙은 Prometheus metric을 라벨 없는 형식으로만 검사해 topology 단계가 실패했다.
- 같은 run의 artifact scan은 실제 값이 없는 `Authorization` 문구까지 탐지하는 오탐으로 artifact 업로드를 차단했다.
- `verify-ci-topology.sh`는 metric family 뒤 라벨 유무를 모두 허용하고 app1 monitor 1개·app2 0개·Kafka consumer 2개를 수치로 검증한다.
- `scan-ci-artifact.py`는 실제 Authorization header 값·Bearer·JWT·runtime secret만 bytes로 탐지하고 실패 시 파일명·패턴 종류만 출력한다.
- secret scan과 teardown의 `always()` 계약, scan 성공 후에만 artifact를 업로드하는 계약은 유지된다.
- 재리뷰 결과 critical 0건, major 0건, minor 0건으로 passed다.
