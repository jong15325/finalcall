# EPIC-QUALITY-CLEANUP 보안 리뷰

## 판정

PASS — critical 0, major 0, minor 0.

## 확인 내용

- `ownedByMe`는 SecurityContext 내부 회원 ID와 저장된 작성자 ID로만 계산한다.
- 닉네임, 요청 헤더, 클라이언트 입력을 소유권 판정에 신뢰하지 않는다.
- 관리자 타인 댓글은 `editable=true`, `ownedByMe=false`로 분리된다.
- tombstone은 작성자 정보·반응·편집 권한·소유권을 마스킹하며 `authorId`를 응답에 노출하지 않는다.
- `COMMENT_003`은 잠금 이후 서버 작성자 ID 비교로 계속 강제되어 클라이언트 우회가 불가능하다.
- 뷰어 종속 댓글 응답에 캐시를 사용하지 않아 사용자 간 `ownedByMe` 혼선이 없다.

## 검증

- 댓글 백엔드 통합 테스트 3종 38건 통과.
- 프론트 `CommentItem` 테스트 11건과 TypeScript 검사 통과.
- 백엔드 Checkstyle main/test 통과.
