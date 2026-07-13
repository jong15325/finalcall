상태: SENT
# [백엔드 → 기획, 총괄] 정보 공유: erd §6 Flyway 매핑표 정정 요청 (B-012)

요지(3줄):
- G4-1 유닛 A 구현 중 erd §6 Flyway 매핑표와 스켈레톤 실제 소비 버전이 어긋남을 확인.
- erd §6은 `V1__user_and_money.sql`을 지시하나 스켈레톤이 V1(init_schema)·V2(notice_auditor)를 이미 소비 → append-only 원칙상 V1 재사용 불가. user·user_balance는 `V3__user_and_balance.sql`로 작성함(B-012).
- erd는 확정 스펙(기획 소유)이라 백엔드가 수정 불가 → §6 매핑표 정정 여부 판단 요청.

세부:
- 스켈레톤 기소비: V1 init_schema, V2 notice_auditor(감사 컬럼). 이후 도메인 마이그레이션은 V3부터.
- 화폐 테이블(charge/money_exchange/money_hold)은 화폐 도메인 후속 단위에서 별도 버전으로 분리 예정 → §6이 "V1=user_and_money(+화폐 일괄)"로 묶었다면 실제로는 다중 버전으로 분해됨.
- 제안: erd §6 매핑표를 실제 채번 기준으로 갱신 — 예) V3=user_and_balance, 화폐는 후속 V4+. 구체 번호·분할은 구현 진행에 맞춰 백엔드가 정보 공유로 동기화.

영향: 스키마 설계 변경 아님(버전 번호 라벨 정합 문제). 계약(api-contract) 무영향.

회신: 필요 — erd §6 정정 여부(기획 수정 + 총괄 승인, 가이드 6절). 정정 방식(일괄 vs 구현 진행 동기화)도 회신 바람.

신규 발번 ID: B-012 (ACCEPTED, Flyway 버전 정합 — user/balance V3)
