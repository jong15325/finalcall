---
id: EPIC-CARD-INFO-CONTRACT
type: epic
jira_key: KAN-414
title: 카드정보 서버 계산 응답 통합
state: doing
owner: main
children: [FC-366, FC-367, FC-368, FC-369]
gate: null
review_status: pending
artifacts:
  - docs/spec/api-contract.md
  - backend/src/main/java/com/finalcall/domain/item
  - frontend/src/features/item/components
---
## 목표
- 카드 명칭·채널 제한·블랙/골드·남은 골드포스 일수를 서버가 공통 계산해 모든 카드정보 소비처에 같은 응답으로 제공한다.

## 완료 기준
- 승인된 additive `cardInfo` 계약을 경매·마켓·인벤토리·아이템 응답에 일관되게 적용한다.
- 프론트의 동일 파생 계산을 제거하고 직접·간접 카드정보 소비처를 전수 치환한다.
- 기존 거래 스냅샷과 API 필드는 호환용으로 보존한다.
- reviewer 통합 판정을 통과한다.

## 게이트
- 게이트1·게이트2 사용자 승인: 2026-08-23.
