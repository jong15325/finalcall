# Survival Project 공통 배경 소스 분석

## 전수 인벤토리

- 분석 루트: `D:/private_server/SP/gameserver/Survival-project-PGF-decompressor-main/src/images`
- PNG: 8,319개
- SPR: 1,600개
- XML: 691개
- MAP: 94개
- PNG 상위 분포: `interface` 3,865개, `game` 3,459개, `global` 985개
- PNG는 모두 RGB truecolor이며 파일 자체 alpha/tRNS가 없다. 투명 합성 시 SPR/게임 엔진의 color-key 규칙을 함께 고려해야 한다.

## SPR 구조

1,600개 SPR을 little-endian binary로 끝까지 파싱했으며 잔여 바이트는 없었다.

1. 파일명 길이 `int32`
2. 파일명 byte sequence
3. unused 또는 color-key 후보 `int32`
4. frame count `int32`
5. frame별 source rectangle 4×`int32`
6. frame별 보조 rectangle 2세트
7. frame별 보조 좌표 2×`int32`

동일 stem PNG가 1,599개 SPR에 존재한다. 유일한 예외는
`game/card/weapon4/shield.spr`이다.

## 공통 배경 선별 기준

- 불·물·흙·바람 한 속성으로 치우친 카드 효과 제외
- 텍스트·로고·공지 UI가 포함된 완성 화면 제외
- 넓은 화면에서 좌우 실루엣이 살아 있고 중앙 콘텐츠 가독성을 확보할 수 있는 소스 우선
- SPR 프레임에서 배경용 ambient motion으로 재해석할 수 있는 원형·룬·자연 오브젝트 우선

## 최종 합성 입력

- `global/background/back03.png`: 부유 섬과 암반 실루엣
- `interface/room/room_back/sanctuary_bg.png`: 고대 성소와 원형 공간 구조
- `interface/fusion/fusion_back_circle.png` + `.spr`: 19프레임 중립 룬 애니메이션 언어

## 보조 후보

- `game/map/map6/magic_zone.png` + `.spr`: 11프레임 고대 원형 지형
- `game/char_npc/small_tree.png` + `.spr`: 22프레임 자연 포인트
- `game/effect/fury_effect.png` + `.spr`: 21프레임 ambient glow 참고
- `game/effect/next_level_effect.png` + `.spr`: 16프레임 상승 효과 참고
- `interface/room/room_back/forest_quest_bg.png`: 숲 지형 팔레트
- `interface/room/room_back/village_bg.png`: 밝은 중립 마을 팔레트

## 생성 결과

- 파일: `docs/ux/mockups/assets/finalcall-common-bg-v1.png`
- 용도: 불투명 흰 콘텐츠 프레임 뒤의 공통 full-viewport 배경
- 구성: 밝은 공중 섬, 고대 성소, 구름층, 절제된 청색 룬
- 중앙 55%는 콘텐츠 가독성을 위해 낮은 대비·낮은 디테일로 유지
- 캐릭터, 몬스터, 텍스트, 로고, UI 프레임, 특정 속성 상징은 제외
