상태: SENT
# [총괄 → 프론트] 작업 지시: v1.2 정합 — grade 필터 제거 (D-073)

목표: 프론트 산출물을 계약 v1.2·D-073(등급 축 제거)에 정합한다.

완료 기준:
- notes/screen-route-map.md §4 grade 필터 제거. 공통 목록 필터는 계약 §3 기준
  (mainCategory·subGroup·element·kind·minLevel/maxLevel·skill1/skill2·goldforceActive·minPrice/maxPrice·status — grade 없음).
- §3.3 응답 스키마(v1.2)에 화면 데이터 매핑 정합.

의존: api-contract v1.2·D-073. 착수 가능.

하지 말 것: 계약 직접 수정(6절 요청). 프론트 기획(PF, D-077) screen-spec와 어긋나면 PF 경유 정합.

관련 문서: docs/api-contract.md §3·§3.3, frontend-planning/screen-spec.md, decision-log D-073.

회신: 필요 — 완료 보고.
