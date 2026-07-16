# FinalCall 현황

생성: 2026-07-16 · 생성자: 총괄
**뷰 — 정본은 outbox/·handover. 어긋나면 정본이 맞다. 근거 인용 금지.**

> **전 파트 작업 중단 중**(사용자 지시). 범위 = ① 코드 유지 ② 앞으로 진행할 작업은 삭제·재설계
> ③ 불필요한 규칙·규약 파일 삭제. **재설계 범위가 확정되기 전까지 아래 "시작 전"은 전부 착수 금지.**

## 재설계 (사용자 지시)

| 상태 | 무엇 | 누가 | 경로 |
|---|---|---|---|
| 완료 | 초기화 1차 집행 — 구 체계 규약·킥오프·미착수 지시 19건 삭제 + 죽은 참조 9곳 정정 | 총괄 | `management/inbox-log.md` 2026-07-16 |
| 완료 | 체계 축 종료 — 규약 156 → 100 감축, 컨설턴트 대기 모드 | 컨설턴트 | `consulting/outbox/_broadcast/002`·`004` |
| 완료 | B-1 `_archive/` 이관 — 죽은 규약 초안 2건 | 컨설턴트 | `consulting/outbox/REFORM/004` |
| 완료 | 확정 스펙 3종 `docs/spec/` 이동 | 기획 | `design/outbox/REFORM/001` |
| **시작 전** | **재설계 범위 확정 — 코드 이후 설계를 어디까지 다시 그리나** | 사용자·총괄·컨설턴트 | — |
| **시작 전** | **`spec/` 3종(v0.5 / v0.7 / v1.4)을 살릴지 다시 그릴지** | 사용자 결정 | — |

## MEMBER 도메인 (재설계 종속 — 중단)

| 상태 | 무엇 | 누가 | 경로 |
|---|---|---|---|
| 완료 | auth 4종 · 게이트웨이(SCG) · V3·V4 마이그레이션 · member 재배치(023) | 백엔드 | `backend/outbox/019`·`021`·`031`·`033` |
| 완료 | 024 잔액 조회 · 025 게이트웨이 엣지 핸들러 — **코드 커밋·빌드 그린** | 백엔드 | `backend/notes/cc-reports/024`·`025` |
| 진행 중 | 024·025 완료 보고 미발신(025는 단독 발신 가능) · 이슈1(인증 주체 식별 위치) 판정 보류 | 백엔드 | `backend/notes/handover.md` |
| 대기 | 029 프로필 조회(CC 미투입) · 프로필 수정 · 탈퇴 — **재설계 확인 전 착수 금지** | 백엔드 | `management/outbox/MEMBER/001` |
| 대기 | RETEST-1·2(엣지 포맷) — 백엔드 025 완료 통지가 트리거 | QA | `qa/defects.md` |
| 대기 | QA-S-MBR-01~04 — 백엔드 member 3유닛 완료가 트리거 | QA | `qa/scenarios/003` |

## 프론트 레인 (사용자 지시로 대기)

| 상태 | 무엇 | 누가 | 경로 |
|---|---|---|---|
| 완료 | 스켈레톤 scaffold 완주 — 코드 `D:\Java\finalcall-frontend`, repo 미생성 | 프론트 | `frontend/notes/cc-reports/006` |
| 진행 중 | U-020 토큰 교체 1건 | 프론트 | `frontend/notes/handover.md` |
| 대기 | `frontend/outbox/009` → 디자인 — 드롭인 블록 공백 2건(`focus-ring` 값·`primary.fg`) | 프론트 | `frontend/outbox/009` |
| 대기 | 호스트 Glob 거짓 0건 — 총괄 격상 **미발신** | 프론트 | `frontend/notes/handover.md` |

## 디자인 (D-091 자율 — 미차단)

| 상태 | 무엇 | 누가 | 경로 |
|---|---|---|---|
| 완료 | 색 토큰 실측 확정(U-020, design-system v0.2) · 와이어프레임 auth·member·wallet | 디자인 | `ux/outbox/016`·`009` |
| 시작 전 | 게임 스킨 목업(`mockups/game-skin.html`) — 상거래 카드 언블록됨 | 디자인 | `ux/notes/handover.md` |

## 대기 — 사용자 앞

| 무엇 | 누가 기다리나 | 경로 |
|---|---|---|
| **재설계 범위·시점·주체** | 총괄·컨설턴트·기획·백엔드 전원 | — |
| QA 구동 시점("추후 다시 말하겠다") | 컨설턴트 | `consulting/notes/handover.md` |
| ON-HOLD 3종 — 캐시↔게임머니 교환비율 · 플랫폼 수수료 · 인증 세션 persist | 기획·백엔드·보안 | `design/notes/handover.md` |
| `gold_force` 18개 자산 실제 용도(낮은 우선순위, 블로커 아님) | 디자인 | `ux/notes/handover.md` |

## 막힌 것

- **재설계 범위 미확정** — 백엔드 029·프로필 수정·탈퇴, 기획 `spec/` 3종, item 이후 전 도메인이 여기 걸려 있다.
- **프론트 저장소 미접근** — 코드가 `D:\Java\finalcall-frontend`(별도 저장소)라 총괄이 실물을 못 본다.
  프론트 handover 기준으로만 판단 중이다.
- **파트 지침 4종이 실재하지 않는 절을 가리킨다** — `qa/qa-guide.md:14` → `templates 15`(현행 [1]~[14]).
  아무도 막히지 않아 조치 미배치. `consulting/outbox/REFORM/004` [2].
