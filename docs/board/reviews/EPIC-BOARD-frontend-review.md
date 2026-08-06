# EPIC-BOARD 프론트 통합 리뷰 (FC-202~204)

- 리뷰어: reviewer 서브에이전트 (읽기전용)
- 일자: 2026-08-06
- 대상: FC-202(화면)·FC-203(댓글)·FC-204(이미지·공지전환) working tree
- 계약 정본: api-contract v1.23 §6

## 판정: **CHANGES-REQUESTED** (major 1 · minor 5) → 수정 후 재검

## MAJOR-1 — editable 항상 false (자기 글/댓글 수정·삭제 불능)
- 위치: `lib/api/boards.ts:145-148`(getPost `auth:false`)·`lib/api/comments.ts:30-39`(getComments `auth:false`).
- 문제: 두 GET은 공개지만 응답에 **뷰어 종속 `editable`**(§6.2·§6.3)을 담는다. `auth:false`라 로그인해도 토큰 미첨부 → 서버 익명 판정 → editable 항상 false.
- 파급: PostDetailPage 수정/삭제 버튼 미노출·PostWritePage EditPostView "권한없음" 차단(자기 글 수정 불가)·CommentItem 수정삭제 버튼 미노출.
- 선례: `lib/api/items.ts:57-62` getItemInstance가 동일 성격(뷰어종속 slotNo) 때문에 **auth:false 안 씀**(기본 optional-auth). 게시글/댓글 editable도 동일하게 해야.
- 권고: getPost·getComments에서 `auth:false` 제거(기본 auth=optional). 게스트·만료토큰은 200 익명 취급(refresh 루프 없음, items 선례 안전). getBoards/getBoard/getPosts는 뷰어종속 없어 auth:false 유지 정당.
- 보안 노출 아님(fail-safe: 버튼 숨김·서버가 PUT/DELETE 최종강제). 그러나 핵심 기능 불능 → Done 차단.

## MINOR (동일 사이클 처리 권장)
- **MINOR-1** 상세 딥링크 시 useBoard 로딩 중 allowComments false 폴백 → 커뮤니티 글에 "댓글 미허용" 순간 오표시(`PostDetailPage.tsx:233`). board 로딩 중 스켈레톤/보류.
- **MINOR-2** 다중 이미지 병렬 업로드 완료순 append라 sortOrder가 선택순과 어긋날 수 있음(`ImageUploader.tsx:69-84`). 배치 인덱스로 슬롯 선점.
- **MINOR-3** 이미지 이동 버튼 hover에서만 노출(포커스 미노출) 접근성 저하(`ImageUploader.tsx:162`). focus-within/상시 표시.
- **MINOR-4** 삭제 확인 모달 포커스 트랩·Esc 미처리(`PostDetailPage.tsx:239-276`). 기존 모달 패턴 수준이면 회귀 아님(개선 여지).
- **MINOR-5** presigned 프리뷰 TTL 초과 시 깨질 수 있음(장시간 편집폼). 제출은 imagePublicId만이라 계약 무손상·표시 이슈(known).

## 보안 판정: 통과
- presigned: 본문 URL 미저장·제출은 imagePublicIds만·프리뷰 갱신값·만료 재사용 없음.
- XSS: 전 렌더 JSX 텍스트 보간(자동 escape)·dangerouslySetInnerHTML 0건.
- 인가 권위 서버 유지(authorId 미전송·주체 SecurityContext). 글쓰기 표시제어(canWriteBoard) 정확.

## 계약 정합: 통과
- CursorResponse·OffsetPage·204·에러코드 매핑·imagePublicIds 최종집합·FormData 전부 §6과 1:1. 가짜 데이터 없음. 라우팅(write>:postId·/community 리다이렉트·쪽지 도달 유지)·캐시(조회수 부풀림 회피) 정합.
