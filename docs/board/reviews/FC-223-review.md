# FC-223 리뷰

## 판정

PASS — critical 0, major 0, minor 2.

## 확인 내용

- 닉네임 기반 자기 댓글 비교를 제거하고 서버 `ownedByMe`만 반응 가능 여부에 사용한다.
- `editable`은 수정·삭제 인가에만 사용되어 관리자 타인 댓글과 자기 댓글 판정이 분리된다.
- 닉네임 불일치+`ownedByMe=true`, 닉네임 일치+`false`, 관리자 타인, 게스트 경계가 고정됐다.
- 루트와 답글은 동일한 `CommentBody` 및 `ownedByMe` 판정 경로를 사용한다.

## 검증

- 대상 테스트 11/11, TypeScript typecheck, 대상 ESLint 통과.

## 비차단 Minor

1. 답글의 `ownedByMe` 경계를 직접 고정하는 테스트는 없으나 루트와 동일한 렌더링 경로를 사용해 현재 결함은 아니다.
2. 게스트 테스트는 반응 API 미호출을 검증하지만 로그인 경로 이동까지 직접 단언하지 않는다.
