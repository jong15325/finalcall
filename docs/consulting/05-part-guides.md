# 영역 5 설계안: 파트별 지침 체계

상태: PROPOSED (사용자 방향 확정, 총괄 회부 대기)
소유: 컨설턴트 · 2026-07-12
결정 항목: C-023 ~ C-027 (consulting/decision-log.md 정본)

---

## 1. 지침 3계층 (C-023)

| 계층 | 문서 | 내용 | 개정 경로 |
|---|---|---|---|
| 1 공통 | collaboration-guide.md, templates.md | 프로세스·형식 (전 역할) | 총괄 |
| 2 파트 | 백엔드: CLAUDE.md(기존) / 프론트: 프론트 repo CLAUDE.md / QA: docs/qa/qa-guide.md / 보안: docs/security/security-guide.md | 코드·작업 컨벤션 | 소유 역할 + 총괄 승인(D-014 유형 2) |
| 3 킥오프 | management/prompts/ | 부트스트랩만: 역할 정의·필독 목록·첫 작업 | 총괄 |

형태 결정(미결 포인트 회답): 지침은 파일, 킥오프는 부트스트랩. 킥오프에 지침을 통합하면
개정 시 프롬프트 재발급 + 기동된 대화는 낡은 규칙 — 파일이면 게이트 동기화로 갱신.
백엔드(짧은 지시 + CLAUDE.md)가 이미 검증한 모델.

킥오프 부트스트랩 골격(계층 3 표준):

```
너는 FinalCall의 <역할> 담당이다.
필독: docs/management/collaboration-guide.md, templates.md, <계층 2 지침>, 확정 스펙(경로)
결정은 <접두어>-xxx로 자기 로그에. 에스컬레이션 4기준·메시지 형식은 가이드 준수.
첫 작업: <작업 지시 메시지 경로 또는 요약>
```

## 2. 번호 체계 분리 (C-024, D-025 조건 회답)

| 체계 | 용도 | 수명 모델 |
|---|---|---|
| Q-xxx / S-xxx | 결정 로그 (티켓 규약 4절) | 항목 불변, 상태 라벨만 |
| QA-NNN / SEC-NNN | 결함·발견 티켓 (defects.md/findings.md) | OPEN → FIXED/WONTFIX 상태 갱신 |

분리 이유: 결정은 불변 기록, 결함은 상태가 변하는 작업 항목 — 한 시퀀스에 섞으면
로그 불변 원칙과 결함 상태 갱신이 충돌.

## 3. 파트 지침 초안 3종 (C-025~027)

| 초안 | 이관 위치 | 핵심 |
|---|---|---|
| draft-frontend-claude.md (C-025) | 프론트 repo 루트 CLAUDE.md | D-032 스택, feature 구조, 서버/클라이언트 상태 분리(TanStack Query/Zustand), 계약 1:1 API 함수, git D-030 |
| draft-qa-guide.md (C-026) | docs/qa/qa-guide.md | 리스크 기반 1페이지 플랜, 동시성 4건(D-008) 필수 시나리오, 기대 결과에 계약 근거 인용 의무, QA-NNN 흐름 |
| draft-security-guide.md (C-027) | docs/security/security-guide.md | 게이트 2회 절차(게이트 1은 G3 차단 권한), STRIDE-lite 위협 모델 표, 도메인 리스크 축 6개, SEC-NNN 흐름, Critical 미해결 시 게이트 통과 불가 |

## 4. 덜어낸 것

- 프론트: Airbnb 스타일 가이드 전문 채택 등 대형 린트 규정집 — ESLint/Prettier 기본 +
  지침의 원칙 수준으로 축소(도구 세부는 스켈레톤 구축 시 F-xxx).
- QA: IEEE 829 테스트 문서 체계 — 1페이지 리스크 기반 플랜으로 대체.
- 보안: ASVS 전면 준수·정식 STRIDE 워크숍 — 체크리스트 수준 + 도메인 축 6개로 축소.

## 5. 레퍼런스

React 피처 기반 구조·상태 분리(Robin Wieruch, ReactBlueprint, TanStack 공식 논의),
리스크 기반 테스트(BrowserStack)·1페이지 플랜(QA Touch/TestLodge),
OWASP Threat Modeling Cheat Sheet·Security Culture(STRIDE-lite), OWASP ASVS(참조용).
