# Member 기본 캐릭터 프로필 스펙

> 상태: **v1.1 — APPROVED** (2026-08-22, FC-352 변경 계약 사용자 승인)
> 작성: 2026-08-22, EPIC-MEMBER-CHARACTER / FC-352
> 외부 계약: `api-contract.md` v1.32 · 스키마: `erd.md` v2.3

> v1.1 변경: 프리미엄 캐릭터 13..24를 선택·저장 범위에서 제거했다. 허용 ID는
> `{1..12, 25..28}`이며 API wire와 PATCH 부분 수정 의미는 v1.0과 동일하다.

## 1. 목적과 범위

회원이 기본 캐릭터 12개와 Avatar 4개 중 하나를 기본 캐릭터로 지정하고, 사이트의 회원 프로필 표시가 그 캐릭터에
대응하는 16종 프로필 이미지를 사용하게 한다. 마이페이지에서 선택·변경하며 기존 회원과 신규 회원의
기본값은 캐릭터 1이다.

범위는 회원 `user.primary_character_id`, 내 프로필 조회·수정, 헤더·마이페이지·채팅·게시판·쪽지의
프로필 표시와 정적 자산 동기화다. 게임 계정/캐릭터 DB 연동, 캐릭터 소유권·잠금·과금, 임의 이미지 업로드는
범위 밖이다.

## 2. 용어와 식별자

- `primaryCharacterId`: 선택 가능한 기본 캐릭터 ID. 정수 집합 `{1..12, 25..28}`이며 회원마다 항상 하나 존재한다.
- `profileCharacterId`: 프로필 이미지 16종의 ID. 서버가 별도 저장하지 않고 아래 함수로 파생한다.
- 선택 자산: ID 1..12는 캐릭터별 `*_normal`/`*_click`(Xyrho는 `*_nomal`/`*_nomal_click`) 자산,
  ID 25..28은 `ch_{25..28}_avatar_normal.png`/`*_click.png`만 허용한다. normal/nomal은 기본 표시,
  click은 mouse hover/focus-visible 표시다.
- **제외 자산:** 프리미엄 ID 13..24의 `ch_*_btn_1_*`와 파일명이 `ch_*_btn_2_*`인 모든 자산은
  동기화·UI·테스트 fixture·fallback에서 완전히 제외한다.
- 프로필 자산: `uc_01_xyrho.png`부터 `uc_16_avatar.png`까지 16개다.

백엔드 API는 `primaryCharacterId`만 전달한다. 정적 자산 URL·파일명은 프론트가 이 스펙의 결정적 매핑으로
구성하며, 서버/DB에 URL이나 `profileImageKey`를 중복 저장하지 않는다.

## 3. 자산 매핑 정본

### 3.1 매핑 함수

```text
profileCharacterId(primaryCharacterId) =
  1..12  -> primaryCharacterId
  25..28 -> primaryCharacterId - 12   // 13..16
```

| 선택 ID | 프로필 ID/자산 | 근거 |
|---|---|---|
| 1 | 01 `uc_01_xyrho.png` | Xyrho 명칭·얼굴, user_info ID 101 |
| 2 | 02 `uc_02_shamoo.png` | Shamoo 명칭·얼굴, user_info ID 102 |
| 3 | 03 `uc_03_sven.png` | Sven 명칭·얼굴, user_info ID 103 |
| 4 | 04 `uc_04_cream.png` | Cream 명칭·얼굴, user_info ID 104 |
| 5 | 05 `uc_05_roland.png` | Roland 명칭·얼굴, user_info ID 105 |
| 6 | 06 `uc_06_aurelli.png` | Aurelli 명칭·얼굴, user_info ID 106 |
| 7 | 07 `uc_07_hawk.png` | Hawk 명칭·얼굴, user_info ID 107 |
| 8 | 08 `uc_08_hazel.png` | Hazel 명칭·얼굴, user_info ID 108 |
| 9 | 09 `uc_09_cara.png` | Cara 명칭·얼굴, user_info ID 109 |
| 10 | 10 `uc_10_warrior.png` | Warrior 명칭·얼굴, user_info ID 110 |
| 11 | 11 `uc_11_lucy.png` | Lucy 명칭·얼굴, user_info ID 111 |
| 12 | 12 `uc_12_darkelf.png` | Darkelf/Will 슬롯, user_info ID 112 |
| 25 | 13 `uc_13_avatar.png` | `ch_25_avatar_*`와 동일 얼굴, user_info ID 113 |
| 26 | 14 `uc_14_avatar.png` | `ch_26_avatar_*`와 동일 얼굴, user_info ID 114 |
| 27 | 15 `uc_15_avatar.png` | `ch_27_avatar_*`와 동일 얼굴, user_info ID 115 |
| 28 | 16 `uc_16_avatar.png` | `ch_28_avatar_*`와 동일 얼굴, user_info ID 116 |

근거 우선순위는 (1) `user_info.xml`의 ID 101..116과 파일명, (2) `char_select`의 명명·순서,
(3) PNG의 얼굴/색상 육안 대조다. 프리미엄 13..24는 v1.1에서 선택 범위에서 삭제됐다. 이 매핑에는
미확정 항목이 없다.

### 3.2 자산 배포 규칙

- 원본 정본은 `docs/game_ui/{char_select,user_info}`이고 런타임 정적 자산은 frontend public 아래에
  복제한다. 빌드가 docs 경로를 직접 참조하지 않는다.
- 동기화 스크립트는 정확한 allowlist(선택 32개 + 프로필 16개)를 사용하고 누락·추가 파일을 실패로
  처리한다. 특히 premium `btn_1`과 모든 `btn_2` 파일이 산출물에 존재하면 검증 실패다.
- normal/nomal은 평상시 표시, click은 pointer hover/focus-visible 표시다. 선택 상태는 hover 자산을
  의미하지 않으며 별도 테두리와 `aria-pressed=true`로 표현한다. touch에는 hover를 요구하지 않는다.
- 16개는 DOM상 한 줄 순서를 유지하되 작은 viewport에서는 선택 영역 자체가 가로 스크롤된다. 페이지
  전체 가로 overflow를 만들지 않는다.

## 4. 영속 모델과 불변식

`user.primary_character_id TINYINT UNSIGNED NOT NULL DEFAULT 1`을 추가한다.

- DB CHECK: `(primary_character_id BETWEEN 1 AND 12) OR (primary_character_id BETWEEN 25 AND 28)`.
- Flyway V28은 컬럼을 default 1로 추가해 기존 행을 원자적으로 backfill하고 NOT NULL/CHECK를 함께 둔다.
- 신규 가입(일반·OAuth)도 엔티티 기본값 1을 명시한다. DB default는 우회 삽입 방어선이다.
- 별도 인덱스는 두지 않는다. 사용자 PK/공개 ID/닉네임으로 찾은 단건·배치 행에서 함께 읽는 속성이며
  캐릭터별 역조회 요구가 없다.
- 변경은 `User.changePrimaryCharacter(int)` 도메인 메서드와 서비스 검증을 거친다. 임의 Setter는 금지한다.

## 5. 변경·인가·동시성

- `PATCH /api/v1/me`만 변경 경로다. 주체는 `SecurityContext`이며 body의 회원 ID를 받지 않는다.
- 요청은 merge-patch 성격의 부분 수정이다. `nickname`과 `primaryCharacterId`는 각각 선택 필드이고,
  **최소 하나는 반드시 제공**해야 한다. 누락은 유지, 명시된 값만 변경한다. JSON `null`은 제공된 잘못된
  값으로 400 처리한다.
- 두 필드가 함께 오면 단일 트랜잭션으로 모두 성공하거나 모두 rollback한다. 닉네임 중복이면 캐릭터 변경도
  적용하지 않는다.
- 같은 회원의 동시 PATCH는 마지막 커밋이 이긴다. 금전/인가 상태가 아니므로 version 컬럼이나 별도 락은
  추가하지 않는다.
- 허용 집합 밖 ID(13..24 포함)는 `MEMBER_003`(400)이다. 빈 body/null/일반 Bean Validation 실패는 공통 검증 400이다.

## 6. 조회·노출·삭제 의미

- `GET/PATCH /me`의 `MeResponse`와 frontend 세션 `UserSummary`는 `primaryCharacterId`를 포함한다.
- 로그인/refresh token과 JWT claim에는 넣지 않는다. 변경 즉시 반영되어야 하는 표시 속성을 토큰 수명에
  캐시하지 않는다. 로그인 후 기존 `/me` 조회가 세션 요약의 권위다.
- 채팅 `ChatMemberResponse`/counterpart와 메시지 sender, 게시글·댓글의 활성 작성자, 쪽지의 현재
  sender/receiver 표현에는 `primaryCharacterId`를 가법 노출한다.
- **스냅샷 컬럼은 추가하지 않는다.** 프로필은 닉네임 역사 기록과 달리 현재 기본 캐릭터를 보여주는
  표시 속성이다. 기존 콘텐츠도 변경 직후 새 프로필을 보이며, 목록은 사용자 ID를 모아 배치 조회/조인하여
  N+1을 금지한다.
- 삭제된 회원 또는 게시판 tombstone처럼 작성자를 숨기는 응답은 `primaryCharacterId=null`을 반환하고
  프론트가 캐릭터 1 fallback을 표시한다. 기존 닉네임 스냅샷·`탈퇴한 사용자` 규칙은 변경하지 않는다.
- 거래 상대 마스킹 응답에는 캐릭터 ID를 추가하지 않는다. 마스킹 닉네임과 결합한 재식별 면을 넓히지 않는다.
- WebSocket 이벤트 스키마는 변경하지 않는다. 실시간 채팅 메시지 sender 프로필은 room/message REST 캐시의
  `primaryCharacterId`를 사용하고, 재접속/room hydration으로 현재값에 수렴한다.

## 7. 성능·캐시·호환성

- DB 행 크기 증가는 1바이트 수준이며 신규 인덱스가 없다. `/me` 단건 비용은 사실상 불변이다.
- 게시판·쪽지 목록은 페이지의 distinct user ID를 한 번에 조회한다. 항목당 user 조회는 금지한다.
- 응답 필드는 가법 변경이다. 구 클라이언트는 미사용 필드를 무시하고, 신 frontend는 누락 시 ID 1로
  방어해 순차 배포를 허용한다.
- 정적 자산은 같은 origin의 immutable 파일로 배포하고 사용자 제공 URL을 렌더링하지 않는다.

## 8. 검증 기준과 영향 티켓

- FC-353: V28, `User` 필드/default/check/domain method.
- FC-354: `/me` 부분 PATCH, `MeResponse`, 채팅·게시판·쪽지 공개 DTO의 가법 필드와 배치 조회.
- FC-355: 정확한 allowlist 자산 동기화, premium `btn_1`·모든 `btn_2` 산출물 0개 검증.
- FC-356: 16개 일렬 선택·가로 내부 스크롤·keyboard/focus/hover·저장 UX.
- FC-357: 헤더·마이페이지·채팅·게시판·쪽지의 공용 프로필 컴포넌트 적용.
- FC-358: 본인 인가, 1/28 경계와 0/29 거부, migration backfill, N+1, tombstone, 반응형·접근성 리뷰.

2026-08-22 Gate 2 사용자 승인으로 FC-353~357 구현 진입이 허용됐다.
