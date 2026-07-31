# FinalCall Memo Domain Spec (메모·쪽지 도메인 스펙)

상태: **v1.0 — 확정(2026-08-01, 게이트2 사용자 승인)**. EPIC-MEMO(FC-170) 계약/설계 확정본이다. 회원 간 메모(쪽지)를
finalcall 네이티브 도메인으로 구축하되, 게임 원본 `new_sp.user_memo` 형상을 계승하고 게임 클라이언트 고정
계약(28바이트 고정폭 렌더·`레벨×100+성별` 정수 패킹·`char(16)` 닉네임)은 **boundary 포맷터**로 흡수한다.
소유: architect(spec). **게이트2 4결정(§11)은 2026-08-01 사용자 승인으로 확정**됐고, §7 스키마·§8 boundary·§10 계약에 확정 규약으로 반영됐다.

근거(정본): game-db-survey v0.1(§2.5 user_memo·§2.1 user·§4 R1/R6·§5 U2), CLAUDE.md 섹션 4·5(feature-first·도메인 컨벤션),
erd v1.5(§1 네이밍·soft delete UK D-081·§4.1 user·§4.2 sale_order 선례), api-contract v1.19(§1 공통규약·§2.5 회원 리소스·
§3.3 마스킹·§5 에러코드), domain-spec §6.1(회원 규칙)·§8(정합성은 DB). 레거시 참조(형상 검증):
`KSPWEB-master`(`controller/MyMessageController.sendMessageProcess`·`service/MyMessageServiceImp`·`api/GetStringByteManager`).

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.0 | 2026-08-01 | **게이트2 4결정 사용자 승인 확정** — (a) 레벨·성별 = 메모 스냅샷 2컬럼, 현재 소스 부재 → **기본값 Lv.1·성별 0(남)** 채움(향후 user 게임필드 생기면 실값), 저장 분해·게임 응답 재합성(§8.1·§11a). (b) **깔끔 원문 저장 + 게임 boundary에서만 28바이트 패딩**(§8.3·§11b). (c) `user_memo` 신규 테이블·Flyway **V20**·이름 유지(§7·§11c). (d) **입력=자유 텍스트 단일 필드 + 게임 boundary 28바이트 자동 줄바꿈 필수**(수동 개행 없음, 프론트 미리보기 필수, §8.3·§11d). §7·§8·§10·§11 확정 반영. 초안 표기 제거 |
| v0.1 | 2026-08-01 | FC-170 착수 — 도메인 개요·이중 writer 모델·상태전이·불변식·수신자 검증·스키마(V20 설계)·바이트 boundary 규약·에러코드(MEMO_xxx)·계약/erd 델타 초안. 게이트2 상신 4항목(§11) 정리. 레거시 소스로 3필드×28바이트+자유꼬리 구조·getStringByte 폭·level×100+gender 패킹 실증 |

---

## 1. 개요·범위

### 1.1 무엇인가
회원(플레이어)이 다른 회원에게 짧은 메모(쪽지)를 보내고, 받은함·보낸함에서 열람·삭제한다. 게임 인게임 쪽지와
**동일한 데이터**를 공유한다(통합 스키마·단일 정본 — finalcall DB가 곧 게임 DB). 웹에서 보낸 메모를 게임 클라이언트가
읽고, 게임에서 열람하면 웹에도 읽음으로 반영된다.

### 1.2 범위(코어)
- **발신**(웹 = 쓰기 주인): 회원이 수신자 닉네임 + 본문으로 유저 메모(type=5)를 생성.
- **받은함·보낸함**(커서 페이지네이션, 공통 `CursorResponse<T>` 재사용).
- **열람**(상세 조회 + 미열람→열람 상태 전이).
- **삭제**(soft delete, 게임 `memo_del` 계승).
- **미열람 개수**(뱃지용, 레거시 `inboxUnreadCount` 파리티).

### 1.3 범위 밖(후속)
- **실시간 채팅**(EPIC-MEMO 범위 밖·추후).
- **시스템 메모 발신**(type 0/14): 게임 서버(선물 실패 안내 등)가 발신하며 finalcall은 **읽기만**. finalcall이 시스템 메모를 생성하는 경로는 없다.
- **레거시 3897행 임포트/백필**: finalcall 네이티브 도메인은 **신규(빈 테이블)로 시작**한다. 기존 게임 데이터의 마이그레이션·닉→user_id 백필은 별건(백엔드, 이연 가능). §7.4 참조.
- **메모 검색**(레거시 option/keyword 검색): 이연.
- **스팸/발신 쿨다운**(레거시 "3분전 이력" 로직은 주석처리돼 미가동): 이연(§9 주 참조).
- **아이템 지급 연동(우편함 클레임)**: 향후 확장 본보기이나 이번 범위 밖.

---

## 2. 게임 원본 대조 (`new_sp.user_memo` → finalcall)

game-db-survey §2.5 실측. 좌=게임 원본, 우=finalcall 재구성 방침.

| 게임 컬럼 | 타입/의미 | finalcall 재구성 |
|---|---|---|
| `memo_id` | int PK AI | 내부 `id BIGINT AI`(비노출) + 외부 `public_id CHAR(26) ULID`(B-004) |
| `memo_sender` | char(16) — **닉네임 자연키**(R1) | `sender_id BIGINT FK→user`(정규화) + `sender_nickname VARCHAR(16)`(**발신 시점 닉 스냅샷**, 닉 변경 대비) |
| `memo_reciever`(sic) | char(16) — 닉네임 자연키 | `receiver_id BIGINT FK→user` + `receiver_nickname VARCHAR(16)`(수신 시점 닉 스냅샷) |
| `memo_type` | int DEFAULT 5 — 5=유저/0·14=시스템 | `memo_type INT`(**원 게임 코드값 그대로 보존** — 문자열 enum 변환 금지, §3.3) |
| `memo_level_gender` | int DEFAULT 0 — `usr_level×100+usr_gender`(패킹, R6) | **저장은 분해** → `sender_level INT` + `sender_gender TINYINT`. 패킹 int는 게임 boundary가 재합성(§8) |
| `memo_msg` | char(120) — 본문(유저 실측 최대 115자) | `body VARCHAR(120)`(용량 보존). **28바이트 고정폭은 표현 계약**이지 저장 형태 아님(§8) |
| `memo_state` | int DEFAULT 0 — 0미열람/1열람 | `is_read BOOLEAN`(+ `read_at DATETIME(6)`) |
| `add_date` | timestamp — 발신 시각 | 공통 `created_at DATETIME(6)`(UTC) |
| `memo_del` | int DEFAULT 0 — soft delete 0/1 | `is_deleted BOOLEAN`(+ `deleted_at DATETIME(6)`, erd soft delete 규약) |

> **자유 재구성(finalcall 컨벤션)**: PK 전략(int AI → BIGINT + ULID), 감사 컬럼(add_date → created_at), soft delete 표현
> (int 0/1 → BOOLEAN + deleted_at), charset(utf8mb3 → utf8mb4). **클라 고정 계약(보존)**: `memo_type` 코드값(5/0/14),
> `memo_state` 0/1 의미, `char(16)` 닉네임·`char(120)` 본문 용량, `level×100+gender` 패킹, 28바이트 폭 렌더 — 이들은
> boundary에서 재현한다(§8).

---

## 3. 쓰기 소유자 — 이중 writer 모델

통합 스키마라 이 테이블에 쓰는 주체가 둘이다(게임 연동 원칙: 읽기 통합 / 쓰기 소유자 규칙). 소유자를 행위별로 못박는다.

| 행위 | 소유자(writer) | finalcall 역할 |
|---|---|---|
| 유저 메모 발신(type=5, INSERT) | **웹(finalcall)** | 쓰기 주인. `POST /me/memos` |
| 시스템 메모 발신(type 0/14, INSERT) | **게임 서버**(선물 실패 안내 등) | **읽기만**. finalcall 생성 경로 없음 |
| 열람 상태 전이(`memo_state` 0→1) | **양쪽**(웹 열람 · 게임 인게임 열람) | 웹 열람 시 finalcall이 전이(§4). 게임 열람은 게임 서버가 전이 |
| 삭제(`memo_del` 0→1) | **양쪽** | 웹 삭제 시 finalcall이 전이. 게임 삭제는 게임 서버가 전이 |

**보안 함의(§9·reviewer)**: 발신 API는 `memo_type`을 **서버가 5(USER)로 고정**한다 — 클라이언트가 임의 type을 지정해
시스템/운영자 메모(0/14)를 사칭하지 못하게 한다. 발신 주체(sender)는 **SecurityContext**에서만 취하고 요청 바디의
발신자 필드는 신뢰하지 않는다(IDOR·사칭 차단).

---

## 4. 상태 전이

### 4.1 열람 상태 (`is_read`: 미열람 ↔ 열람)
```
미열람(is_read=false) ──[수신자가 상세 열람]──▶ 열람(is_read=true, read_at=now)
```
- **전이 조건**: 상세 조회(`GET /me/memos/{id}`)에서 **호출자가 수신자(receiver_id=주체)이고 미열람일 때만** `is_read=true`로 1회 전이한다.
- **보낸함 열람은 전이 없음**: 발신자가 자기 보낸 메모를 열어도 상태를 바꾸지 않는다(레거시 `mySendMessageView`가 읽음 처리를 하지 않음과 정합).
- 재열람은 no-op(이미 true). 열람→미열람 되돌림은 없다(단방향).
- 게임 인게임 열람은 게임 서버가 같은 전이를 수행(양쪽 writer). finalcall은 조회 시점의 `is_read`를 그대로 노출한다.

### 4.2 삭제 (`is_deleted`: soft delete)
```
존재(is_deleted=false) ──[당사자가 삭제]──▶ 삭제(is_deleted=true, deleted_at=now)
```
- soft delete만 지원(물리 삭제 없음). 삭제된 메모는 받은함·보낸함·상세·미열람 개수에서 제외된다.
- **게임 호환 단일 플래그**: 게임 `memo_del`은 단일 0/1 플래그다. 따라서 **sender·receiver 중 한쪽이 삭제하면 양쪽 박스에서 사라진다**(게임 계약 계승). 당사자별 개별 삭제(발신자만 숨김 등)는 **범위 밖**이다 — 도입하려면 별도 플래그(`sender_deleted`/`receiver_deleted`)가 필요하고 게임 `memo_del` 단일 읽기와 어긋나므로 게이트2 별건(§11 미해결).
- 삭제는 되돌릴 수 없다(복구 UI 없음).

---

## 5. 불변식

- **I-1(발신자 사칭 불가)**: `memo_type=5`(USER) 메모의 `sender_id`는 발신 API 호출 주체(SecurityContext)와 일치한다. 요청 바디의 발신자 지정 불가.
- **I-2(type 고정)**: 웹 발신은 항상 `memo_type=5`. 0/14은 게임 서버만 쓴다.
- **I-3(수신자 존재)**: 웹 발신 성립 시 `receiver_id`는 활성 회원(`is_deleted=false`)을 가리킨다. 미존재 닉네임은 발신 거부(MEMO_001).
- **I-4(닉 스냅샷 불변)**: `sender_nickname`·`receiver_nickname`은 발신 시점 값으로 고정된다. 이후 닉 변경이 과거 메모 표시를 바꾸지 않는다(R1 대비).
- **I-5(당사자 접근)**: 상세 열람·삭제는 sender_id 또는 receiver_id가 주체와 일치할 때만 허용(IDOR 차단, MEMO_003). 받은함은 receiver_id=주체, 보낸함은 sender_id=주체로만 조회.
- **I-6(본문 용량)**: `body`는 저장 상한 char(120) 상당(VARCHAR(120)). 웹 발신 입력폭 검증은 §8.3(28바이트 metric).
- **I-7(열람 단방향)**: `is_read`는 false→true 단방향. read_at은 최초 전이 시각에 1회 세팅.

---

## 6. 수신자 검증·닉네임 자연키 정합 (R1)

- 발신 요청은 `receiverNickname`(닉네임 문자열)으로 수신자를 지정한다 — 게임/레거시가 닉네임을 자연키로 쓰기 때문(R1). finalcall은 이를 **`existsByNicknameAndIsDeletedFalse`/`findByNicknameAndIsDeletedFalse`로 활성 회원 조회**(auth 닉 중복확인 v1.17과 동일 비교 경로 재사용)해 `receiver_id`로 정규화한다.
- **닉 길이 정합**: 게임 `char(16)` vs finalcall `nickname VARCHAR(30)`(R4). game-db-survey는 신규 닉 30자 허용 시 게임 클라 렌더가 깨질 수 있어 **16자 제한**을 권고한다. 그러나 닉 길이 정책은 회원 도메인(signup) 소관이라 **이 에픽에서 변경하지 않는다**. 대신 스냅샷 컬럼 `*_nickname`을 **VARCHAR(16)으로 두어 게임 계약 폭을 보존**하고, 30자 닉을 스냅샷할 때는 boundary가 16바이트로 절단한다(§8.2). 근본 정합(닉 16자 제한)은 회원 도메인 별건으로 남긴다(§11 미해결).
- **대소문자·정규화**: signup·닉 중복확인과 동일 collation·원문 판정을 따른다(별도 정규화 미도입 — 조회 결과와 발신 결과의 일관성).
- **열거 방지(SEC-007)**: 수신자 미존재를 알려주는 응답(MEMO_001)은 닉네임 존재 여부를 노출하나, 닉네임은 이미 목록·상세의 마스킹 표시값이자 `GET /auth/nickname/availability`가 동일 존재 여부를 공개하므로 **새 열거면을 열지 않는다**. 발신은 인증 필요 + 게이트웨이 rate limit(auth 계열과 동일 정책) 하에 둔다.

---

## 7. 스키마 (Flyway V20 설계 · erd 델타)

> **architect는 마이그레이션 실물을 쓰지 않는다.** 아래는 확정 대상 **스키마 형태**이며, 실제 `V20__user_memo.sql`
> 작성·채번은 backend-impl(FC-171) 소유다. 현재 최신 마이그레이션 = **V19**(→ 신규 **V20**).

### 7.1 테이블 `user_memo`

게임 원본 테이블명 `user_memo`를 계승한다(다른 게임 테이블 `user_*` 계열과 일관·통합 스키마 lineage). 엔티티 클래스 = `Memo`, feature = `com.finalcall.domain.memo`.

| 컬럼 | 타입 | 널 | 키 | 설명 |
|---|---|---|---|---|
| id | BIGINT | N | PK | AUTO_INCREMENT, 내부 식별자(비노출) |
| public_id | CHAR(26) ULID | N | UK | 외부 노출 식별자(B-004). 상세·삭제 경로 리소스 |
| sender_id | BIGINT | Y | FK→user | 발신 회원. **시스템 메모(게임 발신)·미매칭 임포트는 NULL 허용**. 유저 메모(웹 발신)는 항상 값 존재 |
| sender_nickname | VARCHAR(16) | N | | **발신 시점 닉 스냅샷**(게임 `char(16)` 계약, 닉 변경 대비 R1). 시스템 메모는 게임이 넣는 시스템/발신자명 |
| sender_level | INT | Y | | 발신자 레벨 스냅샷(게임 boundary가 `level×100+gender` 재합성, §8). **웹 발신 소스(확정, 게이트2 a) = 현재 기본값 Lv.1**(user에 게임 레벨 부재 → `1` 고정, 향후 user 게임필드 생기면 실값). 시스템 메모·임포트는 NULL |
| sender_gender | TINYINT | Y | | 발신자 성별 스냅샷(0/1). **웹 발신 소스(확정, 게이트2 a) = 현재 기본값 0(남)**(user에 성별 부재 → `0` 고정, 향후 실값). 시스템 메모·임포트는 NULL |
| receiver_id | BIGINT | Y | FK→user | 수신 회원. 웹 발신은 항상 값 존재(§6 정규화). 임포트 미매칭 대비 NULL 허용 |
| receiver_nickname | VARCHAR(16) | N | | 수신 시점 닉 스냅샷(게임 `char(16)` 계약) |
| memo_type | INT | N | | 게임 코드값 **원형 보존** — 5=USER(웹 발신 기본)·0/14=SYSTEM(게임 발신). 문자열 enum 변환 금지(게임 클라가 int로 읽음) |
| body | VARCHAR(120) | N | | 본문(게임 `char(120)` 용량 계승). 저장은 정규화된 순수 텍스트, 고정폭은 boundary(§8) |
| is_read | BOOLEAN | N | | 열람 여부(게임 `memo_state` 0/1). 기본 false |
| read_at | DATETIME(6) | Y | | 최초 열람 시각(전이 시 1회) |
| is_deleted | BOOLEAN | N | | soft delete(게임 `memo_del`). 기본 false |
| deleted_at | DATETIME(6) | Y | | 삭제 시각 |
| created_at | DATETIME(6) | N | | 발신 시각(게임 `add_date` 계승). 공통 컬럼 |

- `updated_at` 미도입: 메모는 발신 후 본문이 불변이고 상태(is_read/is_deleted)만 단방향 전이라 `BaseCreatedEntity` 계열로 충분하다(item_ownership_history·platform_revenue_ledger 선례). 상태 시각은 `read_at`·`deleted_at`이 별도로 담는다.
- soft delete 자연키 UK 패턴(D-081) **불요**: 이 테이블에는 재사용되는 자연키 UK가 없다(`public_id`는 시스템 발급 대리키라 대상 아님, erd §4 말미 주). `sender_nickname`/`receiver_nickname`은 스냅샷 값이지 UK가 아니다.

### 7.2 인덱스 (erd §5 델타)

| 인덱스(컬럼) | 이유 |
|---|---|
| `(receiver_id, is_deleted, id DESC)` | 받은함 커서 조회(`receiver_id=me AND is_deleted=false`, id desc 안정 정렬). 미열람 개수 집계도 커버 |
| `(sender_id, is_deleted, id DESC)` | 보낸함 커서 조회(`sender_id=me AND is_deleted=false`, id desc) |

- 커서 정렬 키 = `id DESC`(= 발신 시각 역순, ULID/AI 단조). `created_at` 대신 단조 `id`를 커서 키로 써 동시각 타이브레이커를 제거한다(bid `public_id`·temp_storage 커서 선례와 동류).
- 미열람 개수는 받은함 인덱스로 `receiver_id=me AND is_deleted=false AND is_read=false` 카운트(별도 인덱스 불요 — 소규모 필터).

### 7.3 Flyway (erd §6 델타)
- 신규 그룹: **회원 부가(메모)** — `V20__user_memo.sql`(테이블 `user_memo` + §7.2 인덱스 2종). append-only, V1~V19 무편집.
- `JPA_DDL_AUTO=validate`(전 프로파일) 규약 유지 — 스키마는 Flyway 소유.

### 7.4 레거시 임포트(범위 밖·주)
게임 `new_sp.user_memo` 3897행 임포트는 별건이다. 임포트 시 `sender`/`reciever` 닉→finalcall `user_id` 조인 백필,
`memo_level_gender` 분해(`/100`, `%100`), `memo_state`/`memo_del` → BOOLEAN 변환. 매칭 안 되는 닉(탈퇴·미가입)은
`*_id` NULL로 두고 스냅샷 닉만 보존한다(그래서 §7.1 `*_id`가 nullable). finalcall 발신 경로는 항상 `*_id`를 채운다.

---

## 8. 바이트 boundary 규약 (게임 클라이언트 고정 계약 흡수)

finalcall은 **정규화된 순수 데이터**로 저장하고(§7), 게임 클라이언트로 나갈 때만 boundary 포맷터가 고정 계약을
재현한다. 이 포맷터는 **게임 서버(에뮬레이터·재컴파일 가능) 코드에 속하며 finalcall 웹 API 계약이 아니다** —
finalcall 웹 응답(§10)은 분해된 깔끔한 필드를 노출한다. 아래는 게임 boundary가 지켜야 할 계약이다.

### 8.1 레벨·성별 정수 패킹 (R6, 실증)
레거시 `sendMessageProcess`: `levelAndGender = (usr_level × 100) + userGender`(gender ∈ {0,1}). 실측 검증(예 `2601`=레벨26·성별1).
- **게임 읽기(boundary → 게임 클라)**: `memo_level_gender = sender_level × 100 + sender_gender`.
- **게임 쓰기(게임 클라 → boundary, 시스템 메모)**: `sender_level = lg / 100`, `sender_gender = lg % 100`.
- **웹 발신 저장(확정, 게이트2 a)**: user에 게임 레벨·성별이 없으므로 발신 시 `sender_level=1`·`sender_gender=0`(남) 기본값을 채운다 → 게임에서는 `memo_level_gender = 1×100+0 = 100`(레벨 1·남)으로 표시된다. 향후 user가 게임 레벨·성별 필드를 갖추면 발신 소스만 실값으로 교체(스키마·boundary 무변경).

### 8.2 닉네임 고정폭 (R1·R4)
게임은 `char(16)`. finalcall 스냅샷 컬럼도 VARCHAR(16). 30자 닉(회원 도메인)이 유입되면 boundary가 **16바이트로 절단**해 스냅샷/전송한다(게임 렌더 폭 보존). 근본 16자 제한은 §11 미해결.

### 8.3 본문 28바이트 자동 줄바꿈 (U2, 실증) — **재현 정책 확정(게이트2 d)**
레거시 `GetStringByteManager.getStringByte`: 문자별 폭 = **숫자(0–9)·ASCII 문자(대략 A–z 코드 65–122) = 1바이트**, **그 외(한글 등) = 2바이트**.
`sendMessageProcess`는 `send1/send2/send3`를 각 **28바이트로 공백 패딩**한 뒤 자유 꼬리 `send4`와 이어붙여 `memo_msg`를 만든다:
```
memo_msg = pad(send1, 28) + pad(send2, 28) + pad(send3, 28) + send4
```
즉 게임 인게임 쪽지 팝업은 본문을 **28바이트 폭 줄들**로 렌더한다. 이 폭은 **표시 계약**이지 저장 형태가 아니다(저장은 char(120)까지 순수 텍스트 허용).

**확정 규약(게이트2 d — 입력=자유 텍스트 단일 필드, 저장=원문, 게임 출력=28byte 자동 wrap)**:

1. **웹 입력(작성 화면)**: 사용자는 **한 칸(자유 텍스트 단일 필드)** 에 자유롭게 쓴다. **수동 개행을 강제하지 않는다**(3필드 고정폼 폐기 — 게이트2 안 A 승인). 프론트는 게임에서 어떻게 끊길지 **28바이트 폭 자동 줄바꿈 미리보기**를 실시간 제공한다(§13 FC-172, 필수 요구). 이 미리보기는 §8.3의 `getStringByte` 폭 규칙(숫자·ASCII 1·그 외 2)을 그대로 구현해 boundary 결과와 일치시킨다.
2. **finalcall 저장(`body`)**: **패딩·개행 없는 순수 원문**만 저장한다(게이트2 b — 사전 패딩 저장 금지). 웹 UI 재파싱 불요·검색/정합 친화.
3. **게임 boundary 출력(→ 게임 클라, `memo_msg`)**: 순수 원문을 **28바이트 폭으로 하드 컷 자동 줄바꿈(auto-wrap)** 한 뒤 각 줄을 28바이트로 공백 패딩해 위 레이아웃으로 재구성한다. 한 글자가 경계(28바이트)를 넘기면 **그 글자부터 다음 줄로** 넘긴다(글자 중간 절단 없음 — 한글 2바이트가 홀수 경계에 걸리면 그 글자를 통째로 다음 줄로). 이 auto-wrap은 **옵션이 아니라 필수 boundary 기능**이다.
- **웹 발신 입력 검증(확정)**: 웹 유저 본문 폭이 게임 팝업 용량을 넘지 않도록 `getStringByte` metric으로 상한을 검증한다. 확정 상한 = **총 폭 ≤ 112바이트**(= 4×28, 레거시 3헤더+꼬리 용량과 정합, 자동 wrap·패딩 후 char(120) 이내 보장). 초과 시 COMMON 검증 400(§1.4).

---

## 9. 에러코드 (MEMO_xxx · `com.finalcall.common.exception`)

배치 = `com.finalcall.common.exception`(V2 중앙화, §5). 도메인 enum `MemoErrorCode`(공통 `ErrorCode` 구현). api-contract §5 등재 대상.

| 코드 | 의미 | HTTP |
|---|---|---|
| MEMO_001 | 수신자(닉네임) 없음 — 활성 회원 아님 | 404 |
| MEMO_002 | 메모 없음(존재하지 않는 public_id) | 404 |
| MEMO_003 | 당사자 아님(남의 메모 열람·삭제 시도, IDOR) | 403 |
| MEMO_004 | 자기 자신에게 발신 불가 | 422 |

- 본문 형식·길이(빈 값·초과) 위반은 **COMMON 검증 400 + `errors[]`**(§1.4). 신규 도메인 코드 아님.
- MEMO_004(자기 발신): 레거시는 자기 발신을 감지(checkFlag=2)만 하고 하드 차단하지 않았으나, finalcall은 무의미·오발신 방지로 차단한다(경미·되돌리기 쉬움 — 승인 시 제외 가능).
- **발신 쿨다운 미도입(주)**: 레거시 "3분전 이력" 스팸 방지는 소스에서 주석처리돼 미가동이었다. finalcall도 이번엔 도입하지 않고 게이트웨이 rate limit(auth 계열 정책)에 맡긴다 — 도메인 쿨다운은 별건.

---

## 10. API 계약 (api-contract 델타 요약)

정본은 api-contract §2.6(신설). 모든 응답 `ApiResponse<T>`(§1.4 envelope), 외부 식별자 = `public_id`(§1.1). 전 엔드포인트 **인증 필요**, 주체 = SecurityContext, `/me` 접두(§2.5 회원 리소스 규약과 정합 — IDOR 설계 차단).

| 메서드·경로 | 동작 | 응답 |
|---|---|---|
| `POST /api/v1/me/memos` | 발신(type=5 고정, 주체=발신자) | 201 `{ memoPublicId, createdAt }` |
| `GET /api/v1/me/memos/received` | 받은함(커서) | 200 `CursorResponse<MemoSummary>` |
| `GET /api/v1/me/memos/sent` | 보낸함(커서) | 200 `CursorResponse<MemoSummary>` |
| `GET /api/v1/me/memos/unread-count` | 미열람 개수 | 200 `{ count }` |
| `GET /api/v1/me/memos/{memoPublicId}` | 상세 열람(+수신자면 읽음 전이) | 200 `MemoResponse` |
| `DELETE /api/v1/me/memos/{memoPublicId}` | 삭제(soft) | 204 |

- 요청 `POST /me/memos` body: `{ receiverNickname, body }`. `receiverNickname`(@NotBlank·≤16), `body`(@NotBlank, 폭 검증 §8.3). type·sender는 요청에 없다(서버 고정).
- **응답 필드(마스킹 없음)**: 메모는 **당사자만** 조회하므로(§I-5) 상대 닉네임을 마스킹하지 않고 원문 노출한다(경매 목록의 비당사자 마스킹 §3.3과 성격이 다르다 — 여기선 대화 상대를 알아야 함). 노출 필드: `memoPublicId`, `type`(int 코드), `senderNickname`, `senderLevel`, `senderGender`, `receiverNickname`, `body`, `isRead`, `createdAt`, (상세) `readAt`. `senderLevel`/`senderGender`는 **분해된 값으로 노출**(게임 패킹 int는 웹 API에 노출하지 않음 — boundary 전용, §8.1).
- **DTO 네이밍**(§5 컨벤션): `MemoSendRequest`, `MemoResponse`(상세), `MemoResponse.Summary`(목록용 중첩 static record 또는 `MemoSummary`), 커서 목록 = 공통 `CursorResponse<T>`. `*Command`/`*Result` 미사용(memo는 서비스가 웹 DTO 직접 수령·반환 feature — §5 규약).
- IDOR·에러 매핑: 상세/삭제에서 대상이 없으면 MEMO_002(404), 당사자 아니면 MEMO_003(403). 존재 노출 최소화를 위해 "타인 메모"를 404로 통일할지 403으로 구분할지는 reviewer(FC-173) 확인 — 초안은 404(미존재)/403(타인) 구분, 열거 민감 시 404 통일 검토.

---

## 11. 게이트2 결정 — **확정(2026-08-01, 사용자 승인)**

4결정 모두 사용자 승인으로 확정됐다. 아래는 확정 내용이며 §7·§8·§10과 erd·api-contract에 확정 규약으로 반영됐다. (상신 시점의 대안·트레이드오프 원문은 v0.1 이력·커밋 기록 참조.)

### (a) 레벨·성별 소스 — **확정: 메모 스냅샷 2컬럼 + 기본값 Lv.1·성별 0(남)**
메모에 `sender_level`·`sender_gender` 발신 시점 스냅샷 2컬럼을 보유한다(§7.1). finalcall `user`에 게임 레벨·성별이 아직 **없으므로**, 현재는 발신 시 **기본값 `sender_level=1`·`sender_gender=0`(남)** 을 채운다 → 게임에서는 `memo_level_gender=100`(레벨1·남)으로 표시된다. 저장은 분해(레벨/성별 별도 컬럼), 게임 응답 시 boundary가 `레벨×100+성별`로 재합성(§8.1). **향후 user가 게임 레벨·성별 필드를 갖추면 발신 소스만 실값으로 교체**(스키마·boundary 무변경). user 게임필드 복원(안 A)은 통합 로드맵 별건.

### (b) 바이트 포맷 저장 방식 — **확정: 깔끔 원문 저장 + 게임 boundary에서만 패딩**
`body`는 **패딩·개행 없는 순수 원문**으로 저장한다. `sender_level`/`gender`는 분해 저장, 닉은 원문 스냅샷. 게임 클라로 나갈 때만 boundary가 28바이트 재래핑·닉 16바이트 패딩·`레벨×100+성별` 패킹을 재합성한다(§8). 사전 패딩 저장(안 B)은 폐기 — 저장값 오염·검색/정합 저하·finalcall 컨벤션 위배.

### (c) 신규 테이블·채번 — **확정: `user_memo` 신규 + Flyway V20 + 이름 유지**
`user_memo` 테이블(§7.1) 신설 + 인덱스 2종(§7.2), Flyway **V20**(현재 최신 V19). 엔티티 `Memo`, feature `com.finalcall.domain.memo`. 테이블명은 **`user_memo` 유지**(게임 lineage·`user_*` 계열 일관, 게임 서버가 장차 이 테이블을 그대로 읽음 → boundary 마찰 최소).

### (d) 28바이트 재현 정책 — **확정: 자유 텍스트 단일 필드 + 28바이트 자동 줄바꿈(필수)**
발신 UX = **안 A(자유 입력창 하나)**. 사용자는 한 칸에 자유롭게 쓰고 **수동 개행하지 않는다**(레거시 3필드 고정폼 폐기). 시스템이 게임 boundary로 내보낼 때 본문을 **28바이트 폭(한글 2·영문숫자 1, `GetStringByteManager` 규칙)으로 하드 컷 자동 줄바꿈**한다(§8.3). 이 자동 줄바꿈은 **옵션이 아니라 필수 기능**이다. 웹 작성 화면은 게임에서 어떻게 끊길지 **28바이트 폭 자동 줄바꿈 미리보기를 실시간 제공**(프론트 FC-172 필수 요구). 저장은 순수 원문, 웹 응답은 분해 필드(§10).
- **구체 예시**: 웹에서 "안녕하세요 아이템 거래 문의드립니다"를 한 줄로 입력(수동 개행 없음) → finalcall은 그 순수 텍스트를 그대로 저장 → 게임 boundary가 28바이트씩 자동 wrap해 여러 줄로 표시. 프론트 작성 화면은 입력 중 실시간으로 "이렇게 끊깁니다" 미리보기를 보여준다.
- **U2 잔여 확인(비차단)**: 게임 팝업에서 `send1/2/3`이 단순 "표시 줄"이라는 전제 하 자동 wrap을 채택했다. 게임 인게임 실제 렌더는 boundary 이식 시 1회 시각 확인 권고(다른 의미 필드로 판명되면 boundary 재래핑 규칙만 재조정 — 웹 계약·저장 형상은 불변).

---

## 12. 미해결·추가 확인

- **U2 잔여(게임 팝업 렌더)**: `send1/send2/send3`가 단순 "표시 줄"인지, 서로 다른 의미 필드(제목/구분 등)인지 게임 클라 소스 미확인. 자유 단일 텍스트(d-추천) 채택 시 게임 인게임에서 실제 렌더를 1회 시각 확인 권고. 다른 의미 필드로 판명되면 (d) 재검토.
- **닉 16자 근본 정합(R4)**: 신규 닉 30자 허용과 게임 char(16) 폭 충돌. 이 에픽은 스냅샷 컬럼 VARCHAR(16) + boundary 절단으로 방어만 하고, 회원 도메인의 닉 16자 제한은 별건으로 남긴다.
- **당사자별 개별 삭제**: 게임 `memo_del` 단일 플래그라 한쪽 삭제가 양쪽에서 사라진다(§4.2). 발신자/수신자 개별 삭제가 필요하면 별도 플래그 도입 = 게이트2 별건(게임 단일 읽기와 정합 검토 동반).
- **레거시 3897행 임포트**: 별건(§7.4). 닉→user_id 백필 매칭률·미매칭 처리 정책은 임포트 착수 시 확정.
- **user 게임필드 복원(레벨/성별/재화 등)**: 통합 로드맵 상 필요하나 (a)-A는 이 에픽 범위 밖. 메모는 (a)-B로 격리 진행.

---

## 13. 구현 인계 (게이트2 확정 후 최종본)

- **FC-171(backend-impl)**: `com.finalcall.domain.memo` feature(Memo 엔티티·MemoService·MemoController·MemoRepository·DTO) + `V20__user_memo.sql`(§7, 현재 최신 V19→V20, 이름 `user_memo` 유지) + `MemoErrorCode`(MEMO_001~004, `common.exception`) + §10 6엔드포인트 구현. **발신 시 `memo_type=5`·`sender_id`=SecurityContext 고정**(§3·I-1), 수신자 = `receiverNickname`→`existsByNicknameAndIsDeletedFalse` 정규화(§6·I-3), **레벨·성별 스냅샷은 확정 기본값 `sender_level=1`·`sender_gender=0`으로 채움**(§8.1·§11a — user 게임필드 부재), **`body`는 패딩·개행 없는 순수 원문 저장**(§8.3·§11b — 사전 패딩 금지), 입력 폭 검증 `getStringByte` metric ≤112바이트(§8.3). 열람 읽음 전이(§4.1), IDOR 가드(§I-5·MEMO_003), soft delete 단일 플래그(§4.2). 게임 boundary 28byte auto-wrap 포맷터(§8.3)는 별도 이연(finalcall 웹 API는 분해·원문 필드만 노출).
- **FC-172(frontend-impl)**: 받은함·보낸함·상세·발신·삭제 화면. **발신 폼 = 자유 텍스트 단일 입력창(안 A 확정)** — 수동 개행 없음. **필수: 28바이트 폭 자동 줄바꿈 미리보기**(입력 중 실시간, `getStringByte` 폭 규칙=숫자·ASCII 1·그 외 2를 프론트에서 구현해 게임 boundary 결과와 일치, §8.3·§11d) + 남은 폭(≤112바이트) 카운터. **새 화면이라 디자인 게이트 선행**. 응답은 §10 `MemoResponse`/`CursorResponse<MemoSummary>` 형상 소비(레벨·성별은 분해 필드).
