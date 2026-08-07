# FC-222 리뷰

## 판정

PASS — critical 0, major 0, minor 0.

## 확인 내용

- `ownedByMe`는 SecurityContext 인증 주체 PK와 댓글 작성자 ID를 비교하며 닉네임이나 요청값을 신뢰하지 않는다.
- 비로그인과 관리자 타인 댓글은 `false`, tombstone 루트는 항상 `false`다.
- 답글에도 같은 작성자 ID 판정 경로가 적용된다.
- 기존 자기 댓글 반응 차단 `COMMENT_003` 서버 방어를 유지한다.
- 기존 응답 필드를 보존한 가법적 boolean 추가이며 작성자 ID는 노출하지 않는다.

## 검증

- `CommentApiIntegrationTest` 17건, `CommentReactionApiIntegrationTest` 11건, `CommentThreadingApiIntegrationTest` 10건 통과.
- `checkstyleMain`, `checkstyleTest` 통과.
