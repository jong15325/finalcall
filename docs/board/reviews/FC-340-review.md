# FC-340 리뷰

- 판정: `passed`
- reviewer: reviewer
- 검토일: 2026-08-21

## 결과

- critical/major/minor 없음
- Hikari 32/32와 connection timeout 1초는 성능 workflow의 두 backend JVM에만 적용된다.
- app별 실제 pool 32, 총 64와 MySQL max_connections 96 이상·reserve 32 이상을 부하 전에 fail-fast 검증한다.
- MySQL thread/connection/abort와 Hikari acquire/usage/pending/timeout 시계열이 artifact에 포함된다.
- runtime secret 노출 없이 실패 후 artifact scan·upload·teardown 흐름이 유지된다.

## 검증

- workflow YAML 파싱 통과
- Prometheus label 포함 pool 32 판정 통과
- MySQL 96/reserve 32 경계 통과, 95/reserve 31 실패 확인
- 필수 telemetry·설정 정적 검증 통과
- `git diff --check` 통과
