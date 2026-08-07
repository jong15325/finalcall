# 댓글 소유권·테스트 재현성 품질 정리

> 이 문서는 포트폴리오 재가공을 위한 파생 요약이다. 정본은 계약·코드·파일 티켓 보드이며, 아래 내용은 확인 가능한 구현과 검증만 기록한다.

- **영역/에픽**: EPIC-QUALITY-CLEANUP
- **상태**: 완료 (2026-08-07 게이트3 사용자 승인)
- **기간(커밋 기준)**: 2026-08-07
- **관련 티켓**: FC-194, FC-220~FC-224
- **Jira 미러**: KAN-246(에픽), KAN-220·KAN-249~KAN-253

## 1. 개요

댓글 반응 UI가 “로그인 사용자의 현재 닉네임”과 “댓글 작성 당시 저장된 닉네임”을 비교해 본인 댓글을 판정하고 있었다. 닉네임은 표시용 스냅샷이라 변경될 수 있고, 같은 문자열이 실제 회원 동일성을 보장하지도 않는다. 그 결과 닉네임 변경 후 자기 댓글을 타인 댓글로 오인하거나, 같은 닉네임의 타인 댓글을 자기 댓글로 오인할 수 있었다. 또한 관리자에게는 타인 댓글도 수정 가능하므로 기존 `editable` 필드 역시 소유권 신호로 쓸 수 없었다.

이를 contract-first로 정리해 댓글·답글 응답에 `ownedByMe`를 가법 추가하고, 서버가 `SecurityContext`의 회원 ID와 저장된 작성자 ID를 비교해 계산하도록 했다. 프론트는 닉네임 비교를 제거하고 이 신호만 소비한다. 같은 에픽에서 OAuth 단위 테스트와 백엔드 통합 테스트의 환경 의존성도 격리해 전체 테스트의 재현성을 높였다.

## 2. 해결한 기술 도전과 해법

- **표시 문자열을 신원으로 사용한 오류**: 댓글에는 작성 시점 닉네임 스냅샷이 남지만 로그인 상태에는 현재 닉네임이 들어 있었다. 프론트의 문자열 비교를 제거하고, 서버 내부의 불변 회원 식별자로 `ownedByMe`를 계산했다. 닉네임을 바꾼 작성자도 `true`, 닉네임이 같은 타인은 `false`가 된다.
- **소유권과 관리 권한의 혼합**: `editable`은 작성자뿐 아니라 관리자에게도 `true`다. 계약에서 `editable`(수정·삭제 가능)과 `ownedByMe`(실제 작성자 동일성)를 분리했다. 관리자가 타인 댓글을 보는 경우 `editable=true`, `ownedByMe=false`를 명시적으로 검증했다.
- **클라이언트 제어와 서버 인가의 역할 분리**: 프론트는 `ownedByMe`로 자기 댓글의 반응 버튼을 비활성화하지만, 최종 권위는 서버에 남겼다. 반응 요청 시 서버는 작성자 ID를 다시 비교해 자기 반응을 `COMMENT_003`(422)으로 차단한다. 응답에는 판정키인 `authorId`를 노출하지 않았다.
- **삭제 데이터의 정보 누출 방지**: 답글이 남은 삭제 루트(tombstone)는 본문·작성자·반응과 함께 소유권도 마스킹해 `ownedByMe=false`를 반환한다.
- **환경값에 흔들리는 OAuth 테스트**: 실행 머신의 실제 `VITE_OAUTH_KAKAO_CLIENT_ID`·`VITE_OAUTH_NAVER_CLIENT_ID` 유무가 기본 동작 테스트를 바꾸고 있었다. 각 테스트 시작 시 두 값을 빈 값으로 고정하고, 필요한 사례에서만 명시적으로 주입하도록 바꿨다. 제품 OAuth 구현은 변경하지 않았다.
- **공유 seed·상태에 흔들리는 백엔드 통합 테스트**: 경매 정리 시 전체 삭제 대신 테스트가 생성한 경매만 선별 삭제해 Flyway seed의 외래키 관계를 보존했다. Actuator 검증도 하위 health component 상태에 따라 달라질 수 있는 200 고정 기대 대신, 게이트웨이 필터가 접근을 막지 않는다는 테스트 책임에 맞게 정리했다.

## 3. 핵심 결정과 근거(트레이드오프)

- **응답에 `ownedByMe: boolean`을 가법 추가**: 프론트가 `authorId`를 받거나 닉네임으로 추론하는 대신 서버가 최소 권위값만 제공한다. 기존 엔드포인트·요청·DB 스키마·에러코드는 유지했다. 응답 형상은 늘어나지만, 신원 판정의 단일 책임과 정보 최소 노출을 얻었다. 근거: `docs/spec/api-contract.md` v1.26 §6.3, `docs/spec/board-domain-spec.md` v1.3 §13.2.
- **계약을 먼저 확정하고 백엔드→프론트 순으로 파급**: FC-221에서 의미와 경계값을 승인한 뒤 FC-222가 생산자, FC-223이 소비자를 변경했다. 직접 파급을 두 티켓으로 한정하고 이미 완료된 댓글 기능 티켓은 재개하지 않았다. 계약 커밋 `f8c2aaa`가 구현 커밋 `397be00`, `0ca6cc3`보다 선행한다.
- **UI 힌트와 인가 방어를 이중화**: 자기 댓글 버튼을 미리 막아 사용자 경험을 개선하되, 조작된 클라이언트를 신뢰하지 않고 서버의 `COMMENT_003` 방어를 유지했다.
- **테스트는 외부 환경을 읽지 않고 필요한 입력을 선언**: OAuth 설정이 있는 개발자 PC와 없는 CI가 같은 결과를 내도록 기본 환경을 테스트 안에서 고정했다. 환경별 실제 설정 연동은 제품 코드와 별도 테스트 사례의 책임으로 남겼다.

## 4. 아키텍처

```text
SecurityContext 회원 ID
        │
        ▼
CommentService ── comment.authorId 비교 ──► ownedByMe
        │                                      │
        ├─ editable: 작성자 또는 관리자        ├─ CommentResponse / ReplyResponse
        └─ COMMENT_003: 자기 반응 서버 차단     ▼
                                         CommentItem
                                  자기 반응 UI 비활성화
```

`ownedByMe`는 공개 댓글·답글 조회의 optional-auth 값이다. 비로그인, 관리자의 타인 댓글, tombstone은 `false`다. 프론트의 API 타입과 루트·답글 공용 렌더링 경로가 같은 값을 사용하며, 게스트는 소유권과 무관하게 반응 요청 대신 로그인 흐름으로 이동한다.

## 5. 증거

- **계약·엔드포인트**: `docs/spec/api-contract.md` §6.3 — `GET /api/v1/posts/{postPublicId}/comments`, `GET /api/v1/posts/{postPublicId}/comments/{commentPublicId}/replies`, `PUT /api/v1/posts/{postPublicId}/comments/{commentPublicId}/reaction`; `docs/spec/board-domain-spec.md` §13.2.
- **백엔드 핵심 파일**: `backend/src/main/java/com/finalcall/domain/board/service/CommentService.java`, `backend/src/main/java/com/finalcall/domain/board/dto/CommentResponse.java`, `backend/src/main/java/com/finalcall/domain/board/dto/ReplyResponse.java`.
- **프론트 핵심 파일**: `frontend/src/lib/api/comments.ts`, `frontend/src/features/board/components/CommentItem.tsx`.
- **경계 테스트**: `CommentApiIntegrationTest`(비로그인·작성자·관리자 타인 댓글·닉네임 변경), `CommentReactionApiIntegrationTest`(답글 작성자/타인), `CommentThreadingApiIntegrationTest`(tombstone), `CommentItem.test.tsx`(닉네임 불일치/일치 역경계·관리자·게스트).
- **환경 격리 테스트**: `frontend/src/features/auth/lib/oauth.test.ts`, `backend/src/test/java/com/finalcall/integration/AuctionRegisterConcurrencyIntegrationTest.java`, `backend/src/test/java/com/finalcall/integration/GatewayAccessIntegrationTest.java`.
- **검증 결과**: 에픽 통합 리뷰 기준 백엔드 586/586(ArchUnit 포함), Checkstyle main/test·Spotless 통과; 프론트 714/714, ESLint 오류 0, TypeScript typecheck·production build 통과. 보안 리뷰 critical/major/minor 0/0/0. 기존 React key·lint·청크 크기 경고는 이번 에픽 이전부터 존재한 비회귀 항목으로 기록됐다.
- **리뷰 기록**: `docs/board/reviews/FC-194-review.md`, `FC-220-review.md`~`FC-224-review.md`, `EPIC-QUALITY-CLEANUP-review.md`, `EPIC-QUALITY-CLEANUP-security-review.md`.
- **커밋**: `f8c2aaa` 계약 확정, `bfd4038` 백엔드 환경 의존 통합 테스트 격리, `397be00` 서버 소유권 계산, `0ca6cc3` 프론트 소유권 신호 전환, `f36192c` OAuth 테스트 격리, `0616838` 통합 리뷰·Jira 미러 기록.
- **운영 증거**: 파일 보드가 정본이며 에픽과 하위 티켓의 불변 `jira_key`(KAN-246, KAN-220, KAN-249~253)로 Jira 단방향 미러를 유지했다. Jira는 구현 근거가 아니라 진행 가시성 수단으로 사용했다.
