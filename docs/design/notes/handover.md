# 기획/설계 handover (2026-07-14)

성격: 세션 상태 스냅샷 — 파일에 없는 기억만. 정본은 각 파일. 1페이지 이내(D-059).

## 진행 중
- 설계 3종 전부 확정·구현 단계(G4-n) 진입: domain-spec v0.4 / erd v0.5 / api-contract v1.2.
  G1·G2·G3 모두 통과. 기획 핵심 산출물(스펙·ERD·계약) 완결.
- 이후 기획 역할 = 계약 변경 요청(6절) 대응 + 디자인/구현의 도메인 정합 지원. 신규 대형 산출물 없음.

## 대기 중
- design/outbox/022 (등급 제거·응답 스키마 완료 보고, SENT — 회신 불요). 016·020·021 모두 ANSWERED.
- 프론트: api-contract v1.2 복사본 갱신 대기(총괄 전파 체크리스트).
- 디자인: U-004 5색 티어 무효 → 시각 축 재조정(색=속성 4색 추천) 전달 대기(총괄→디자인, D-072).
- 미커밋 다수(스펙 3종·outbox 013~022·inbox-log·notes). 사용자 IntelliJ 커밋 필요(D-061).

## 휘발성 맥락 (핵심)
- 아이템 모델은 원게임 SurvivalProject SQL(user_item)·ItemFusionSkill.cpp 실구조 기반(D-067 원게임 데이터 전면 사용).
  · 타입코드 4자리 = [대분류][중분류/슬롯군][속성][종류]. 등급 자리 없음.
  · itm_skill = 발동확률×1,000,000 + 스킬1×1,000 + 스킬2 → skill1_id/skill2_id/skill_percent.
  · 골드포스(gf_expire_at) = 아이템 자체 발동확률의 시간제 상태. 스킬 발동확률과 별개. 검색 필터만·시세 키 제외(D-066).
  · 등급 개념 없음 — 아이템은 레벨+타입으로만 구분(D-073). grade 축 제거됨.
- D-048 유지: 아이템 세부는 P 발번 금지·총괄 안건화. 아이템 결정 정본 = D-044~047/D-062/D-066/D-073. 도출 근거 노트: notes/erd-item-modeling.md.
- 위치 모델: item_instance.location(INVENTORY/TEMP/LISTED) 디스크리미네이터 + slot_no. 출품=인벤토리에서 제외한 에스크로(INVENTORY→LISTED CAS 단일 승자, 중복 출품 차단). temp_storage 별도 테이블(오버플로우, 상한 없음).
- 네이밍: 경매=auction, 고정가=shop, 주문=sale_order(예약어 order 회피, tb_ 접두어 미도입). sale_order 출처 = source_type+source_id 폴리모픽(B-010 백엔드 수용, 앱 레벨 참조 무결성).
- Flyway: erd §6은 그룹·순서만 규정, 구체 V-번호 채번은 백엔드 정보 공유 동기화(B-012). 도메인 마이그레이션 V3부터(스켈레톤 V1·V2 소비).
- 시드(V4+) taxonomy 멤버·특수스킬 목록·골드포스 세부는 시드 단계에서 원게임 데이터로 확정. 사용자가 데이터 제공 예정.
- ON-HOLD(추적표): 캐시↔게임머니 교환비율, 플랫폼 수수료 정책(sale_order.fee_amount 자리만).
- 규약: D-061 커밋은 사용자 단일 실행(역할은 메시지 블록만 제안, git 대행 금지). D-074 시퀀싱 — 선행 확정 전 착수 금지. D-043 마운트 유령 절단 주의(bash 뷰가 stale일 수 있음 → 호스트 Read 교차검증).
- 보안 게이트 1 통과(S-002). SEC-001~009 계약 반영 완료. SEC-008·011은 구현 게이트 2 표본 검사 이월.

## 재개 필독 (순서)
1. design/notes/handover.md (이 파일)
2. design/inbox-log.md (수신 이력 — 043·046·048까지) · design/decision-log.md (P-001/002/008)
3. design/notes/erd-item-modeling.md (아이템 결정 D-062~073 도출 근거)
4. 확정 스펙: docs/domain-spec.md v0.4 → docs/erd.md v0.5 → docs/api-contract.md v1.2
5. management/decision-log.md (D 최신 D-073·D-074) · decision-index.md
6. management/collaboration-guide.md · templates.md (규약·형식)
