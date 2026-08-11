# Survival Project 이미지 자산 인벤토리

기준 경로: `D:/private_server/SP/gameserver/Survival-project-PGF-decompressor-main/src/images`

목적: FinalCall 목업·화면에 사용할 배경과 애니메이션의 시각 문법을 파악하기 위한 읽기 전용 조사 기록이다. 원본 자산을 웹에 그대로 복제하기 위한 목록이 아니며, 실제 적용 시에는 사용자가 지정한 자산만 별도 파생한다.

## 전체 규모

| 형식 | 파일 수 | 용도 |
|---|---:|---|
| PNG | 8,319 | 배경·맵·캐릭터·NPC·UI·효과 아틀라스 |
| SPR | 1,600 | PNG 아틀라스의 프레임 좌표·순서 |
| XML | 691 | 맵·모드·배치 데이터 |
| MAP | 94 | 맵 데이터 |
| 합계 | 10,704 | 약 272.6 MiB |

PNG 8,319개는 모두 이미지 헤더를 읽을 수 있음을 확인했다.

## 상위 자산군

| 자산군 | 전체 | PNG | SPR | 해석 |
|---|---:|---:|---:|---|
| `game/card` | 1,379 | 689 | 690 | 마법·무기·카드 효과. PNG/SPR 쌍이 거의 1:1 |
| `game/map` | 1,283 | 1,060 | 129 | 지형·배경·오브젝트·환경 애니메이션 |
| `game/character` | 396 | 254 | 142 | 플레이어 캐릭터와 아바타 프레임 |
| `game/char_npc` | 410 | 210 | 200 | 대형 NPC·몬스터 프레임 |
| `interface/global` | 1,884 | 1,456 | 158 | 공통 창·버튼·상태 UI |
| `interface/game` | 901 | 699 | 11 | 인게임 HUD·알림·메뉴 |
| `interface/lobby` | 471 | 447 | 3 | 로비·방·맵 선택·경매 UI |
| `interface/room` | 546 | 358 | 10 | 대기실·방 정보 UI |
| `global/background` | 7 | 7 | 0 | 하늘·산·공중섬·구름 레이어 |

## 확인된 시각 문법

- 밝은 청색·시안 하늘과 흰 구름을 큰 면으로 사용한다.
- 지형은 황록·에메랄드·청록을 강하게 분리하고, 나무와 바위는 둥글고 두꺼운 형태다.
- 공중섬은 밝은 잔디 상단과 짙은 갈색·회색 암석 하단의 대비로 읽힌다.
- 맵은 위에서 내려다본 프리렌더드 2D 구성이며, 크로마키 청색 영역을 게임 렌더러가 투명 처리한다.
- 캐릭터·NPC는 한 PNG에 다수 동작 프레임을 배치하고 SPR이 프레임 경계를 정의한다.
- 마법 효과 역시 PNG 아틀라스와 SPR의 결합이며, 검은 바탕은 가산 합성으로 처리되는 자산이 있다.
- 전반적으로 매끈한 최신 애니메풍보다 2000년대 한국 캐주얼 액션 RPG 특유의 손으로 칠한 질감과 높은 채도를 가진다.

## 속성별 PNG 분류

| 속성 | 관련 PNG | 핵심 시각 언어 |
|---|---:|---|
| 바람 | 383 | 청록 구체, 깃털형 돌기, 흰 유선, 옅은 금색 중심광 |
| 불 | 389 | 주황·백색 불꽃, 둥근 화염 생명체, 불티, 화산 지형 |
| 흙 | 371 | 황금빛 큐브, 먼지, 황록·청록 숲, 석조 구조물 |
| 물 | 371 | 진청·시안 파동, 백색 중심광, 물방울, 원형 수면 |

분류는 전체 PNG의 상대 경로에서 속성 토큰을 식별한 결과다. 대표 검토군은 `game/npc/element`, `game/card/magic1~9`, `game/card/weapon1~9/<element>`, `game/map`이다.

## 배경 설계에 사용한 대표 근거

- `global/background/back01.png`: 밝은 시안 하늘과 구름
- `global/background/back03.png`: 공중섬·잔디·암석 단면
- `game/map/map1/ground.png`: 황록·청록 숲과 둥근 바위의 프리렌더드 질감
- `game/map/map6/ground.png`: 석조 원형 경기장과 청록 조명
- `interface/login/login_back.png`: 별·우주 모티프와 강한 청색 대비
- `game/character/character1.png`: 작은 비율의 캐주얼 캐릭터와 동작 아틀라스 구조

## FinalCall 적용 원칙

- 원본 맵이나 캐릭터를 배경으로 그대로 확대하지 않는다.
- 게임의 색·질감·공중섬 문법을 바탕으로 독자적인 넓은 배경을 제작한다.
- 거래 패널 뒤 중앙 55~60%는 낮은 대비와 낮은 디테일로 비운다.
- 움직임은 별빛·구름·환경 오브젝트처럼 저속 배경 레이어에 한정한다.
- 캐릭터 또는 스킬 애니메이션은 실제 게임 의미를 확인한 뒤 사용하고, 장식 목적으로 오용하지 않는다.
- `prefers-reduced-motion`에서는 대표 프레임 또는 정적 배경으로 대체한다.

## 속성 상세 배경 v3 지정 맵

| 속성 | 원본 폴더 | 리이미징 핵심 | 환경 효과 |
|---|---|---|---|
| 바람 | `map1`, `map6` | 숲길, 흰 디딤돌, 원형 석조 제단과 기둥 | 대각선 공기 궤적, 상승하는 잎 |
| 불 | `flame`, `map5`, `map8` | 붉은 마법 타일, 화염 장식, 용암 지평선 | 상승 불씨, 가장자리 열기 아지랑이 |
| 흙 | `map7`, `map4` | 원형 석재 포장, 고대 수로 타일, 뿌리와 유적 | 부유 먼지, 느린 낙엽 그림자 |
| 물 | `map3`, `map2` | 황금 목선, 청록 수면, 푸른 수정 동굴 | 상승 기포, 이동하는 수면 광택 |

v3는 원본 PNG를 직접 배경으로 확대하지 않고, 지형의 형태·재질·구도를 참고해 16:9 상세 화면용 장면으로 재구성했다. 공통 목록 배경은 이 단계의 범위에서 제외한다.

## 환경 효과 비교안

| 속성 | A | B | C |
|---|---|---|---|
| 바람 | 산들바람 | 나선 돌풍 | 상공 기류 |
| 불 | 잔불 숨결 | 불꽃 상승 | 용암 맥동 |
| 흙 | 햇빛 먼지 | 지면 파동 | 고대 수호 |
| 물 | 맑은 기포 | 수면 윤슬 | 잔잔한 소용돌이 |

환경 효과는 입자의 속도·수명·회전·힘 방향을 조합하는 게임 파티클 시스템의 원리를 참고하되, 웹 목업에서는 Canvas와 CSS 합성 레이어로 가볍게 재현한다. Canvas 갱신은 `requestAnimationFrame`과 프레임 시간 차이를 사용하고, 고해상도 화면에서는 DPR을 최대 2로 제한한다. 모션 감소 환경에서는 애니메이션을 정지한다.

- MDN Canvas 기본 애니메이션: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations
- MDN Canvas 최적화: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Unity Particle System 개요: https://docs.unity3d.com/2018.3/Documentation/Manual/PartSysWhatIs.html
- Unity VFX 학습 경로: https://learn.unity.com/pathway/creative-core/unit/creative-core-vfx

### 선택안과 정교화

- 선택안: 바람 B `나선 돌풍`, 불 C `용암 맥동`, 흙 C `고대 수호`, 물 C `낙수 물방울`.
- 바람 B는 나뭇잎 아이콘의 반복을 제거하고, 회전 벡터장에 반응하는 굵기가 다른 공기 리본과 미세 부유물로 변경했다.
- 물 C는 파도 레이어를 제거하고, 배 오른쪽 수면으로만 굵은 물방울이 낙하해 왕관형 물 튐과 두 겹의 타원형 수면 고리를 만드는 효과로 변경했다.
- 참고: Unity VFX Graph Vector Field Force https://docs.unity3d.com/Packages/com.unity.visualeffectgraph@10.5/manual/Block-VectorForceField.html
- 참고: Unity Water 셰이더의 서로 다른 방향·크기·속도 파형 합성 https://docs.unity3d.com/2018.3/Documentation/Manual/HOWTO-Water.html
