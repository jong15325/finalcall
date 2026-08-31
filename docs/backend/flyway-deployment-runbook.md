# FinalCall Flyway Online DDL 배포 Runbook

상태: **v1.0 — FC-416 사용자 보안 게이트2 승인(2026-08-31)**  
소유: backend 운영 절차. 모든 MySQL 8 online DDL Flyway 마이그레이션에 재사용한다.  
예시: V29 `shop` 보조 인덱스 `ix_shop_status_created_at_id(status, created_at, id)` 추가.

## 1. 목적과 경계

이 문서는 운영 MySQL에 인덱스 등 online DDL을 적용할 때의 사전 확인, 중단 판단, 사후 검증, 되돌림 절차를 정한다. 스키마 형상은 `docs/spec/erd.md`, 도메인 성능 의미는 각 domain spec이 정본이며 이 문서는 그 결정을 바꾸지 않는다.

- 대상: MySQL 8 secondary index 추가 등 online 적용을 의도한 append-only Flyway migration.
- 비대상: 데이터 교정, 파괴적 컬럼 변경, 테이블 재작성, DB 제품·메이저 버전 변경. 이 작업들은 별도 게이트2와 전용 runbook이 필요하다.
- 숫자 위조 금지: metadata lock 대기시간, replica lag, CPU·IO·연결 사용률, 오류율·지연의 중단 임계는 배포 전에 운영 기준으로 합의해 아래 실행 기록에 적는다. 이 문서가 근거 없이 숫자를 대신 정하지 않는다.

## 2. 배포 전 입력값과 승인

배포 담당자는 아래 값을 실행 전에 채우고 승인자를 기록한다. 빈 임계로 운영 DDL을 시작하지 않는다.

| 항목 | 합의값 | 출처/승인자 |
|---|---|---|
| 배포 시간대·예상 소요 | `<입력>` | `<입력>` |
| metadata lock 최대 대기 | `<입력>` | `<입력>` |
| replica lag 중단 임계 | `<입력>` | `<입력>` |
| DB CPU 중단 임계 | `<입력>` | `<입력>` |
| DB IO 중단 임계 | `<입력>` | `<입력>` |
| DB 연결 사용률 중단 임계 | `<입력>` | `<입력>` |
| 애플리케이션 오류율 중단 임계 | `<입력>` | `<입력>` |
| 대상 API 지연 중단 임계 | `<입력>` | `<입력>` |
| 최소 디스크 여유 | `<입력>` | `<입력>` |
| 실행자·승인자·관찰자 | `<입력>` | `<입력>` |

## 3. 사전 점검

1. 대상 DB가 계약된 MySQL 8 버전인지 확인한다.
2. 해당 DDL이 대상 버전에서 online secondary-index 추가를 지원하는지 확인한다. 지원 환경에서는 migration에 `ALGORITHM=INPLACE, LOCK=NONE`을 명시해 조용한 COPY·강한 lock 강등을 허용하지 않는다.
3. 장기 실행 중인 transaction과 metadata lock 보유·대기 세션을 확인한다. 해소하지 못한 장기 transaction이 있으면 시작하지 않는다.
4. 데이터·인덱스 크기 대비 임시 공간을 포함한 디스크 여유를 확인한다.
5. replica 상태와 lag, DB CPU·IO, 연결 사용률, 애플리케이션 오류율·대상 API 지연의 배포 전 기준선을 기록한다.
6. 낮은 트래픽 시간대인지 확인한다. 합의한 시간대가 아니면 재승인 없이 시작하지 않는다.
7. Flyway 실행 주체가 하나뿐인지 확인한다. 여러 애플리케이션 인스턴스가 동시에 migration을 시작하지 않도록 배포 순서 또는 전용 migration job으로 단일 실행을 보장한다.
8. migration 파일이 최신 append-only 번호이며 기존 적용 파일을 수정·삭제하지 않았는지 확인한다. fresh migration과 직전 운영 버전에서의 upgrade migration을 사전에 검증한다.

## 4. 실행과 관찰

1. 승인된 단일 Flyway 주체로 migration을 시작한다.
2. 실행 중 metadata lock 대기, 장기 transaction, replica lag, CPU·IO, 연결 사용률, 오류율, 대상 API 지연을 계속 관찰한다.
3. §2에서 합의한 임계 중 하나라도 초과하면 신규 배포 진행을 중단하고 실행 상태를 확인한다. 임계 초과를 무시한 채 다음 애플리케이션 인스턴스를 전개하지 않는다.
4. DDL 취소가 더 큰 위험을 만들 수 있으므로 무조건 세션을 kill하지 않는다. 대상 MySQL의 현재 DDL 단계·atomic DDL 상태·복제 상태를 확인한 뒤 승인자와 중단/대기를 결정한다.
5. 실패·중단 시각, 관측값, DB 오류, Flyway history 상태를 실행 기록에 남긴다.

## 5. 사후 검증

1. Flyway schema history에 기대한 version이 성공 1건으로 기록됐는지 확인한다.
2. `SHOW INDEX`로 인덱스명, 컬럼 순서, 유일성 여부를 계약과 대조한다.
3. production과 같은 predicate·정렬·LIMIT 형상의 `EXPLAIN ANALYZE`로 실제 선택 key, 검사 행 수, filesort 유무를 확인한다.
4. 애플리케이션 health와 대상 API 성공·오류율·지연이 배포 전 기준으로 수렴했는지 확인한다.
5. replica lag와 DB CPU·IO·연결 사용률이 정상 범위로 수렴했는지 확인한다.
6. 결과를 티켓 또는 리뷰 산출물에 기록하되 시크릿·접속 문자열·자격증명은 남기지 않는다.

### V29 적용 예시

- 기대 인덱스: `ix_shop_status_created_at_id(status, created_at, id)`.
- `SHOW INDEX`에서 세 컬럼 순서가 1·2·3인지 확인한다.
- 홈 추천 신규/`GENERAL` 쿼리의 `status=ACTIVE ORDER BY created_at DESC,id DESC LIMIT N` 실행계획이 신규 인덱스를 사용하고 별도 정렬을 만들지 않는지 확인한다.
- 마감 후보의 기존 `ix_shop_status_end_at`과 검증 판매자 쿼리 형상이 바뀌지 않았는지 회귀 확인한다.

## 6. 실패와 롤백

- 이미 적용된 migration 파일을 수정·삭제하거나 checksum을 맞추기 위해 덮어쓰지 않는다.
- 신규 인덱스가 기능 정확성을 해치지 않고 쓰기 비용만 문제라면 즉시 코드 롤백과 결합하지 말고 영향과 안전한 제거 시점을 먼저 판단한다.
- 제거가 필요하면 기존 migration을 되돌리지 않고 **후속 append-only Flyway migration**에서 대상 인덱스만 `DROP INDEX`한다. DROP도 같은 online DDL 사전 점검과 중단 기준을 적용한다.
- 실패한 DDL이 atomic하게 정리됐는지, 인덱스가 존재하는지, Flyway history가 어떤 상태인지 먼저 확인한 뒤 repair 또는 후속 migration 여부를 결정한다. 근거 없이 `flyway repair`를 실행하지 않는다.

## 7. 실행 기록 템플릿

```text
대상 환경/DB 버전:
Flyway version·파일:
실행자/승인자/관찰자:
시작/종료 시각:
사전 기준선과 합의 임계:
실행 중 최대 관측값:
중단 여부와 사유:
SHOW INDEX 결과 요약:
EXPLAIN ANALYZE 결과 요약:
health·오류율·지연·replica 수렴:
후속 조치:
```
