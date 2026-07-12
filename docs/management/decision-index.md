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
| D-026 | 통합 추적 표 (보류/블로커/리스크) | ACCEPTED | 총괄 |
| D-027 | 회고 2종 (게이트/사고 blameless) | ACCEPTED | 총괄 |
| D-028 | 병렬 작업 비동기 완료 규칙 3종 | ACCEPTED | 총괄 |
| D-029 | docs git 규약 (main 전용·이벤트 커밋·주체 유동) | ACCEPTED | 총괄 |
| D-030 | 프론트 저장소 git 규약 (계약 동기화 커밋 형식) | ACCEPTED | 총괄 |
| D-031 | 템플릿 증보 5종 (11~15절) | ACCEPTED | 총괄 |
| D-032 | 프론트 스택 (TS·Vite·React SPA·Query+Zustand·Tailwind) | ACCEPTED | 총괄 |
| D-033 | 문서 파일 네이밍 규약 (한글 허용) | ACCEPTED | 총괄 |
| D-034 | 용어집 미도입 (정본 문서 내 용어 섹션) | ACCEPTED | 총괄 |
| D-035 | api-contract 형식 골격 (기술 규약은 백엔드 조기 협의) | ACCEPTED | 총괄 |
| D-036 | erd 형식 골격 (기술 규칙은 백엔드 조기 협의) | ACCEPTED | 총괄 |
| D-037 | 지침 3계층 (킥오프는 부트스트랩만) | ACCEPTED | 총괄 |
| D-038 | 번호 분리: 결정(Q/S-xxx) vs 티켓(QA/SEC-NNN) | ACCEPTED | 총괄 |
| D-039 | 프론트 CLAUDE.md 확정 | ACCEPTED | 총괄 |
| D-040 | QA 파트 지침 확정 | ACCEPTED | 총괄 |
| D-041 | 보안 파트 지침 확정 + 게이트 1 차단 권한 | ACCEPTED | 총괄 |
| D-042 | 컨설턴트 대기 모드 전환 (종료는 G3 후 재검토) | ACCEPTED | 총괄 |
| D-043 | incident-001 정정: 관측 오탐 + 교차 검증 규칙 | ACCEPTED | 총괄 |
| D-044 | 아이템 모델: 서프형 단순화 (마스터+정형 컬럼) | ACCEPTED | 총괄 |
| D-045 | 아이템-판매: template FK + 표시 스냅샷 | ACCEPTED | 총괄 |
| D-046 | 강화·합성 범위 절단 | ACCEPTED | 총괄 |
| D-047 | item_template 고정 시드 (가상 데이터) | ACCEPTED | 총괄 |
| D-048 | 아이템 도메인 설계: 사용자 참여 필수 예외 | ACCEPTED | 총괄 |
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
| C-013 | 통합 추적 표 | ACCEPTED (→D-026) | 컨설턴트 |
| C-014 | 회고 2종 | ACCEPTED (→D-027) | 컨설턴트 |
| C-015 | 병렬 작업 비동기 완료 규칙 | ACCEPTED (→D-028) | 컨설턴트 |
| C-016 | docs git 규약 | ACCEPTED (→D-029) | 컨설턴트 |
| C-017 | 프론트 저장소 git 규약 | ACCEPTED (→D-030) | 컨설턴트 |
| C-018 | 템플릿 증보 5종 | ACCEPTED (→D-031) | 컨설턴트 |
| C-019 | 문서 파일 네이밍 규약 | ACCEPTED (→D-033) | 컨설턴트 |
| C-020 | 용어집 미도입 | ACCEPTED (→D-034) | 컨설턴트 |
| C-021 | api-contract 형식 골격 | ACCEPTED (→D-035, 조기 기동 조건) | 컨설턴트 |
| C-022 | erd 형식 골격 | ACCEPTED (→D-036, 조기 기동 조건) | 컨설턴트 |
| C-023 | 지침 3계층 | ACCEPTED (→D-037) | 컨설턴트 |
| C-024 | 번호 체계 분리 | ACCEPTED (→D-038) | 컨설턴트 |
| C-025 | 프론트 CLAUDE.md 초안 | ACCEPTED (→D-039) | 컨설턴트 |
| C-026 | QA 지침 초안 | ACCEPTED (→D-040) | 컨설턴트 |
| C-027 | 보안 지침 초안 | ACCEPTED (→D-041) | 컨설턴트 |

## 게이트 현황 (D-019)

| 게이트 | 통과 기준 요약 | 상태 | 통과일 |
|---|---|---|---|
| G1 domain-spec 확정 | 기획 초안 + 총괄 검수 + 사용자 승인, ON-HOLD 인덱스 등재 | 진행 중 (주제 5~7 남음) | - |
| G2 erd 확정 | G1 + spec 정합 확인 | 대기 | - |
| G3 api-contract 확정 | 총괄 검수 + 보안 게이트 1 + 사용자 승인 → 백/프론트/QA/보안 기동(백엔드는 G1 직후 기술 규약 협의 모드로 조기 기동, D-035) | 대기 | - |
| G4-n 도메인 구현 | 구현 DoD + QA 시나리오 + defects 처리, 전체 완료 시 보안 게이트 2 | 대기 | - |

## 추적 안건 (D-026: 보류/블로커/리스크)

| 안건 | 유형 | 소유 | 해소 조건 | 상태 |
|---|---|---|---|---|
| 4-C 최종 방식: 단일 TX vs outbox 승격 (D-008 조건) | 보류 | 기획→총괄 | 주제 6 종료 직후 자동 회부 | ON-HOLD |
| 주제 5(아이템 도메인) 논의 | 보류 | 기획 | D-044~047로 종결 | 해소됨(2026-07-12) |
| 컨설턴트 종료 재검토 (현재 대기 모드, D-042) | 보류 | 총괄·사용자 | G3 통과 후 재검토 | ON-HOLD |
| 다중 세션 동시 편집 시 파일 절단(소실 사고 누적 6건) | 리스크 | 총괄 | incident-001 방지 액션 준수 | 감시 중 |
| 원격 푸시 자격증명 부재(총괄 대행 불가) | 블로커 | 사용자 | 로컬 푸시 또는 PAT 결정 | OPEN |
| 프론트 코드 컨벤션 설계 (C-015 착수 금지) | 블로커 | 총괄·사용자 | 프론트 스택 결정 → D-032로 해소 | 해소됨(2026-07-12) |

P-001~002 초기 동기화 완료(2026-07-12). 이후 신규 발번분만 반영.
각주: P-003~007은 void — 규약(D-009) 이전 작업 파일에서 임시 사용됐으나 정식 발번·등재된 적
없음. 소급 발번하지 않고 결번 처리, 재사용 금지. 기획 신규 발번은 P-008부터 (2026-07-12 보고).
