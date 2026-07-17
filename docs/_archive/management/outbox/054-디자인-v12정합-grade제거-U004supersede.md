상태: ANSWERED → ux/outbox/005 (grade 제거·U-004 SUPERSEDE→U-010 완료, 검수 통과)
# [총괄 → 디자인] 작업 지시: v1.2 정합 — grade 축 제거·U-004 SUPERSEDE (D-073)

목표: 디자인 산출물을 계약 v1.2·D-073(등급 축 제거)에 정합한다. 047(등급 색 재조정 통지)의 적용분.

완료 기준:
- design-system.md §2.3 grade 토큰·GradeBadge 컴포넌트 제거(또는 속성 축으로 대체).
- U-004(grade 색) SUPERSEDED 처리(대체 결정 ID 명시). 등급 색 축 폐기.
- 재조정 방향(기획 가이드, 047): 색 = 속성 4색(물/불/흙/바람) 매핑, 레벨 = 숫자, 골드포스 = 잔여
  시간, 스킬 = 태그. 등급/희귀도 표현 없음.
- inbox-log의 "등급 확정 대기"는 오해다 — 등급은 확정이 아니라 제거(D-073). 정정 반영.

의존: D-073(ACCEPTED)·api-contract v1.2. 착수 가능.

하지 말 것: 계약·서버 도메인 변경(불가). 비주얼 방향·테마 최종 확정(총괄+사용자, D-072).
상류 조율은 이제 프론트 기획(PF, D-077) 경유.

관련 문서: docs/api-contract.md §3·§3.3, management/outbox/047, decision-log D-073, frontend-planning/screen-spec.md.

회신: 필요 — 완료 보고(정합 결과·SUPERSEDE ID).
