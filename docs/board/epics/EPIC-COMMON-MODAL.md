---
id: EPIC-COMMON-MODAL
type: epic
jira_key: KAN-408
title: 프론트 모달 공통 시스템 전수 적용
state: review
owner: main
children: [FC-359, FC-360, FC-361]
gate: null
review_status: pending
artifacts:
  - frontend/src/components/common/AppModal.tsx
  - frontend/src/components/common/AppModalButton.tsx
---
## 목표 / DoD / 검증
- 운영 화면의 개별 모달을 공통 `AppModal` 조립식 셸로 전환한다.
- 모든 모달 액션은 `primary`·`secondary`·`danger` 공통 버튼 역할만 사용한다.
- PC 중앙 모달, 모바일 바텀시트, 닫기·포커스·스크롤·중첩 모달 동작을 보존한다.
- 관련 테스트, 타입 검사, UI 시스템 검사와 390px·1280px 브라우저 회귀 검증을 통과한다.
