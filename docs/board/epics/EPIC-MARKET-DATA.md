---
id: EPIC-MARKET-DATA
type: epic
jira_key: KAN-108
title: 마켓 실데이터화 — 스킬 마스터 확충·스킬명 노출·대량 시드
state: done
children: [FC-097, FC-098, FC-099, FC-100]
gate: null
---
## 게이트3 — Done 승인 (2026-07-22, 사용자)
- reviewer PASS(critical/major 0) + 온디맨드 보안 0건 + 총괄 브라우저 실측(5천 마켓·스킬명 §5 정합·다양가) 후 사용자 Done 승인. FC-097~100 전건 done. **push 완료**(2b64401).
- 후속: FC-101(마켓 성능)·spec §1.4 문서 정정. done 비차단.
## 목표
마켓을 실제처럼 보이게 한다 — (1) **스킬 마스터 확충**(§5 해독표 → `skill_definition` 435 시드), (2) **카드/목록/상세에 스킬명 노출**(현재 "스킬 #{code}" 중립표기 → 효과 서술), (3) **마켓 고정가 매물 5천 건 대량 시드**(로컬 데모). EPIC-SHOP 후속.

## 게이트1 승인 (2026-07-22, 사용자)
- "마켓 대량 데이터 5천 + 스킬 코드 분석대로 스킬명 표시 + 아이템 스킬 마스터 테이블" 지시.
- **제품 결정**:
  1. **스킬명 = §5 효과 서술 그대로**("기존 이름 그대로", 창작 고유명 아님). 표시 형식: 스킬1 줄 [효과] / 스킬2 줄 [효과] [퍼센트]% (예: "트리플샷 33%"). §5 전 435코드 커버.
  2. EPIC-SHOP 먼저 Done + 이 작업은 별도 새 에픽.

## 정본 (재사용/근거)
- **권위 출처 = `docs/spec/references/game-item-skill-format.md §5`**(스킬표 PDF + 실DB 11,601건 해독). 스킬1 100~199·스킬2 200~435 코드→효과. 미사용 코드(198·199·210~299) 존재.
- **마스터 테이블 이미 존재**: `skill_definition`(V6, skill_code UK→name·description). 현재 5건만 시드(V9, 효과와 불일치 임시값) → **435 전량 재시드 필요**.
- 노출 파이프 존재: `ItemInstance.skill1/skill2`(FK skill_definition)·`skillPercent` · `GET /items/{id}`→`ItemSkillResponse{skillCode,name}`(상세만 이름). 카드/목록 뷰(ShopItemView·AuctionItemView)는 **코드만**.
- 프론트: `features/item/skillSlots.ts` `skillLabelOf(skill)= skill.name ?? '스킬 #{code}'` — 이름 주입되면 바로 표시.
- 시드 인프라: `LocalDemoSeeder`(@Profile local·멱등)·`LocalDemoDataService`·V12/V13 대량삽입 패턴·item_template 40종.

## 분해안 (게이트1 승인, architect 델타로 조정 가능)
```
FC-097 architect  스킬 마스터 435 시드 설계(§5→skill_definition·name/description 규칙) + 스킬명 노출 방식 결정(뷰 필드 vs GET /skills) + 5천 시드 설계(LISTED-direct·로컬 데모) → 게이트2 상신
FC-098 backend    skill_definition 435 시드(Flyway) + item 뷰 스킬명(+skillPercent) 노출 + 마켓 5천 로컬 데모 시드
FC-099 frontend   카드/목록/상세 스킬명 표시(skillLabelOf 배선, 스킬1/스킬2 줄·퍼센트) + 대량 무한스크롤/성능 확인
FC-100 reviewer   검수(스킬명 정합·시드 정합·대량 성능·계약 이탈)
```

## 게이트2 — 승인됨 (2026-07-22, 사용자) — FC-097
- **제품 결정**: 스킬명=§5 효과 서술 그대로 · 5천 매물 **다양한 가격 분포**(정렬·필터·무한스크롤 체감).
- **기술 결정(architect 추천 채택)**: G1 노출=뷰에 skill1Name/skill2Name 필드 추가(쿼리 이미 fetch join·N+1 없음) · G2 미사용 코드 시드 제외 · G3 5천=LocalDemoSeeder 확장(로컬 전용, 운영 오염 없음) · G4 마스터=Flyway V16(UPDATE 5+INSERT 239, DELETE 금지).
- **정정**: 실제 스킬 244개(435는 코드 상한). 스키마 무변경(name 필드 2개 additive·nullable). skillPercent 기존 존재.
- **파급**: skill1Name/skill2Name는 공통 블록이라 경매 카드에도 대칭 추가(additive) — EPIC-AUCTION 무접촉·되돌림 없음.

## 온디맨드 보안 리뷰 (2026-07-22, 에픽 완료 직전) — 취약점 0건
- market-data 델타(5db6184·d9b380e)에 스코프. **HIGH/MEDIUM 0건**. 확인: SQL injection 없음(V16 리터럴·bulk INSERT 파라미터 바인딩)·데이터 노출 없음(skill name=비민감 게임 마스터, fee/settle 누출 없음)·인가/인증 변경 없음(뷰 필드·시드뿐)·XSS 없음(표준 JSX 보간)·시드 @Profile(local) 격리.

## 후속
- **FC-101**: 마켓 목록 성능(reviewer minor-1) — ShopCard memo·per-second now 격리 or 가상화. done 미차단.
- spec §1.4 요약 off-by-one(140=50 오기 → §5의 140=45가 정본, V16은 정확) — 문서 정정 권고(reviewer 확인).

## 범위 밖
- 스킬 등급(S/A/B, §7 미확인)·스킬 필터 부활(검색 에픽)·마법 속성 분기 검증 UI · 관리자 콘솔.
