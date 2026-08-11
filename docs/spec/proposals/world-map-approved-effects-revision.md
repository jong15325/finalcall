# 세계지도 공통 배경 승인 효과 이식 변경안 v0.1

- 상태: **PROPOSED — 영향 확인·게이트2·디자인 게이트 대기**
- 변경 대상 계약: `docs/spec/world-map-common-background-contract.md` v0.1
- 시각 정본: `docs/ux/mockups/auction-detail-immersive-background.html`
  (`wind=b`, `fire=c`, `earth=c`, `water=c`)
- 기반 자산: `docs/ux/mockups/assets/common-background-variants/world-map-v1.png`
- 구현 금지: 이 제안서는 `frontend/**` 수정 권한을 부여하지 않는다.

## 1. 사용자 피드백과 변경 결론

신규 `world-map-region-effects.html`의 A~D 효과 어휘는 폐기한다. 세계지도용 효과를 새로 발명하지 않고,
이미 승인·구현 검증된 상세 배경의 네 속성 효과를 동일한 primitive·밀도·궤적 계열로 이식한다.

- wind: 승인안 `b`의 curved ribbon·회전 궤적
- fire: 승인안 `c`의 glow·flame·흔들리는 상승
- earth: 승인안 `c`의 mineral·crystal·완만한 drift
- water: 승인안 `c`의 낙하·impact ripple·jet

`world-map-v1.png`에는 독립된 물 권역이 없으므로 기존 성소나 폭포를 물 권역이라고 재해석하지 않는다.
효과를 얹기 전에 **물 지형이 포함된 world-map-v1 파생 자산**을 새로 만든다. 권장 배치는 우하단 성소 주변을
확장한 수로·연못·얕은 폭포 권역이며, 기존 산악·숲·마을의 실루엣과 중앙 콘텐츠 안전영역은 보존한다.

## 2. 계약 델타 초안

사용자 승인 후 `world-map-common-background-contract.md`를 다음처럼 고친다.

1. 비교 목업 정본을 `world-map-region-effects.html`의 A~D 선택지가 아니라 **승인 상세 효과 4종을 동시에
   배치한 단일 합성 목업**으로 변경한다.
2. 자산 기준을 기존 `world-map-v1.png` 단독에서 `world-map-v1` 구도 + 신규 물 권역 파생본으로 변경한다.
   신규 파생본은 별도 파일명을 사용하며 원본을 덮어쓰지 않는다.
3. hotspot을 `earth`, `wind`, `fire`, `water` 네 권역으로 재정의한다. 좌표는 신규 이미지가 확정된 뒤
   목업 실측값으로 기록하며 현재 v0.1의 산악·숲·마을·성소 좌표를 구현 상수로 승격하지 않는다.
4. A/B/C 강도 선택은 제거한다. 시각 motif는 상세 계약의 확정 조합을 고정하고, 공통 배경에서는 밀도와
   알파만 콘텐츠 가독성에 맞게 낮춘다. motif나 궤적을 다른 효과로 바꾸지 않는다.
5. 모든 AppShell route의 base scene owner는 하나로 유지한다. 상세 `element`는 해당 권역 강조, neutral route는
   네 권역을 낮은 밀도로 동시에 표시한다. `/auctions` static water는 water 권역 강조로 흡수한다.
6. 단일 Canvas·단일 RAF, DPR 1.5, visibility 정지, reduced-motion/update:slow/forced-colors 강등,
   자산 전송량 상한은 기존 초안과 `element-detail-background-contract.md`의 더 엄격한 값을 유지한다.

## 3. 목업 수정 방향

다음 디자인 게이트 제출물은 효과 선택기가 아니라 **한 장면의 합성 검증 도구**다.

- 배경: 신규 물 권역을 포함한 world-map 파생 이미지
- 동시 효과: 네 권역에 승인 효과를 모두 배치
- 검증 토글: `전체`, `wind`, `fire`, `earth`, `water`, `reduced motion`만 제공
- 콘텐츠 plane: 실제 AppShell과 같은 불투명 흰 평면을 유지해 outer gutter에서의 식별성과 대비를 확인
- 모바일: 390px cover crop에서도 물 권역과 최소 두 다른 권역이 식별되도록 focal position 제공
- 금지: 기존 A~D 신규 효과 재사용, 단순 radial glow로 승인 particle을 대체, 기존 성소에 water 라벨만 부착,
  상세 효과와 공통 효과를 별도 Canvas/RAF로 중복 실행

물 권역 자산이 준비되기 전 임시 CSS 도형으로 최종 디자인 승인을 받지 않는다. 자산 생성 단계에서는 기존
`world-map-v1`의 구도·채도·아이소메트릭 시점을 기준 이미지로 사용하고, 산호 도시처럼 장면 전체를 바꾸는
`world-map-water-v1.png`는 공통 배경 대체재로 쓰지 않는다.

## 4. 영향받는 티켓 목록

확정 계약 변경 전 사용자 확인이 필요한 목록이다. 완료 티켓은 이력을 수정하지 않고 파생 티켓에서 대체 관계를
추적한다.

### 직접 영향

- `FC-232`: 승인 상세 목업과 네 효과 motif의 근거. 변경하지 않고 새 목업의 시각 정본으로 참조한다.
- `FC-233`, `FC-237`, `FC-239`, `FC-240`~`FC-244`: route-scoped 속성 scene·Canvas·효과 parity.
  공통 scene 이식 시 소유권·좌표·밀도 회귀 대상이다.
- `FC-248`, `FC-251`, `FC-252`: AppShell background layer와 상세 통합. 공통 owner로 대체되는 직접 범위다.
- `FC-257`, `FC-258`, `FC-259`, `FC-260`: `/auctions` water scene·opaque region·route cleanup.
  static water를 세계지도 water 권역 강조로 흡수할 때 직접 회귀한다.

### 회귀 영향

- `FC-249`, `FC-250`: 공개·보호 route 공통 배경 노출과 기능 무관성.
- `FC-254`: stacking·scroll·overlay 순서.
- `FC-256`: 경매 상세 region과 배경 경계.

### 신규 파생 티켓 제안

- `FC-261` architect: 본 변경안 승인 결과를 두 선행 계약의 대체 조항으로 확정
- `FC-262` frontend-impl: 물 권역 포함 world-map 파생 자산과 responsive/optimized variants 제작
- `FC-263` frontend-impl: 승인 상세 효과 4종의 공통 단일 Canvas 이식 목업 제작·디자인 게이트
- `FC-264` frontend-impl: AppShell 단일 scene owner와 route accent 통합
- `FC-265` reviewer: 접근성·성능·route cleanup·stacking 회귀
- `FC-266` reviewer: 승인 목업 parity·물 권역 crop·최종 통합 검증

## 5. 문서 영향

- 직접 변경: `world-map-common-background-contract.md` §1~§5, §7~§8
- 대체/정합 표시: `element-detail-background-contract.md` §2~§7
- 대체/정합 표시: `horizontal-app-shell-contract.md` §1, §5~§7
- 디자인 기록: `common-background-variants.md`의 world-map 파생 자산 설명
- 목업: `world-map-region-effects.html`은 기각 이력으로 보존하거나 파일 상단에 DEPRECATED를 표시하고,
  새 승인 이식 목업을 별도 파일로 만든다.

API 계약, ERD, 백엔드, item element wire 값, 거래 동작은 바뀌지 않는다.

## 6. 게이트2 선택지와 추천

| 선택지 | 내용 | 장점 | 위험 |
|---|---|---|---|
| A | 기존 world-map 이미지에 성소를 water로 간주하고 승인 효과만 이식 | 자산 작업 최소 | 사용자 지적 미해소, 시각·의미 불일치 |
| **B (추천)** | 기존 구도를 보존한 파생 이미지에 물 권역을 추가하고 승인 효과 4종 이식 | 피드백 충족, 상세/공통 시각 언어 통일 | 자산·crop 재검증 필요 |
| C | `world-map-water-v1` 등 다중 지역 이미지를 새 공통 배경으로 교체 | 물 지형이 분명 | 기존 승인 구도·중앙 안전영역·다른 권역 연속성 상실 |

추천은 **B + 모든 AppShell route 단일 owner**다. 사용자 확인 전에는 기존 spec, 보드 상태, 프런트 코드를
수정하지 않는다. 확인 후 architect가 계약을 DECIDED로 갱신하고 디자인 게이트용 목업·자산 티켓을 연다.
