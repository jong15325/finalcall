# FC-179 (EPIC-CARD-SYSTEM T1) 리뷰 — 인벤토리 스킬명 API

- **대상**: `ItemSummaryResponse += skill1Name/skill2Name`(SkillDefinition 노출) + api-contract v1.21
- **리뷰어**: reviewer(읽기 전용) · **일자**: 2026-08-04
- **판정**: **PASS** (critical 0 / major 0 / minor 2) → `review_status: passed`

## 근거
1. **순수 가법** — `ItemSummaryResponse`는 `@Builder`+`from()`만 생성(`new ItemSummaryResponse(` 위치호출 0). 소비자 InventoryResponse·TempStorageItemResponse 무영향. 기존 필드·형상 불변.
2. **N+1 없음** — ItemInstanceRepositoryImpl(:41-42)·TempStorageRepositoryImpl(:31-32) 모두 skill1/2 fetch join. `getName()`은 초기화된 연관 접근(추가 쿼리 없음, OSIV off 안전).
3. **null 폴백** — `getSkill1()==null?null:getName()`(AuctionItemResponse 동일 삼항). 마법 카드 skill1Name=null 대칭. SkillDefinition.name은 nullable=false.
4. **계약** — api-contract v1.21 §4.2 요약 블록에 skill1Name?/skill2Name? 추가(DTO 1:1), 순수 가법·DB 마이그레이션 없음 명시. §3.3은 v1.14 기반영·대칭 참조.
5. **테스트** — SkillExposureIntegrationTest가 GET /me/inventory 전 경로로 실제 스킬명 문자열 **값 단언**(not-null 형식 아님).

## Minor (비차단)
- **M1**: 임시보관(GET /me/temp-storage) skill1Name 직접 테스트 부재(코드 경로는 동일 from+fetch join으로 구조 검증됨). 후속 보강 여지.
- **M2**: 재사용 테스트 파일 Javadoc 헤더가 FC-098 범위만 서술(인벤토리 커버리지 미언급). 문서 정합 minor.

## 설계 전달
- 스킬명 단일 원천 = `SkillDefinition.name`(§3.3 v1.14 + §4.2 v1.21). 신규 응답도 동일 삼항 이식.
- skill1Name 노출은 두 Repository의 `leftJoin(skillN).fetchJoin()`에 의존 — 향후 fetch join 제거 리팩터는 OSIV off에서 LazyInit 유발 가능. 계약 필드의 암묵 전제로 보존 권고.
