---
id: EPIC-MARKET-DATA
type: epic
jira_key: KAN-108
title: 마켓 실데이터화 — 스킬 마스터 확충·스킬명 노출·대량 시드
state: doing
children: [FC-097, FC-098, FC-099, FC-100]
gate: null
---
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

## 게이트2 — 예정 (architect가 FC-097에서 상신)
- 스킬명 노출 방식(item 뷰에 skill1Name/skill2Name+skillPercent 필드 추가 vs GET /skills 딕셔너리)·skill_definition 435 시드 데이터 규칙(name=효과 서술·미사용 코드 처리)·5천 시드 프로파일 격리(로컬 데모 vs 마이그레이션, 운영 오염 회피).

## 범위 밖
- 스킬 등급(S/A/B, §7 미확인)·스킬 필터 부활(검색 에픽)·마법 속성 분기 검증 UI · 관리자 콘솔.
