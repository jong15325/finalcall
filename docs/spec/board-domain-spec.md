# FinalCall 게시판 도메인 스펙 (board · post · comment · image)

상태: **v1.1 — EPIC-COMMENT-V2 댓글 확장 계약(FC-206). 게이트2 3건(§14) 사용자 승인 완료(2026-08-06).** (v1.0 EPIC-BOARD 계약 확정·게이트2 3건(§11) 승인 완료 2026-08-06.) 이후 변경은 계약 변경 절차(`common/rules.md [6]`) + 영향 티켓 산출 경유.
소유: 기획/설계(architect).
근거: EPIC-BOARD 게이트1 4결정(2026-08-06) — (1) 게시판=시드 정의 우선(관리자 UI 다음 에픽) (2) 댓글 포함 (3) 이미지 포함 (4) 공지(notice) 흡수. 게이트2 3건 승인(2026-08-06). CLAUDE.md §5(도메인 컨벤션)·§9.7~§9.10(V2 어휘·배치). 기존 `notice` 참조 구현(단순 CRUD). erd v1.8·api-contract v1.23.
정본 매핑: 스키마 = `erd.md` §4.5, API 계약 = `api-contract.md` §6.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.1 | 2026-08-06 | **EPIC-COMMENT-V2 — 네이버식 댓글 확장 계약 확정(FC-206, 게이트2 3건 §14 사용자 승인 2026-08-06).** 결정: (a) 답글 = A1(1단계 평탄화 + 닉 스냅샷 @멘션) · (b) 반응 = B1(comment_reaction 유저당 1행 UK + 원자 카운트 비정규화) · (c) 기존 댓글 API = C1(하위호환 없이 형상 교체·형상보존 예외 승인) · **★기본 정렬 = 최신순(LATEST)**(초안 LIKES에서 변경) · 삭제 tombstone 확정 · 자기 반응 금지 COMMENT_003 확정 · comment_count 루트+답글 총계 확정. 평면 댓글(FC-199/203)을 대댓글(1단계)·공감/비공감·정렬(최신/과거/순공감)·BEST로 확장. **§2.3 Comment 확장**(parent_comment_id 활성·mentioned_nickname·like/dislike/reply_count), **§13 신설**(대댓글 1단계 모델·comment_reaction·정렬·BEST·삭제 tombstone·인가 불변식), **§14 신설**(게이트2 3건 — 답글 모델·반응 스키마·기존 API 형상 교체). §4 인가·§5 불변식·§6 카운터 갱신. 스키마 = erd v1.9(comment_reaction·comment 확장 V24), API = api-contract §6.3(v1.24). 구현 = FC-207~209(backend)·FC-210~212(frontend) |
| v1.0 | 2026-08-06 | **게이트2 3건 사용자 승인 확정** — (a) 이미지 저장 = **오브젝트 스토리지(MinIO 로컬·S3 운영)** + `StoragePort`(S3 호환 단일 구현)·presigned GET 서빙(§7 전면 재작성) (b) 공지 흡수=이전+정리·notice 제거·board 참조구현 승계·CLAUDE.md §1 갱신(FC-201 포함) (c) 옵션 표준 3축. Board·Post·Comment·PostImage 도메인 모델·인가 불변식·공지 흡수 순서 정본화. FC-196 계약 확정 |
| v0.1 | 2026-08-06 | 골격 착수(PROPOSAL) — 도메인 모델·인가 불변식·이미지 스토리지 추상화·공지 흡수 전략·게이트2 3건 상신 |

---

## 1. 개요·범위

게시판을 하드코딩 enum(현행 `NoticeType`)이 아니라 **DB 레코드(Board 레지스트리)**로 정의한다. 코드 수정 없이 게시판을 추가·삭제·변경할 수 있고, 게시판마다 쓰기 권한·댓글 허용·유형을 옵션으로 갖는다. 이번 에픽은 관리자 CRUD UI를 만들지 않고 **Flyway 시드로 커뮤니티·공지·이벤트 3개 게시판**을 심되, 데이터 모델은 향후 런타임 CRUD를 견디는 형상으로 확정한다.

구성 엔티티(1 feature = `com.finalcall.domain.board`):
- **Board** — 게시판 레지스트리(slug·이름·설명·정렬·활성 + 쓰기정책·댓글허용·유형).
- **Post** — 게시글(제목·본문·작성자 귀속·soft delete·이미지·조회수·고정).
- **Comment** — 댓글(본문·작성자 귀속·soft delete).
- **PostImage** — 이미지 첨부(2단계 업로드·스토리지 추상화).

범위 밖(다음 에픽): 관리자 게시판 생성/수정 UI, 좋아요·신고·비밀글·카테고리 태그, 대댓글(reply) UI(컬럼은 예약, §2.3), 검색 색인.

이 스펙은 흡수될 `notice`를 **대체하는 새 참조 구현**이다 — 컨벤션 쇼케이스 책임을 승계한다(§8·§11(b)).

---

## 2. 도메인 모델

물리 배치(V2, CLAUDE.md §5): `com.finalcall.domain.board.{controller,service,repository,entity,dto}`. `*ErrorCode`는 `com.finalcall.common.exception`(중앙화). 상세 컬럼·타입·인덱스·키 정본 = `erd.md` §4.5. 아래는 도메인 규칙·설계 의도다.

### 2.1 Board (게시판 레지스트리)

| 필드 | 의미 |
|---|---|
| `slug` | URL 키·외부 식별자(예: `community`·`notice`·`event`). 소문자·숫자·하이픈 `^[a-z0-9-]{2,50}$`. **불변 자연키 UK** — `public_id`(ULID)를 두지 않는다(사람이 읽는 well-known 리소스 키, category 성격). |
| `name` | 표시명(커뮤니티·공지사항·이벤트). ≤50자 |
| `description` | 설명(nullable). ≤200자 |
| `sortOrder` | 목록 정렬 순서(오름차순). 작을수록 위 |
| `isActive` | 활성 여부. 비활성 게시판은 목록 비노출·쓰기 차단(**soft delete 대신 비활성 토글로 "삭제"** → slug 재사용 충돌 없음 → D-081 패턴 불요) |
| `writePolicy` | 쓰기 권한 정책 enum: `ADMIN_ONLY` \| `AUTHENTICATED`(§2.5) |
| `allowComments` | 댓글 허용 여부(게시판별) |
| `boardType` | 게시판 유형 enum: `GENERAL` \| `NOTICE` \| `EVENT`(프론트 렌더링 변주·정렬 힌트) |

Board는 이번 에픽에서 **시드로만 생성**하나(§9), 컬럼·제약은 런타임 INSERT/UPDATE(향후 관리자 CRUD)를 그대로 견딘다. `slug` 변경은 URL 파급이 커 실무상 불변 취급한다(관리자 CRUD 도입 시 rename 금지 규약 권장).

### 2.2 Post (게시글)

| 필드 | 의미 |
|---|---|
| `publicId` | 외부 노출 식별자(ULID, B-004). 상세·수정·삭제 경로 리소스 |
| `boardId` | 귀속 게시판 FK |
| `authorId` | 작성자 FK→user. **웹 작성은 항상 값**(인가 주체=이 컬럼). 흡수된 공지·시스템 글은 NULL 허용(memo `sender_id` 선례) |
| `authorNickname` | 작성 시점 닉 스냅샷(≤30, nick 변경·탈퇴 대비 R1, 목록 조인 회피). 시스템 글은 시드 표시명 |
| `title` | 제목 ≤200자, `@NotBlank` |
| `content` | 본문 TEXT(≤10000자). 이미지는 본문 URL 참조 또는 첨부 갤러리(§7) |
| `viewCount` | 조회수(비정규화, 상세 조회 시 원자 증가 §6.2) |
| `commentCount` | 댓글 수(비정규화 — 목록 N+1 회피, 댓글 생성/삭제와 동일 TX 증감 §6.1) |
| `isPinned` | 상단 고정(공지·이벤트 상단 노출). 목록 정렬 1순위 |
| soft delete | `isDeleted`·`deletedAt` — 삭제 글은 조회에서 제외(NOT_FOUND) |

### 2.3 Comment (댓글) — v1.1 대댓글·반응 확장

| 필드 | 의미 |
|---|---|
| `publicId` | 외부 노출 식별자(ULID) |
| `postId` | 귀속 게시글 FK |
| `authorId` | 작성자 FK→user(웹 작성 항상 값). 인가 주체 |
| `authorNickname` | 작성 시점 닉 스냅샷(≤30) |
| `content` | 본문 ≤1000자, `@NotBlank` |
| `parentCommentId` | 대댓글 앵커(self-FK, nullable). **v1.1 활성** — 답글은 항상 **최상위(루트) 댓글**을 가리킨다(1단계, §13.1). 루트 댓글은 NULL |
| `mentionedNickname` | **v1.1 신설**(nullable) — 답글의 답글일 때 @멘션 대상 닉 스냅샷. 직접 답글·루트 댓글은 NULL(§13.1) |
| `likeCount`·`dislikeCount` | **v1.1 신설** — 공감·비공감 비정규화 카운트(comment_reaction과 동일 TX 원자 증감, §13.2) |
| `replyCount` | **v1.1 신설** — 답글 수 비정규화(루트 댓글만 유효, 답글 생성/삭제 동일 TX 증감) |
| soft delete | `isDeleted`·`deletedAt`. 삭제 루트는 활성 답글 보유 시 tombstone 잔류(§13.4) |

댓글의 대댓글·반응·정렬·BEST 모델 전체는 **§13**(EPIC-COMMENT-V2), 공감/비공감 저장 엔티티 `CommentReaction`은 §13.2 정본이다.

### 2.3.1 CommentReaction (공감/비공감) — v1.1

| 필드 | 의미 |
|---|---|
| `commentId` | 반응 대상 댓글 FK(루트·답글 무관) |
| `userId` | 반응 주체 FK→user(SecurityContext) |
| `reactionType` | `LIKE` \| `DISLIKE`. 전환 시 이 컬럼만 UPDATE |

유저당 댓글당 **1행**(UK(comment_id,user_id))·`public_id` 없음(대상 댓글 하위 토글, URL 리소스 아님)·soft delete 없음(취소=물리 DELETE). 상세 = §13.2·erd §4.5.

### 2.4 PostImage (이미지 첨부)

2단계 업로드(§7): 먼저 업로드해 `publicId`·`url`을 받고, 게시글 생성/수정 시 `imagePublicIds[]`로 귀속한다.

| 필드 | 의미 |
|---|---|
| `publicId` | 외부 노출 식별자(ULID). 이미지 리소스·raw 서빙 경로 키 |
| `postId` | 귀속 게시글 FK(**nullable** — 업로드 시점엔 NULL "고아", 게시글 저장 시 바인딩) |
| `uploaderId` | 업로더 FK→user(NOT NULL). 고아 정리·바인딩 인가(업로더만 자기 이미지 귀속) |
| `storageKey` | 스토리지 내부 키(경로/객체키, 예: `board/2026/08/<ulid>.webp`). 백엔드 전용·미노출 |
| `contentType`·`fileSize`·`originalFilename` | 메타(검증·표시) |
| `sortOrder` | 게시글 내 표시 순서 |

고아(게시글에 끝내 귀속되지 않은 이미지)는 배치/TTL sweeper로 정리한다(구현 세부는 FC-200, 이번 계약은 컬럼·정리 훅 존재만 규정).

### 2.5 서비스 내부 계산 VO

인가 판정 결과는 서비스 내부 record VO로 추출한다(영속·직렬화 아님 → `service/` 잔류, V2 §9.10). 예: `WriteAccess`(허용·거부사유), `PostEditContext`(작성자/관리자 여부). 웹 노출 계약은 `dto/`(§10), 영속은 `entity/`.

---

## 3. Board 레지스트리 — 옵션 모델

게시판별 정책 3축(게이트2 (c) 범위):

- **`writePolicy`** — 누가 글을 쓰는가.
  - `ADMIN_ONLY` — 관리자만 작성/수정/삭제(공지·이벤트).
  - `AUTHENTICATED` — 로그인 회원 누구나 작성(커뮤니티).
- **`allowComments`** — 이 게시판 글에 댓글을 달 수 있는가(공지=false, 커뮤니티·이벤트=true).
- **`boardType`** — `GENERAL`/`NOTICE`/`EVENT`. 프론트 렌더링 변주(이벤트=배너 강조 등)·정렬 힌트. **인가에는 관여하지 않는다**(인가는 `writePolicy`가 단독 결정).

옵션은 Board 행의 컬럼이므로 런타임(향후 관리자 CRUD)에 변경 가능하다. 확장 후보(이번 에픽 제외, §11(c)): 게시글 길이 상한·첨부 개수 상한·읽기 정책(비밀 게시판)·카테고리 태그. YAGNI로 지금 컬럼화하지 않는다.

---

## 4. 인가 규칙 (핵심)

주체는 **SecurityContext의 인증 주체(userId)**다 — 경로·바디 어디에도 작성자 식별자를 두지 않는다(B-009, IDOR 설계 차단). 관리자 여부는 JWT `admin` 클레임 → `ROLE_ADMIN` 권한(SecurityConfig·JwtAuthenticationFilter 기존 배선)으로 판정한다. 서비스는 `SecurityContextHolder`에서 `userId`와 `ROLE_ADMIN` 보유를 읽는다(auction `currentUserId()` 선례 + authorities 검사).

| 동작 | 인가 규칙 | 위반 시 |
|---|---|---|
| 게시판 목록·글 목록·글 상세·댓글 목록·답글 목록·BEST 댓글·이미지 조회 | **공개**(인증 불요, 인증 시 뷰어종속 `myReaction`·`editable` 부여) | — |
| 게시글 작성 | 인증 필요 + `board.isActive` + `writePolicy` 충족: `ADMIN_ONLY`→`ROLE_ADMIN` 필요 / `AUTHENTICATED`→임의 인증 | 미인증 401 · 정책 위반 `BOARD_002`(403) · 비활성 `BOARD_001`(404) |
| 게시글 수정·삭제 | 인증 필요 + (**작성자 본인** `authorId==subject`) **OR** `ROLE_ADMIN` | `POST_002`(403) |
| 댓글 작성 | 인증 필요 + `board.allowComments==true` + 글 존재(미삭제) | 비허용 `BOARD_003`(422) · 글 없음 `POST_001`(404) |
| 댓글 수정·삭제 | 인증 필요 + (작성자 본인) OR `ROLE_ADMIN` | `COMMENT_002`(403) |
| 답글 작성 | 인증 필요 + `board.allowComments==true` + 대상 댓글·글 존재(미삭제) | 비허용 `BOARD_003`(422) · 대상 없음 `COMMENT_001`(404) |
| 댓글·답글 반응(공감/비공감 토글) | 인증 필요 + 대상 댓글 존재(미삭제) + **본인 댓글 아님** | 대상 없음 `COMMENT_001`(404) · 자기 반응 `COMMENT_003`(422) |
| 이미지 업로드 | 인증 필요(임의 인증) | 401 |

인가 불변식:
- **I-1 (주체 권위)** — 작성자·업로더는 요청 바디가 아니라 토큰 주체로만 취한다. 클라가 `authorId`를 보내도 무시.
- **I-2 (IDOR 차단)** — 수정·삭제는 대상 리소스의 `authorId`와 주체 동일성을 서버가 검사한다. `ROLE_ADMIN`만 타인 리소스 수정 허용.
- **I-3 (쓰기정책 게이팅)** — `ADMIN_ONLY` 게시판의 작성/수정/삭제는 `ROLE_ADMIN` 없이는 전부 403(`BOARD_002`). 작성자라도 게시판이 ADMIN_ONLY면 비관리자 수정 불가(공지 흡수 후 공지 글은 관리자만).
- **I-4 (열거 완화)** — 타인 글 수정 시도의 403(`POST_002`)과 글 미존재 404(`POST_001`)는 구분한다(글 존재는 이미 공개 목록에 노출되므로 열거 이득 없음, SEC-007 무해). 이미지 raw는 public_id(ULID)라 열거 무해.

---

## 5. 불변식 (도메인)

- **B-1** `board.slug`는 전역 유일(활성/비활성 무관, plain UK). 비활성화로 "삭제"하므로 slug 재사용 충돌이 없다(soft delete 미도입 → D-081 패턴 불요).
- **P-1** Post는 항상 하나의 Board에 귀속(`boardId` NOT NULL). 게시판이 비활성이어도 기존 글은 상세 조회 가능(목록은 비노출 정책 선택 — 기본 노출 유지, 쓰기만 차단).
- **P-2** soft delete된 글·댓글은 목록·상세·카운트에서 제외(`isDeleted=false` 필터 동반 필수 — notice 선례, N+1/다건 바인딩 파손 방지).
- **C-1** Comment는 항상 하나의 Post에 귀속. 글이 soft delete되면 그 댓글은 조회에서 함께 사라진다(글 필터로 자연 배제, 댓글 개별 정리 불요).
- **I-1(이미지)** PostImage.`postId`는 바인딩 전 NULL(고아), 바인딩 후 고정. 한 이미지는 한 게시글에만 귀속(재귀속 금지). 바인딩은 업로더==작성자==주체일 때만.
- **N-1(비정규화 정합)** `post.commentCount`는 댓글·답글 생성 시 +1, soft delete 시 −1을 **동일 TX**에서 수행한다(루트·답글 모두 총계에 포함, §6.1). `post.viewCount`는 상세 조회 시 원자 증가(§6.2).
- **C-2(대댓글 1단계)** 답글의 `parentCommentId`는 항상 **루트 댓글**(자신이 `parentCommentId IS NULL`)만 가리킨다. 답글에 대한 답글도 그 루트에 귀속(2단계 트리 금지, §13.1).
- **R-1(반응 유일)** 한 유저는 한 댓글에 반응 1행만 갖는다(UK(comment_id,user_id) DB 강제). `LIKE↔DISLIKE` 전환은 행 UPDATE, 취소는 DELETE — 어떤 경로도 2행을 만들지 않는다(§13.2).
- **R-2(카운트 정합)** `comment.likeCount`/`dislikeCount`는 반응 행 변화와 **동일 TX 원자 UPDATE**로만 증감한다. `comment.replyCount`는 답글 생성/삭제와 동일 TX 증감(루트 댓글 대상).
- **R-3(자기 반응 금지)** 본인 작성 댓글에는 공감/비공감 불가(`COMMENT_003`, 422 — self-bid `BID_003` 선례).

---

## 6. 상태·카운터

### 6.1 comment_count (비정규화)
목록(`PostSummary`)이 댓글 수를 싣는데 글마다 `COUNT(comment)` 서브쿼리는 N+1이다. `post.comment_count`를 비정규화하고 댓글 생성/삭제와 동일 TX에서 증감한다. 초기 흡수·시드 글은 0. **v1.1**: 답글(대댓글)도 댓글이므로 **총계에 포함**한다 — 답글 생성 시에도 `post.comment_count` +1, 답글 삭제 시 −1(헤더 "댓글 N"은 루트+답글 총합, 네이버 동일). 루트별 답글 수는 별도 `comment.reply_count`(§13.3)로 관리한다.

### 6.4 comment 반응·답글 카운트 (비정규화, v1.1)
- `comment.like_count`/`dislike_count`: `comment_reaction` 행 변화(등록·전환·취소)와 **동일 TX 원자 UPDATE**(`SET like_count = like_count ± 1`). in-memory 증감 금지(동시 반응 폭주 손실 방지, N-1 선례).
- `comment.reply_count`(루트만): 답글 생성 +1·soft delete −1을 동일 TX 원자 UPDATE. 삭제 루트 tombstone 판정(§13.4)에 사용.

### 6.2 view_count
게시글 상세(`GET .../posts/{id}`) 조회 시 `UPDATE post SET view_count = view_count + 1 WHERE id=?`로 원자 증가한다. 이번 에픽은 **중복 제거(동일 사용자 재조회 무증가)를 하지 않는다**(단순 카운터). 봇·새로고침 증폭은 감수(포트폴리오 범위) — 향후 조회 로그·TTL 디둡은 확장.

### 6.3 isPinned 정렬
목록 정렬 = `is_pinned DESC, id DESC`(고정 글 최상단, 그 외 최신순). 커서 목록의 커서 키는 `id`(단조)이며 고정 글은 커서 흐름과 별개로 상단 노출(구현 세부 FC-198 — 고정 글을 커서 첫 페이지에 프리펜드하거나 정렬에 포함, 계약은 "고정 우선"만 규정).

---

## 7. 이미지 첨부 (2단계 업로드 + 오브젝트 스토리지) — 게이트2 (a) 확정: 오브젝트 스토리지(MinIO 로컬·S3 운영)

### 7.1 흐름 (2단계 유지)
1. `POST /api/v1/board-images`(multipart `file`) → 서버가 MIME·크기 검증 → **오브젝트 스토리지에 PUT**(object key = `storage_key`) → `PostImage` 생성(`postId=NULL` 고아·`uploaderId=주체`) → `{ imagePublicId, url }` 반환(`url` = presigned GET URL, 단기 TTL).
2. 게시글 생성/수정 요청 바디에 `imagePublicIds[]`를 실어 귀속 → 해당 이미지들의 `postId`를 세팅(업로더==주체 검증, 재귀속 금지).
3. **렌더링**: 게시글 목록·상세 응답의 `images[].url`·`thumbnailUrl`은 서버가 **읽기 시점에 새로 생성한 presigned GET URL**이다. 클라는 이 `url`을 저장·재사용하지 않고 응답마다 갱신된 값을 쓴다.

### 7.2 검증
- 허용 MIME: `image/jpeg`·`image/png`·`image/webp`·`image/gif`. 그 외 `IMAGE_001`(422). MIME은 확장자가 아니라 실제 콘텐츠로 판정(매직바이트 sniff 권장).
- 최대 크기: **5 MB**. 초과 `IMAGE_002`(422).
- 게시글당 첨부 상한: **10장**(초과 시 게시글 저장 400 검증).

### 7.3 스토리지 키 규약 (`storage_key`)
object key = `board/{yyyy}/{MM}/{imagePublicId}.{ext}` (예: `board/2026/08/01J8XR....webp`). `{ext}`는 `content_type` 매핑(jpeg→jpg·png→png·webp→webp·gif→gif). `imagePublicId`(ULID)로 버킷 내 유일. `storage_key`는 백엔드 전용·미노출 — 외부는 `publicId`와 presigned `url`만 본다.

### 7.4 서빙 전략 = presigned GET URL (게이트2 (a) 확정)
- **결정: 비공개 버킷 + 서버 생성 presigned GET URL.** 백엔드 프록시 스트리밍·공개-read 버킷 대신 presigned를 채택한다.
- 근거(3안 비교):
  - **presigned GET(채택)** — 스토리지가 바이트를 직접 서빙 → 백엔드 대역폭·프록시 비용 0(이미지는 JSON과 달리 페이로드가 큼). 비공개 버킷 유지 → 공개-read 버킷 정책 오구성(전형적 유출 사고) 회피. MinIO·S3 동일 SigV4 presign → 로컬/운영 코드 단일. URL이 시간제한이라 유출 노출면도 제한.
  - **백엔드 프록시 스트리밍(기각)** — 스토리지를 완전 은닉하나 모든 이미지 트래픽이 앱을 통과해 대역폭·스레드를 소모(이미지 규모에서 비효율). CDN 오프로드 불가.
  - **공개-read 버킷 + 직접 URL(기각)** — 가장 단순·캐시 최적이나 버킷 공개 정책 오구성 리스크. 게시판 이미지가 공개 콘텐츠라 기밀성 이슈는 없으나, 비공개 버킷+presigned가 보안 기본값으로 더 안전하고 향후 비공개 첨부(예: 신고 첨부)와 단일 경로.
- **TTL**: 기본 1시간(`board.image.storage.presign-ttl`, 설정). 게시판 이미지는 공개 콘텐츠라 presigned는 인가 게이팅이 아니라 "버킷 비공개 + 안정 접근" 목적이다 — 캐시 친화적으로 넉넉히 둔다.
- **`content` 본문에는 storage URL을 저장하지 않는다.** 이미지는 **첨부 갤러리(`images[]`) 모델**로 렌더한다(본문 이미지·이벤트 배너 = 첨부, `sort_order`로 배치). presigned 만료 URL이 본문 TEXT에 박히는 문제를 원천 차단한다. (향후 마크다운 인라인 임베드가 필요하면 안정 참조 → 302 redirect-to-presigned 엔드포인트를 가법 도입 — 이번 에픽 범위 밖.)

### 7.5 스토리지 추상화 (StoragePort)
도메인은 `StoragePort` 인터페이스에만 의존한다(`infra`에 구현). 계약:
- `store(bytes, contentType, key)`
- `presignedGetUrl(key, ttl) -> url`(클라 노출용)
- `delete(key)`(고아·게시글 삭제 정리용)

**단일 S3 호환 구현**(AWS SDK v2 `S3Client`)이 endpoint 설정만으로 MinIO(로컬)·S3(운영)를 모두 커버한다 — 별도 LocalDisk 구현 없음(게이트2 (a) B 채택). MinIO는 S3 API 호환이라 `endpoint-override`만 다르다.

### 7.6 로컬 인프라 (MinIO) — `docker-compose.local.yml` 추가 (FC-200 산출)
백엔드 구현 티켓(FC-200)이 아래 서비스를 `backend/docker-compose.local.yml`에 추가한다(이 스펙이 규격):
```yaml
  minio:
    image: minio/minio:RELEASE.2024-xx   # 버전 핀(구현 시 최신 안정 태그 고정)
    container_name: finalcall-minio
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # 콘솔(로컬 확인용)
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-finalcall}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-finalcall-local}   # 로컬 전용 일회성 값
    command: server /data --console-address ":9001"
    volumes:
      - finalcall-minio-data:/data
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9000/minio/health/live || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
# volumes: finalcall-minio-data 추가
```
버킷 `finalcall-board-images`는 (i) `mc`를 쓰는 일회성 `createbuckets` init 컨테이너 또는 (ii) 앱 부팅 시 존재 확인·생성(idempotent) 중 하나로 준비한다(구현 판단 FC-200 — 앱 부팅 자동 생성이 런북 단순). 버킷 정책=비공개(presigned 전용).

### 7.7 설정 (env-ification — MEMORY "설정 env화 선호")
```
board.image.storage.endpoint     = ${BOARD_IMAGE_ENDPOINT:http://localhost:9000}   # 운영: S3(미지정 시 AWS 기본 리전 엔드포인트)
board.image.storage.region       = ${BOARD_IMAGE_REGION:us-east-1}
board.image.storage.bucket       = ${BOARD_IMAGE_BUCKET:finalcall-board-images}
board.image.storage.access-key   = ${BOARD_IMAGE_ACCESS_KEY:finalcall}       # 운영: 기본값 없음(fail-fast) 또는 IAM 역할
board.image.storage.secret-key   = ${BOARD_IMAGE_SECRET_KEY:finalcall-local} # 운영: 기본값 없음(fail-fast)
board.image.storage.presign-ttl  = ${BOARD_IMAGE_PRESIGN_TTL:PT1H}
board.image.storage.path-style   = ${BOARD_IMAGE_PATH_STYLE:true}            # MinIO=true(path-style), S3=false 권장
```
바인딩은 `@ConfigurationProperties`+`@Validated`(CLAUDE.md §4). 로컬은 `${ENV:기본값}`, 운영은 시크릿 기본값 제거(누락 시 부팅 실패, 시크릿 fail-fast). 운영 S3는 액세스키 대신 IAM 역할 주입을 권장(구현 시 SDK 기본 자격증명 체인 활용).

---

## 8. 공지(notice) 흡수 (게이트2 (b) 대상)

기존 `notice`는 이 시스템의 **공지 게시판(slug=`notice`, boardType=NOTICE, writePolicy=ADMIN_ONLY, allowComments=false)**으로 흡수한다.

### 8.1 데이터 이관
Flyway 마이그레이션으로 `notice` 행을 `post`로 복사:
- `notice.title → post.title`, `notice.content → post.content`(≤2000 ⊂ TEXT 무손실).
- `notice.created_at/updated_at → post.*`(시각 보존).
- `post.board_id =` 공지 게시판 id(동일 마이그레이션 시드).
- `post.author_id = NULL`, `post.author_nickname =` "공지사항" 스냅샷 — 공지는 ADMIN_ONLY라 author 기반 인가에 의존하지 않는다(관리자만 수정).
- `notice.type(NoticeType)` 매핑: `URGENT → post.is_pinned=true`, `GENERAL/EVENT → is_pinned=false`. NoticeType 축은 소멸(공지 게시판 내부 세분류는 이번 범위 밖 — 필요 시 향후 태그).
- **활성 판정 = `notice.is_deleted = false`(확정)** — 삭제 공지는 이관 제외. `view_count=0`·`comment_count=0`.

### 8.2 notice 도메인 제거 범위
- 코드 제거: `com.finalcall.domain.notice.**`(entity·controller·service·dto·repository·NoticeType), `common.exception.NoticeErrorCode`.
- SecurityConfig `/notices/**` permitAll 라인 제거(신규 board 경로는 §6 계약대로 permitAll/authenticated 재배선).
- `notice` 테이블: 데이터 이관 후 **DROP은 후속 마이그레이션으로 분리(확정)** — 즉시 드롭 대신 1버전 유예(롤백 안전).

### 8.3 참조 구현 승계 (확정)
CLAUDE.md §1은 notice를 "참조 구현(컨벤션 쇼케이스)"으로 명시한다. 제거 시 그 쇼케이스가 사라지므로 — **board 도메인이 새 참조 구현이 된다**(더 풍부: 커서 목록·soft delete·IDOR·다중 엔티티·2단계 업로드·비정규화 카운터). **CLAUDE.md §1 notice bullet → board 갱신도 사용자 승인 완료** — FC-201이 notice 코드 제거와 함께 이 CLAUDE.md 문서 갱신을 처리한다(문서 변경은 사용자 승인분).

### 8.4 프론트 전환
- `/community`(현 `CommunityPage` ComingSoon) → 실제 커뮤니티 게시판(목록·상세·작성).
- 공지 표기(HomeSection "공지" 변주·홈 위젯) → 새 board API(`/boards/notice/posts`)로 전환.
- 게시판 목록 진입점(`/boards` 또는 슬러그별 라우트)은 FC-202 디자인 게이트에서 확정.

---

## 9. 시드 (Flyway)

| slug | name | boardType | writePolicy | allowComments | sortOrder |
|---|---|---|---|---|---|
| `notice` | 공지사항 | NOTICE | ADMIN_ONLY | false | 0 |
| `community` | 커뮤니티 | GENERAL | AUTHENTICATED | true | 1 |
| `event` | 이벤트 | EVENT | ADMIN_ONLY | true | 2 |

공지 게시판 시드 후 §8.1 이관이 뒤따른다(동일 그룹 마이그레이션, board→post 순서 FK). 데모 커뮤니티 글 시드는 선택(LocalDemoSeeder 계열, 운영 마이그레이션과 분리).

---

## 10. 계약 매핑

- **스키마 정본** = `erd.md` §4.5(`board`·`post`·`comment`·`post_image`) + §5 인덱스 + §6 Flyway group 7.
- **API 정본** = `api-contract.md` §6(게시판·게시글·댓글·이미지 엔드포인트·에러코드).
- **DTO 어휘(V2 §9.7)**: 웹 DTO 접미사 = `Request`·`Response`·`CursorResponse<T>`뿐. 목록 항목은 `PostSummary`·`CommentResponse`(응답 내부 static record 또는 top-level record), 상세는 `PostDetailResponse`. `*Command`/`*Result`는 board feature에서 도입하지 않는다(서비스가 웹 DTO 직접 수령·반환 — bid/settlement 외 feature 규약).
- **ErrorCode(V2 §9.8)**: `com.finalcall.common.exception`에 중앙화. `BoardErrorCode`(BOARD_*)·`PostErrorCode`(POST_*)·`CommentErrorCode`(COMMENT_*)·`BoardImageErrorCode`(IMAGE_*) — 엔티티별 enum 분리(병합 금지). 코드 표 = api-contract §5.

---

## 11. 게이트2 3건 — 사용자 승인 확정 (2026-08-06)

### (a) 이미지 저장 위치 — **확정: 오브젝트 스토리지(MinIO 로컬 · S3 운영)**
- **결정**: 로컬 개발=MinIO(docker-compose 컨테이너 추가, §7.6), 운영=S3. `StoragePort` 추상화 유지하되 **기본 구현을 S3 호환(MinIO/S3) 단일 구현**으로 배선(로컬 디스크 구현 없음). 서빙=비공개 버킷 + presigned GET URL(§7.4). 상신 시 권장했던 A(로컬 디스크)에서 **B(오브젝트 스토리지)로 확정**됐다 — 포트폴리오의 운영 현실성(S3 실전 배선·AWS 스펙 힌트 Stage G 정합)을 우선한다.
- **파급**: §7 전면 재작성(presigned 서빙·storage_key 규약·MinIO 인프라·env), erd `post_image` 주(스토리지=오브젝트), api-contract §6.4(presigned url·`/raw` 프록시 제거).

### (b) 공지(notice) 흡수 전략 — **확정: 이전 + 정리 + board 참조구현 승계**
- **결정**: 활성 공지만 `post`로 이관 → notice 도메인 코드·`NoticeErrorCode`·`/notices/**` 배선 제거 → `notice` 테이블 **1버전 유예 후 DROP**(롤백 안전) → **board 도메인을 새 참조 구현으로 지정**. **CLAUDE.md §1 "notice=참조 구현" bullet → board 갱신도 사용자 승인 완료** — FC-201이 코드 제거 + 이 CLAUDE.md 문서 갱신을 **함께 처리**한다(§8.3).
- **이관 방식(확정)**: `INSERT INTO post (board_id, author_id, author_nickname, title, content, is_pinned, created_at, updated_at, ...) SELECT <공지board_id>, NULL, '공지사항', title, content, (type='URGENT'), created_at, updated_at, ... FROM notice WHERE is_deleted = false`. 활성 판정 기준 = `notice.is_deleted = false`(삭제 공지 이관 제외). `author_id = NULL`(원 작성자 미상·공지 board는 ADMIN_ONLY라 author 기반 인가 불의존), `author_nickname = '공지사항'` 스냅샷. `NoticeType.URGENT → is_pinned=true`, `GENERAL/EVENT → false`. `view_count=0`·`comment_count=0`.

### (c) 게시판 옵션 모델 범위 — **확정: 표준 3축**
- **결정**: `write_policy`(ADMIN_ONLY|AUTHENTICATED) · `allow_comments` · `board_type`(GENERAL|NOTICE|EVENT). 대댓글은 컬럼(`parent_comment_id`)만 예약하고 UI는 다음 에픽. 읽기정책·태그·길이/첨부 상한 등은 YAGNI로 제외(향후 관리자 CRUD 에픽에서 가법 추가 — 스키마가 이를 견딤).
  - **(v1.1 갱신)** "다음 에픽" = **EPIC-COMMENT-V2**(FC-206)가 이 예약을 활성화한다 — 대댓글 1단계·공감/비공감·정렬·BEST(§13·§14). 이 §11(c)는 v1.0 확정 시점 기록이며, 대댓글 모델 정본은 §13이다.

---

## 12. 하위 티켓 매핑

| 티켓 | 산출 | 계약 근거 |
|---|---|---|
| FC-197 | Board 엔티티 + 시드(3게시판) Flyway | §2.1·§9·erd §4.5·§6 group 7 |
| FC-198 | Post CRUD·커서목록·인가·비정규화 카운터 | §2.2·§4·§6·api §6 |
| FC-199 | Comment CRUD·인가·댓글허용 게이팅 | §2.3·§4·api §6 |
| FC-200 | 이미지 업로드 API + StoragePort(S3 호환) + MinIO 로컬 인프라(docker-compose)·presigned 서빙 | §7·게이트2(a) |
| FC-201 | 공지 흡수 — 데이터 이관(V23) + notice 도메인·NoticeErrorCode·`/notices/**` 제거 + **CLAUDE.md §1 참조구현 bullet→board 갱신**(사용자 승인됨) + 라우팅 호환 | §8·§11(b) |
| FC-202 | 게시판/글목록/상세/작성 화면(디자인 게이트) | §8.4·api §6 |
| FC-203 | 댓글 UI | §2.3·api §6 |
| FC-204 | 이미지 첨부 UI + 공지 페이지 새 API 전환 | §7·§8.4 |

EPIC-COMMENT-V2 하위 티켓(§13·§14):

| 티켓 | 산출 | 계약 근거 |
|---|---|---|
| FC-206 | 댓글 v2 계약·스키마(이 문서 v1.1·erd v1.9·api §6.3·§14 게이트2) | §13·§14 |
| FC-207 | 대댓글 threading(V24 스키마) + 답글 목록·답글 작성 API + 루트 replyCount + tombstone | §13.1·§13.4·api §6.3 |
| FC-208 | 공감/비공감 — comment_reaction·토글(등록·전환·취소)·카운트 비정규화 | §13.2·api §6.3 |
| FC-209 | 정렬(순공감/최신/과거) + BEST 댓글 | §13.3·api §6.3 |
| FC-210 | 네이버식 댓글 UI — 대댓글·답글 펼치기·답글 폼·@멘션(디자인 게이트) | §13.1·api §6.3 |
| FC-211 | 공감/비공감 버튼·카운트 | §13.2·api §6.3 |
| FC-212 | 정렬 드롭다운 + BEST 표시 | §13.3·api §6.3 |

---

## 13. 댓글 v2 — 대댓글·공감/비공감·정렬·BEST (EPIC-COMMENT-V2)

게이트1 확정(2026-08-06): **풀 네이버**(대댓글 + 공감/비공감 + 정렬 + BEST) · 중첩 **1단계**. 기존 평면 댓글(§2.3 v1.0)을 확장한다. 정본 스키마 = erd §4.5(`comment` 확장·`comment_reaction`), API = api-contract §6.3.

### 13.1 대댓글 (답글) — 1단계 저장 모델

- **저장 형상**: 답글은 `parent_comment_id`로 **루트 댓글**(자신이 `parent_comment_id IS NULL`인 최상위 댓글)에 귀속한다. 트리는 **깊이 1단계로 평탄화**된다 — 답글의 답글도 물리적으로 같은 루트에 붙는다(2단계 트리 없음, C-2).
- **답글 대상 = 경로의 댓글**: 답글 작성은 대상 댓글의 `commentPublicId`를 경로로 받는다(§api 6.3 `POST …/comments/{commentPublicId}/replies`). 서버가 대상 댓글을 로드해 루트를 해석한다:
  - 대상이 **루트**(`parentCommentId IS NULL`)면 → 새 답글 `parentCommentId = 대상.id`, `mentionedNickname = NULL`(루트에 직접 단 답글, 멘션 없음).
  - 대상이 **답글**(`parentCommentId != NULL`)이면 → 새 답글 `parentCommentId = 대상.parentCommentId`(같은 루트로 평탄화), `mentionedNickname = 대상.authorNickname`(그 답글 작성자에게 @멘션).
- **@멘션 표현(게이트2 (a) 권장안)**: 대상 닉 **스냅샷 1컬럼**(`mentioned_nickname`)만 저장한다 — 대상 `commentPublicId` 참조는 저장하지 않는다. 표시는 프론트가 `mentionedNickname`을 답글 본문 앞 `@닉` 배지로 렌더(네이버 형상). 대상 댓글로의 스크롤/링크는 이 에픽 범위 밖(닉 스냅샷은 닉 변경·탈퇴에도 안정, R1 선례). 멘션은 **인가·알림에 관여하지 않는다**(순수 표시).
- **답글 목록 지연 로딩**: 루트 목록은 답글 본문을 싣지 않고 `replyCount`만 싣는다(네이버 "답글 N개"). 프론트가 펼칠 때 `GET …/comments/{root}/replies`(offset·id asc 시간순)로 답글을 가져온다.
- **삭제**: 답글 soft delete는 완전 배제(§13.4). 루트 삭제 시 활성 답글이 있으면 tombstone(§13.4).

### 13.2 공감/비공감 (comment_reaction)

- **엔티티**: `CommentReaction{ commentId, userId, reactionType(LIKE|DISLIKE) }`, **UK(comment_id, user_id)**(유저당 댓글당 1행). 루트·답글 모두 반응 대상.
- **토글 의미론**(단일 엔드포인트 `PUT …/reaction { type }`, 게이트2 (b)):

| 현재 내 반응 | 요청 type | 동작 | 카운트 델타(동일 TX) |
|---|---|---|---|
| 없음 | LIKE | INSERT(LIKE) | like +1 |
| 없음 | DISLIKE | INSERT(DISLIKE) | dislike +1 |
| LIKE | LIKE | DELETE(취소) | like −1 |
| LIKE | DISLIKE | UPDATE(→DISLIKE) | like −1, dislike +1 |
| DISLIKE | DISLIKE | DELETE(취소) | dislike −1 |
| DISLIKE | LIKE | UPDATE(→LIKE) | dislike −1, like +1 |

- **카운트 비정규화(R-2)**: 위 델타는 `comment.like_count`/`dislike_count`에 **동일 TX 원자 UPDATE**로 반영(§6.4). in-memory 증감 금지. 반응 행과 카운트가 한 TX라 손실 증분 없음.
- **동시성**: UK가 중복 INSERT를 DB에서 차단(경합 시 한쪽 UK 위반 → 재조회·전환 경로). 카운트 UPDATE는 원자 증감이라 동시 반응에서 손실 없음.
- **자기 반응 금지(R-3)**: 대상 댓글 `authorId == 주체`면 `COMMENT_003`(422).
- **myReaction 노출**: 목록·답글·BEST 응답의 `myReaction`은 뷰어 종속(`LIKE`|`DISLIKE`|`null`)이다 — 인증 시 뷰어의 반응 행을 배치 조회(`comment_id IN (…) AND user_id=주체`, UK 커버)해 채우고, 비인증은 `null`. `editable`(§1.0)과 같은 optional-auth 패턴(토큰 있으면 붙임, `getComments` 선례).

### 13.3 정렬 · BEST 댓글

- **루트 목록 정렬 param** `sort`(query, 루트 목록에만 적용):

| 값 | 의미 | 정렬 키 |
|---|---|---|
| `LATEST` | 최신순(기본값) | `id DESC` |
| `OLDEST` | 과거순(작성순) | `id ASC` |
| `LIKES` | 순공감순 | `like_count DESC, id DESC` |

기본값 = **`LATEST`(최신순)**(게이트2 사용자 확정 2026-08-06 — 초안 `LIKES`에서 변경). 화이트리스트 외 값은 검증 400. 정렬 키 ↔ 인덱스 1:1(erd §5, B-006) — `LATEST`·`OLDEST`는 `(post_id, parent_comment_id, id)` 인덱스가 정·역방향 모두 커버(id 단조), `LIKES`는 `(post_id, parent_comment_id, like_count)`가 커버. **답글 목록은 항상 `OLDEST`(id asc) 고정**(스레드 시간순, param 없음). **BEST 댓글은 목록 기본 정렬과 무관하게 공감 상위 기준 유지**(§13.3 BEST 항).

- **BEST 댓글**: 루트 댓글 중 `like_count >= board.comment.best.min-likes`(설정, 권장 기본 3)인 것을 `(like_count − dislike_count) DESC, id DESC`로 정렬해 상위 `board.comment.best.max-count`(설정, 권장 기본 3)건. 답글은 BEST 대상 아님. 삭제·tombstone 루트 제외. 임계 미달이면 빈 목록(BEST 섹션 미노출).
- **노출 방식**: **별도 엔드포인트** `GET …/comments/best`(§api 6.3)로 BEST 목록을 반환한다(정렬 목록과 분리 — BEST는 정렬 param과 무관한 고정 랭킹이라 페이지네이션에 얽지 않는다). 프론트는 BEST 섹션을 상단에 렌더하고, 그 아래 정렬 목록(`GET …/comments?sort=`)을 렌더한다. BEST 댓글은 정렬 목록에도 **중복 노출**된다(네이버 동일 — BEST는 하이라이트일 뿐 목록에서 빼지 않는다). 설정값은 데모 트래픽에 맞춰 낮출 수 있다(포트폴리오).

### 13.4 삭제 댓글 tombstone (스레드 보존)

- **답글 삭제** → 목록에서 완전 배제(활성 필터). 루트 `reply_count` −1(동일 TX).
- **루트 삭제**:
  - 활성 답글 **없음**(`reply_count == 0`) → 완전 배제(v1.0 동작).
  - 활성 답글 **있음**(`reply_count > 0`) → **tombstone 잔류**: 목록에 남되 본문·작성자·반응을 마스킹한다(응답 `deleted: true`·`content: null`·`authorNickname: null`·`likeCount/dislikeCount: 0`·`editable: false`·`myReaction: null`). `replyCount`·`createdAt`은 유지해 답글 접근을 보존한다. 삭제 루트에는 신규 답글·반응 불가(`COMMENT_001`).
- **루트 목록 쿼리**: `post_id=? AND parent_comment_id IS NULL AND (is_deleted=false OR reply_count>0)`. tombstone 판정은 인출 후 매핑에서 수행(글당 소규모, erd §5 인덱스 주). `post.comment_count`는 삭제 시점에 이미 −1 됐으므로 tombstone은 헤더 총계에 포함하지 않는다(본문이 사라진 자리표시일 뿐).

### 13.5 서비스 구조 (V2 §9.10)

오케스트레이션 `CommentService` + 협력 빈. 반응 토글 판정은 내부 계산 VO(`ReactionDecision{ delta, resultingType }` 등, 영속·직렬화 아님 → `service/` 잔류)로 추출 가능. `CommentReaction` 엔티티·`CommentReactionRepository`는 board feature 내 `entity/`·`repository/`. 반응 카운트 원자 UPDATE는 `CommentRepository` default/`@Modifying` 메서드(`incrementLikeCount` 등, `PostRepository.incrementCommentCount` 선례).

---

## 14. 게이트2 3건 — EPIC-COMMENT-V2 (사용자 승인 확정 2026-08-06)

> **확정**: (a) A1 · (b) B1 · (c) C1 전부 권장안대로 승인. **기본 정렬은 사용자가 `LATEST`(최신순)로 확정**(초안 `LIKES`에서 변경, §13.3). 삭제 tombstone·자기 반응 금지(COMMENT_003)·comment_count 루트+답글 총계 모두 확정. 아래 각 항의 "권장안"이 확정안이다.

### (a) 답글(대댓글) 저장 모델 · @멘션 표현 — **확정: A1 = 1단계 평탄화 + 닉 스냅샷 멘션**

- **권장안**: 모든 답글을 루트 댓글에 `parent_comment_id`로 귀속(1단계). 답글의 답글도 같은 루트로 평탄화하고, 대상 답글 작성자 닉을 `mentioned_nickname`(스냅샷 1컬럼)에 저장해 `@닉`으로 표시(§13.1).
- **선택지**: (A1) 1단계 평탄화 + 닉 스냅샷 멘션(권장) · (A2) 1단계 + 대상 `commentPublicId` 참조까지 저장(대상 댓글 링크·스크롤 가능) · (A3) 진짜 N단계 트리(재귀 조회).
- **근거**: 게이트1이 "1단계·@멘션"으로 확정 → A3 기각. A2는 대상 댓글 링크가 가능하나 이 에픽 UI 범위(펼침·@배지)엔 불필요하고 대상 삭제 시 dangling 참조 관리 부담. A1은 닉 스냅샷이라 대상 삭제·닉 변경에 안정(R1 선례)이고 저장·렌더가 최소. 향후 링크가 필요하면 A2로 가법 확장(스키마가 견딤).

### (b) 반응 스키마 (comment_reaction) — **확정: B1 = 유저당 1행 UK + 원자 카운트 비정규화**

- **권장안**: `comment_reaction(comment_id, user_id, reaction_type)` + **UK(comment_id, user_id)**. LIKE↔DISLIKE 전환 = 행 UPDATE, 취소 = 행 DELETE(§13.2 표). `comment.like_count`/`dislike_count`는 반응 변화와 **동일 TX 원자 UPDATE**로 동기화. 단일 토글 엔드포인트 `PUT …/reaction { type }`가 등록·전환·취소를 모두 흡수하고 결과 상태(`{ likeCount, dislikeCount, myReaction }`)를 반환.
- **선택지**: (B1) 유저당 1행 UK + 비정규화 카운트(권장) · (B2) append-only 반응 로그(취소도 새 행) + 실시간 `COUNT`/집계 · (B3) 카운트만 컬럼(개별 반응 행 없음, myReaction 불가).
- **근거**: B3은 myReaction·중복 방지 불가(뷰어가 자기 반응을 알 수 없고 중복 반응 차단 불가) → 기각. B2는 감사 이력엔 좋으나 매 조회 집계 비용·현재 상태 판정 복잡 → 반응은 이력보다 현재 상태가 본질이라 과설계. B1은 UK가 유일성·이중 카운트를 DB에서 강제(charge.pg_tx_id·money_exchange 멱등 UK 선례)하고, 원자 UPDATE가 동시 반응 폭주에서 손실 없이 카운트를 유지(N-1 비정규화 선례). 카운트가 비정규화라 목록에서 `COUNT` 서브쿼리 N+1 없음.

### (c) 기존 댓글 API 형상 교체 파급 — **확정: C1 = 하위호환 없이 형상 교체(형상보존 예외 승인)**

- **상황**: FC-199(백엔드)·FC-203(프론트)이 방금 배포됐고 **외부 소비자가 없다**(내부 프론트만 이 계약을 소비). 목록 응답이 평면 `CommentResponse{ commentPublicId, authorNickname, content, createdAt, updatedAt, editable }`에서 루트 목록(+`replyCount`·`likeCount`·`dislikeCount`·`myReaction`·`deleted`)으로 바뀌고, `GET /comments`가 이제 **루트 댓글만** 반환한다(답글은 별도 API).
- **권장안**: **버저닝·마이그레이션 없이 형상 직접 교체**(v1.1 계약이 v1.0 응답을 대체). 백엔드 `CommentResponse`/서비스/DTO를 교체하고, 프론트를 새 형상으로 동시 전환. 방금 배포라 유예할 외부 계약이 없어 하위호환 레이어는 순부채다.
- **선택지**: (C1) 형상 직접 교체(권장) · (C2) `v2` 필드 가법(구 필드 유지 + 신 필드 추가, 점진 이행) · (C3) 신규 엔드포인트 병행(구 `/comments`, 신 `/comments?v=2`).
- **근거**: C2·C3은 외부 소비자가 있을 때의 무중단 이행 기법인데 소비자가 내부 프론트 하나뿐이라 이득이 없고 dead 코드·이중 유지만 남긴다. C1이 계약을 단일 진실로 유지한다. **형상 보존 원칙의 예외를 명시적으로 승인받는 항목**(V2 §9.7 "직렬화 JSON 형상 불변"은 어휘 정리에 적용 — 이번은 의도된 계약 형상 변경이라 게이트2로 상신).
- **영향받는 프론트 파일·티켓**(contract-first 파급):
  - `frontend/src/lib/api/comments.ts` — `CommentResponse` 인터페이스에 `replyCount`·`likeCount`·`dislikeCount`·`myReaction`·`deleted` 추가, `getComments`에 `sort` param, 신규 함수 `getReplies`·`createReply`·`toggleReaction`·`getBestComments` (FC-210~212 소비).
  - `frontend/src/lib/queries/comments.ts` — 루트/답글 쿼리 분리, 반응 뮤테이션(낙관적 업데이트+권위 응답), BEST 쿼리, `sort` 키.
  - `frontend/src/features/board/components/CommentSection.tsx` — 정렬 드롭다운·BEST 섹션·루트 목록.
  - `frontend/src/features/board/components/CommentItem.tsx` — 답글 펼치기·답글 폼·@멘션 배지·공감/비공감 버튼·tombstone 렌더.
  - 티켓: **FC-210**(대댓글 UI)·**FC-211**(반응 버튼)·**FC-212**(정렬+BEST)가 위 파일을 소유. 백엔드 **FC-207**(threading·답글 API)·**FC-208**(반응)·**FC-209**(정렬·BEST). 이 4 프론트 파일은 FC-210에서 신 형상으로 1차 전환되고 FC-211·212가 증분한다.
