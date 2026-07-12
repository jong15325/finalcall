# FinalCall 결정 마스터 인덱스

전체 역할의 결정 ID 목차. 내용의 단일 진실은 각 역할 로그이며 이 표는 목차다. (D-011)
- D: docs/management/decision-log.md
- P: docs/design/decision-log.md
- C: docs/consulting/decision-log.md (한시)
- B: docs/backend/ · F: docs/frontend/ · Q: docs/qa/ · S: docs/security/ (대화 시작 시 생성)

| ID | 제목 | 상태 | 소유 |
|---|---|---|---|
| D-001 | 설계 문서 확정 순서 (spec → erd → contract) | ACCEPTED | 총괄 |
| D-002 | 도메인 설계를 인증 설계보다 우선 | ACCEPTED | 총괄 |
| D-003 | 문서 폴더 규약 | ACCEPTED | 총괄 |
| D-004 | 입찰 규칙 4건 (계단식/자격/소프트클로즈/buyNow) | ACCEPTED | 총괄 |
| D-005 | 경매 생명주기·상태 전이 5건 | ACCEPTED | 총괄 |
| D-006 | 협업 체계: 5역할 구성과 결정 위임 | ACCEPTED (읽기 규칙 부분 SUPERSEDED → D-016) | 총괄 |
| D-007 | 도구 구성과 프론트엔드 저장소 분리 | ACCEPTED | 총괄 |
| D-008 | 동시성 정책 4건 (DB 최종보증/CAS/단일TX/직렬화) | ACCEPTED | 총괄 |
| D-009 | 결정 로그 세분화: 1항목=1결정 | ACCEPTED | 총괄 |
| D-010 | 결정 로그 상태 라벨 도입 | ACCEPTED | 총괄 |
| D-011 | 마스터 인덱스 + ID 보고 규칙 | ACCEPTED | 총괄 |
| D-012 | 컨설턴트 역할 신설 (한시, C-xxx) | ACCEPTED | 총괄 |
| D-013 | 보안 파트 신설 (S-xxx, 게이트 2회) | ACCEPTED | 총괄 |
| D-014 | 문서 유형 6종 분류 체계 | ACCEPTED | 총괄 |
| D-015 | 역할 폴더 표준 구조 (log/notes/outbox) | ACCEPTED | 총괄 |
| D-016 | 읽기 규칙: 필요 기반 열람 (구 참조금지 대체) | ACCEPTED | 총괄 |
| D-017 | 전달 프롬프트 outbox 보관 | ACCEPTED | 총괄 |
| D-018 | docs 루트 순수성 (스켈레톤 프롬프트 이동) | ACCEPTED | 총괄 |
| D-019 | 단계 게이트: 진입·통과 기준 명문화 | ACCEPTED | 총괄 |
| D-020 | 메시지 유형 4종 표준 | ACCEPTED | 총괄 |
| D-021 | 복붙 최소화 3규칙 (묶음/동기화 앵커/왕복 1회) | ACCEPTED | 총괄 |
| D-022 | 이벤트 기반 리추얼 3종 | ACCEPTED | 총괄 |
| D-023 | outbox 메시지 버스 (파일 기반 전달) | ACCEPTED | 총괄 |
| D-024 | ID 소유자 통지 규칙 (push+pull) | ACCEPTED | 총괄 |
| D-025 | 표준 템플릿 패키지 10종 | ACCEPTED | 총괄 |
| P-001 | 판매 방식 모델링 구조 (C안) | ACCEPTED | 기획 |
| P-002 | 즉시구매가/시작가 제약 (buyNowPrice > startPrice) | ACCEPTED | 기획 |
| C-001 | 문서 유형 6종 정의 | ACCEPTED (→D-014) | 컨설턴트 |
| C-002 | 역할 폴더 표준 내부 구조 | ACCEPTED (→D-015) | 컨설턴트 |
| C-003 | 읽기 규칙 재설계 (pull 열람) | ACCEPTED (→D-016) | 컨설턴트 |
| C-004 | outbox 보관, 삭제 금지 | ACCEPTED (→D-017) | 컨설턴트 |
| C-005 | 스켈레톤 프롬프트 이동 + 경로 정정 | ACCEPTED (→D-018) | 컨설턴트 |
| C-006 | 단계 게이트: 진입·통과 기준 명문화 | ACCEPTED (→D-019) | 컨설턴트 |
| C-007 | 메시지 유형 4종 표준 (가이드 5절 확장) | ACCEPTED (→D-020) | 컨설턴트 |
| C-008 | 복붙 부담 최소화 3규칙 | ACCEPTED (→D-021) | 컨설턴트 |
| C-009 | 동기화: 이벤트 기반 리추얼 3종 | ACCEPTED (→D-022, 로그 복구 조건) | 컨설턴트 |
| C-010 | outbox 메시지 버스: 파일 기반 전달 | ACCEPTED (→D-023, 하이브리드 조항) | 컨설턴트 |
| C-011 | 정보 비대칭 방지: ID 소유자 통지 규칙 | ACCEPTED (→D-024) | 컨설턴트 |
| C-012 | 표준 템플릿 패키지 10종 | ACCEPTED (→D-025) | 컨설턴트 |

## 게이트 현황 (D-019)

| 게이트 | 통과 기준 요약 | 상태 | 통과일 |
|