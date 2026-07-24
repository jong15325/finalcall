# 보드 정리 — 미완료 티켓 처분 (2026-07-24)

목적: `review`/`doing`/`todo`에 매달려 있던 미완료 티켓을 증거 기반으로 종결. 사용자 지시("완료처리 안 된 것부터 쳐내자") + general-purpose 조사 에이전트 판정.

배경: 프론트 4번 방향전환의 최종 **EPIC-FE-REBUILD**(사용자 목업 재구축, done)가 그 이전 접근(**EPIC-FE-REDESIGN**·**EPIC-FE-ECME**)의 **UI를 전량 폐기**하고 계약 로직·전송층만 승계. 과거 "이력 보존(닫지 않음)" 결정으로 종결 안 된 티켓들을 이번에 정리.

## DONE (산출물이 현재 코드/문서에 생존 — 실제 완료)
| 티켓 | 근거 |
|---|---|
| **FC-045** (KAN-54) | design-system v0.6 재도출 완료. 현재 정본 v0.6.1의 기반. EPIC-DESIGN-TEMPLATE(done) 소속. |
| **FC-046** (KAN-55) | 1순위 §2.2 정본 모순 해소 → v0.6.1 산출. 2·3순위는 사용자 지시로 React 구현 이월(→재구축 흡수). 티켓 범위 완료. |
| **FC-044** (KAN-53) | 코드사전 게이트2 D1~D5 승인이 `api-contract.md:285-287`·`erd.md:329-355`·`item-domain-spec.md:27-36`에 **실반영**(제안서 아님). |
| **FC-051** (KAN-58) | `frontend/vitest.config.ts` 생존. EPIC-FE-REBUILD가 "vitest는 기반이라 유지" 명문화 → FC-051 자산 승계. |
| **FC-052** (KAN-60) | `db/migration/V12__item_seed_recode.sql` 존재. V14~16(신규 도메인)이 대체 안 함(append-only 무편집). |
| **FC-053** (KAN-62) | `db/migration/V13__auction_bid_demo_seed.sql` 존재(경매20·입찰27·hold27). 대체 없음. |

## CANCELLED (폐기된 접근 잔재 — 대상 소멸/흡수/대체)
| 티켓 | 근거 |
|---|---|
| **FC-039** (KAN-47) | 데모 시드 DoD가 FC-053=V13으로 흡수 집행. |
| **FC-040** (KAN-48) | 점검 대상(REDESIGN 경매 화면)이 REBUILD로 소멸. |
| **FC-047** (KAN-57) | 토큰을 REBUILD가 Tailwind 4로 재소유(FC-067). |
| **FC-048** (KAN-59) | 셸+홈 UI를 REBUILD FC-066~080이 대체. |
| **FC-049** (KAN-61) | 경매 목록·상세 UI 대체. |
| **FC-050** (KAN-63) | 인증 화면 UI 대체. |
| **FC-054** (KAN-64) | 인벤토리·임시보관 UI 대체. |
| **FC-064** (KAN-72) | 티켓 자체가 "SUPERSEDED(2026-07-20)" 명시. UI 폐기, 로직 4파일만 REBUILD 승계. |

## 에픽
- **EPIC-FE-REDESIGN** (KAN-56) → `superseded`. 하위 UI(FC-047·048·049·050·054) cancelled, 인프라/시드(FC-051·052·053)는 생존해 done — 에픽 목표(redesign UI 집행)는 REBUILD가 대체.
- **EPIC-FE-ECME** (KAN-65) — 이미 superseded(변경 없음). 하위 FC-064 cancelled 반영.

## 유지 (의도적 백로그 — 손대지 않음)
- FC-101(마켓 대량 성능)·FC-110(검색 정합성 하드닝) · 신규 백로그 FC-113(메모/쪽지)·FC-114(이메일 인증).

## 추가 재분류 (2026-07-24, 사용자 요청) — done → superseded
EPIC-FE-ECME(superseded) 소속으로 done 도달했으나 산출물이 REBUILD로 폐기된 티켓을 에픽과 정합:
| 티켓 | 근거 |
|---|---|
| **FC-055** (KAN-66) | Ecme 템플릿 이식 UI → REBUILD 폐기 |
| **FC-056** (KAN-67) | API·인증 이식 — 전송/계약 로직은 REBUILD 보존 45파일로 승계, UI만 폐기 |
| **FC-058** (KAN-69) | Ecme 기반 홈/아트 UI → REBUILD 폐기 |
- Jira 상태: 파일상 done이었으나 **Jira엔 미미러 드리프트**였다(KAN-66·67=해야 할 일, KAN-69=검토 중). superseded 재분류와 함께 셋 다 `완료`로 전이해 드리프트 해소.

## 조사 방법
general-purpose 에이전트가 spec 문서·`db/migration`·에픽 파일·`frontend/src` 트리를 대조. 8개 조사 티켓 전건 증거로 done/cancel 판정(KEEP 0). FC-045·046은 총괄이 본문 결과 섹션으로 직접 확인.
