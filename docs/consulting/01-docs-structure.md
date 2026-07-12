# 영역 1 설계안: docs 폴더 체계

상태: PROPOSED (총괄 회부 전, 사용자 피드백 대기)
소유: 컨설턴트 · 2026-07-12
결정 항목: C-001 ~ C-005 (consulting/decision-log.md 정본, 이 문서는 분석·상세)

---

## 1. 진단 (실물 근거)

총괄 실사 4건을 검증했고 3건을 실물로 확인, 추가 문제 2건을 발견했다.

| # | 진단 | 실물 근거 | 판정 |
|---|---|---|---|
| 1 | 문서 유형 혼입 | design/decision-log.md에 결정이 아닌 내용 혼재: "주제 4 파생 메모", "주제 5 분석"(P번호 없는 산문), 문서 머리의 "논의 순서" 줄 | 확인 |
| 2 | 프롬프트 위치 규약 부재 | 기획: design/prompts/escalation-prompts.md(발신 프롬프트 누적 + 회신 상태). 총괄: management/prompts/(킥오프 프롬프트 보관). 같은 이름 prompts/가 서로 다른 유형을 담음 | 확인 |
| 3 | docs 루트 오염 | spring-skeleton-prompts.md(백엔드 작업 문서)가 루트에 위치. D-003 "루트 = 확정 스펙" 위반 | 확인 |
| 4 | 파트별 지침 공백 | backend/ frontend/ qa/ security/ 폴더 자체가 미생성. 프론트/QA/보안 지침 전무 | 확인 (영역 5에서 해소) |
| 추가 A | 깨진 참조 | CLAUDE.md가 `docs/skeleton-prompts.md`를 참조하나 실제 파일은 `docs/spring-skeleton-prompts.md` | 신규 발견 |
| 추가 B | 유령 ID | design/decision-log.md 주제 5에 "이전 P-007 초안 … 미채택" 언급. 그러나 P 로그·인덱스에 P-003~007이 없음. 미채택 결정이 무번호로 소멸 — "기각도 기록"(4절 정신) 위반 | 신규 발견 |

추가 B 처리 제안: 기획이 P-007 전후 사정을 확인해 소급 발번 여부를 자율 결정하도록
총괄이 전달(소급 재작성 금지 원칙이 있으므로 강제하지 않음. 최소한 인덱스 각주로 이력 명시).

## 2. 제안 요약

### 2.1 문서 유형 6종과 기준 등급 (C-001)

| 유형 | 위치 | 변경 규칙 | 기준(authority) |
|---|---|---|---|
| 1 확정 스펙 | docs 루트 | 계약 변경 절차(6절) | 최상위 — 전 역할의 작업 근거 |
| 2 지침 | management/, 각 저장소 CLAUDE.md, 파트 지침 | 소유 역할 + 총괄 승인 | 행동 규약 |
| 3 결정 로그 | <role>/decision-log.md | 항목 불변, 상태 라벨만 갱신 | ACCEPTED만 근거 가능 |
| 4 작업 노트 | <role>/notes/ | 자유 | 근거 인용 금지(참고만) |
| 5 전달 프롬프트 | <role>/outbox/ | 발신 후 상태 줄만 갱신 | 이력(감사 추적) |
| 6 보고·트래킹 | decision-index.md, defects.md, findings.md 등 | 소유 역할 갱신 | 현황 공유 |

### 2.2 목표 폴더 구조 (C-002)

```
docs/
├── domain-spec.md · erd.md · api-contract.md    # 유형 1만. 그 외 파일 금지
├── management/                                   # [총괄]
│   ├── collaboration-guide.md                    # 유형 2 (전 역할 필독)
│   ├── decision-log.md                           # 유형 3 (D-xxx)
│   ├── decision-index.md                         # 유형 6 (마스터 인덱스)
│   ├── prompts/                                  # 킥오프 프롬프트 보관 (management 전용)
│   ├── notes/ · outbox/
├── design/ backend/ frontend/ qa/ security/     # [각 역할] 표준 구조
│   ├── decision-log.md                           # P/B/F/Q/S-xxx
│   ├── notes/                                    # 작업 노트
│   ├── outbox/                                   # 발신 프롬프트 (NNN-주제.md)
│   └── (역할 고유 산출물: test-plan.md, findings.md 등 폴더 루트)
└── consulting/                                   # [컨설턴트, 한시] 동일 구조
```

- 프론트 저장소(별도): docs/api-contract.md 복사본(헤더에 원본 경로·버전, D-007 유지) +
  frontend CLAUDE.md. 결정 로그·노트·outbox는 백엔드 저장소 docs/frontend/로 일원화
  (문서 허브를 한 곳으로 유지 — 2저장소 분산 시 인덱스 유지 불가).

### 2.3 읽기 규칙 재설계 (C-003, supersedes 가이드 3절 읽기 규칙)

- 기본 열람: 필독 문서(확정 스펙, D 로그, 가이드, 자기 폴더)만 상시. 타 역할 폴더 상시 탐색 금지.
- 필요 기반 열람(pull): 작업에 필요한 맥락이 있으면 사유를 갖고 열람 가능, 산출물에 출처 표기.
  예외 규칙(defects.md·findings.md 특례)은 불필요해져 삭제.
- 기준: 확정 스펙 > D 로그(ACCEPTED) > 자기 로그 > 타 역할 로그(맥락) > 노트(인용 금지).
- 타 역할 노트에서 얻은 맥락은 산출물에 "미확정 참고"로 표기.
- 쓰기 규칙은 현행 유지: 자기 폴더에만 쓴다.

### 2.4 미결 결정 포인트 회답

| 포인트 | 제안 | 근거 |
|---|---|---|
| 전달 프롬프트 이력 | outbox 보관, 삭제 금지 (C-004) | 감사 추적의 반쪽. 비용 0, 기획이 이미 실천 중 |
| spring-skeleton-prompts.md | backend/notes/로 이동 + CLAUDE.md·README 경로 정정 (C-005) | 루트 순수성. 경로는 이미 깨져 있어 수정 필수 |
| 파트 지침서 형태 | 영역 5로 이월 | 지침 계층 설계와 분리 불가 |

## 3. 회사 프로세스에서 덜어낸 것

- Diátaxis 4분류 그대로 도입하지 않음 — 사용자 문서용 분류라 운영 문서에 과잉. 원리만 차용.
- ADR 도구체계(adr-tools, MADR 템플릿, PR 리뷰 승인 플로우) 미도입 — 기존 4절 티켓 규약이
  이미 ADR의 핵심(불변·상태·기각 대안)을 갖췄고, 도구는 1인 구조에 과잉.
- docs-as-code의 브랜치/PR 기반 문서 리뷰 미도입 — 리뷰어가 없는 1인 구조에서는
  총괄 검수 프롬프트가 PR 리뷰를 대체.
- 유형별 최상위 디렉토리 분리(모노레포식 docs/rfcs, docs/runbooks 등) 미도입 —
  역할 소유권이 1차 축인 현 구조가 "자기 폴더에만 쓴다" 규칙과 정합.

## 4. 마이그레이션 (영역 1분, 최종 체크리스트에 통합 예정)

| 순서 | 작업 | 담당 |
|---|---|---|
| 1 | docs/spring-skeleton-prompts.md → docs/backend/notes/ 이동 | 사용자(git mv) |
| 2 | CLAUDE.md 참조 경로 정정(2곳: 머리말, 섹션 2) + README.md 말미 링크 | 백엔드 대화 제안 → 사용자 커밋 |
| 3 | design/prompts/ → design/outbox/ 개명. escalation-prompts.md는 동결 보관(분할 금지) | 사용자(git mv) |
| 4 | design/decision-log.md에서 주제 4·5 산문을 design/notes/topic-4.md, topic-5.md로 분리, 로그에는 참조 1줄 | 기획 대화 |
| 5 | collaboration-guide.md 3절 개정(열람 자유 + 기준 규칙, 폴더 다이어그램 갱신) | 총괄 |
| 6 | P-007 유령 ID 사정 확인 → 소급 발번 또는 인덱스 각주 | 기획 자율 |

## 5. 레퍼런스

- Diátaxis framework — https://diataxis.fr/ (유형 혼합이 혼란의 최대 원인이라는 원리)
- ADR 프로세스 — AWS Prescriptive Guidance, Architectural decision records / M. Fowler bliki:
  불변성, Superseded 상태, 기각 대안 기록
- docs-as-code 토폴로지 — passo.uno "Docs-as-code topologies", Home Office Engineering
  docs-as-code 패턴: 저장소가 단일 진실, 규칙적 폴더 구조
- GitLab Handbook 문화 — 기본 공개 + 정본(single source of truth) 명시 원칙
