# 공통 배경 다중 시안

## 공통 제작 조건

- 제작 방식: 내장 ImageGen을 사용한 원본 게임 PNG·SPR 기반 리이미징
- 화면 비율: 16:9 와이드 배경
- 레이아웃: 중앙 약 55%는 흰색 콘텐츠 프레임이 올라가도 복잡하지 않도록 저밀도로 구성
- 제외 요소: 텍스트, 로고, UI 패널, 워터마크
- 활용 원칙: 원본 스프라이트를 그대로 확대하지 않고 캐릭터 실루엣, 프레임 동작, 지형 구조, 룬과 이펙트의 시각 언어를 새 장면으로 재구성

## 시안 목록

### 캐릭터 대결

- 파일: `mockups/assets/common-background-variants/character-duel-v1.png`
- 원본 계열: `game/character/character1.png + .spr`, `game/character/character10.png + .spr`, `global/background/back03.png`
- 방향: 좌우 캐릭터를 크게 배치하고 중앙 콘텐츠 영역을 비운 전투 직전 구도

### 캐릭터 여정

- 파일: `mockups/assets/common-background-variants/character-journey-v1.png`
- 원본 계열: 캐릭터 프레임, `sanctuary_bg.png`, `village_bg.png`, 부유섬 지형
- 방향: 양쪽 원정대가 서로 다른 지역에서 출발하는 밝은 모험 월드

### 아이템·스킬 이펙트

- 파일: `mockups/assets/common-background-variants/item-effects-v1.png`
- 원본 계열: `fusion_back_circle.png + .spr`, `magic_zone.png + .spr`, `fury_effect.png + .spr`, 장비 카드 이미지군
- 방향: 장비 실루엣과 룬, 속성 광원을 주인공으로 삼은 마법 공방형 배경

### MMORPG 월드맵

- 파일: `mockups/assets/common-background-variants/world-map-v1.png`
- 원본 계열: `forest_quest_bg.png`, `village_bg.png`, `sanctuary_bg.png`, 부유섬·다리 지형
- 방향: 숲, 마을, 성소, 산악 지역을 연결한 아이소메트릭 온라인게임 월드맵

### 던전 아틀라스

- 파일: `mockups/assets/common-background-variants/dungeon-atlas-v1.png`
- 원본 계열: `dungeon_quest_bg.png`, `ancient_dragon_bg.png`, `magic_zone.png + .spr`, 성소 지형
- 방향: 미궁, 용암 던전, 고대 유적, 물의 폐허를 한 화면에 배치한 던전 선택 지도

### 몬스터 레이드

- 파일: `mockups/assets/common-background-variants/monster-raid-v1.png`
- 원본 계열: 캐릭터 프레임, `stone_golem.png + .spr`, `magic_zone.png + .spr`, 부유 유적
- 방향: 캐릭터 원정대와 골렘 군단이 대치하는 밝은 레이드 전장

### 다중 지역 월드

- 파일: `mockups/assets/common-background-variants/multi-region-world-v1.png`
- 원본 계열: 숲 미궁, 고대 용암 지역, 성소, 마법 지대
- 방향: 네 개 지역을 포털과 다리로 연결하고 중앙을 콘텐츠 영역으로 비운 공통 월드 배경

## 적용 전 처리

현재 파일은 디자인 선택용 고해상도 PNG다. 실제 프론트 적용 시 선택된 시안만 AVIF 또는 WebP 파생본으로 최적화하고, 모바일용 크롭과 저사양 정적 강등본을 별도로 만든다. SPR 프레임은 배경 원본으로 직접 전송하지 않고 Canvas/CSS 동작의 타이밍과 궤적 참고 자료로 사용한다.

## World Map 확장 시리즈

기준 시안 `world-map-v1.png`의 밝은 아이소메트릭 MMORPG 월드와 중앙 콘텐츠 안전영역을 유지하면서, 속성별 지형 구조와 이동 동선을 별도로 설계했다.

- `world-map-fire-v1.png`: 화산 성채, 용암 강, 흑요석 지대, 붉은 수정 광산, 마그마 던전
- `world-map-water-v1.png`: 산호 도시, 계단형 폭포, 수중 폐허, 석조 수로, 소용돌이 던전
- `world-map-earth-v1.png`: 거대 석상, 테라스형 고원, 협곡, 수정 광산, 매몰 신전
- `world-map-wind-v1.png`: 풍차 군도, 구름 항구, 비공정, 바람길, 사이클론 관문
- `world-map-elemental-crossroads-v1.png`: 불·물·흙·바람 네 왕국을 포털로 연결한 교차 월드
- `world-map-dungeon-expedition-v1.png`: 용암 제련소, 수몰 수정궁, 석조 미궁, 공중 탑을 배치한 던전 원정 지도

모든 시안은 텍스트·로고·UI 없이 제작했고, 중앙 약 55%는 흰색 콘텐츠 프레임을 위한 저밀도 구름 영역으로 유지했다.
