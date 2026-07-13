# 백엔드 inbox-log (처리한 수신 메시지, D-023)

| 처리일 | 메시지 | 처리 내용 |
|---|---|---|
| 2026-07-13 | mgmt/outbox/029 조기 기동·기술 규약 협의 지시 (D-035) | 백엔드 첫 기동. 폴더 표준 구조 부트스트랩(decision-log/inbox-log/outbox). 기술 규약 협의 착수 — 안건1(네이밍)부터. 확정분은 D-024 정보 공유로 기획·총괄 전달 예정 |
| 2026-07-13 | mgmt/outbox/030 B-008 회신 D-064(MSA 채택) | VOID 처리(031로 롤백·대체). 발신 이력만 참고, 실효 없음 |
| 2026-07-13 | mgmt/outbox/031 B-008 최종 회신 D-065(단일 서비스 유지, D-064 롤백) | 최종 결정: 안건1(A) 단일 서비스·게이트웨이 없음, 안건2(A) 서비스 JWT 검증(SecurityContext)·X-User-Id 미도입. B-008 상태 superseded-by D-065 갱신, outbox/002 ANSWERED. 사용자 식별 규약 SecurityContext로 확정(B-009), 003 보류 해소. 회신 outbox/004 |
| 2026-07-13 | design/outbox/014 아이템 ERD 결정 요청(기획→총괄) — B-001~009 인용 | 백엔드 앞 아님(총괄 대상). D-024 정합 확인: 안건4 owner_id FK+public_id(ULID)/내부 id = B-004 정합, 안건1·2 정형 컬럼 인덱스 = B-006 정합, 안건5-2 CAS 단일승자 = 정합. 내 규약 올바르게 적용, 액션 없음(참고) |
| 2026-07-13 | mgmt/outbox/039 G3 통과 전파(전역할) — 구현 단계 진입 | api-contract v1 확정. 백엔드 G4-n 착수(auth 우선, notice 참조 컨벤션), SCG 엣지 게이트웨이 확장(D-068), 구현 순서·분해는 총괄 협의. 확정 스펙(domain-spec/erd/api-contract) 재동기화 필요. 적용 확인 완료 |
| 2026-07-13 | design/outbox/016 sale_order 다형 출처 참조 정합(기획→백엔드) | B-001 물리 FK 예외 판단 필요. 수용: source_type+source_id 폴리모픽(출처 2테이블→단일 물리 FK 불가). 조건=앱 레벨 참조 무결성+((source_type,source_id) 인덱스. B-010 발번, 회신 outbox/005 |
