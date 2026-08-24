---
ticket: FC-389
reviewer: reviewer
review_status: passed
reviewed_at: 2026-08-24
scope: FC-388 board-surf-20-v1
---

# FC-389 통합 재리뷰

## 판정

**PASS** — critical/major/minor 발견 없음. 첫 리뷰의 major 3건과 minor 2건이 모두 해소됐다.

## 첫 리뷰 지적사항 재검증

### 시간 분포와 부모-자식 시간 순서 — 해소

- 고정 공지 3개는 각각 T-1일, T-10일, T-19일로 최근 30일 범위에 배치된다.
- 커뮤니티 글은 최근 24시간 8개, 최근 7일 18개가 되도록 결정적으로 분산된다.
- 루트 댓글은 게시글 시각 이후, 답글은 부모 댓글 시각 이후 10분 이상으로 생성된다.
- fixture `verify()`와 MySQL 통합테스트가 위 구간별 건수와 시간 선후관계를 직접 검증한다.

### 콘텐츠 유형과 다양성 — 해소

- 유형은 질문 12, 공략 9, 모집 6, 후기 6, 거래·시세 3개로 계약과 일치한다.
- 9개 주제별 세부 경험, 장비 레벨, 스킬 슬롯, Gold Force 여부와 유형별 결론을 조합해 제목과 본문을 구분한다.
- 유형별 건수를 fixture 자체와 통합테스트 양쪽에서 검증한다.

### fixture 훼손 시 cleanup 거부 — 해소

- 게시글은 제목, 본문, 시스템/사용자 작성자, 표시명, 게시판 FK, 고정 여부, 조회수를 결정적 fixture와 비교한다.
- 댓글은 본문, 작성자 ID·표시명, 게시글 FK, 부모 댓글 FK, 멘션 표시명을 비교한다.
- 반응은 댓글 public ID, 사용자 login ID, LIKE/DISLIKE 조합의 전체 집합을 비교한다.
- `cleanup()` 시작 시 `verify()`와 외부 참조 검사를 모두 수행하므로 fixture 변조 상태에서는 삭제가 실행되지 않는다.
- 통합테스트가 댓글 본문·작성자·닉네임·게시글·부모·멘션 및 반응 타입·사용자 변조를 각각 재현해 거부를 검증한다.

### 문서와 회귀 테스트 — 해소

- 계약 상태가 `APPROVED — 게이트1·게이트2 승인 2026-08-24`로 갱신됐다.
- 시간 분포, 부모 순서, 콘텐츠 유형, fixture 변조 거부 회귀 테스트가 추가됐다.

## 보안·운영 안전성 확인

- 외부 입력값은 `PreparedStatement`로 바인딩하며 동적 SQL 조각은 내부 고정값에 한정된다.
- 실제 시크릿은 예시 파일이나 로그에 추가되지 않았다.
- DB fingerprint에 host/port/database/scenario가 포함되고 apply/cleanup은 운영 허용값과 명령별 확인 문자열을 요구한다.
- EMPTY/COMPLETE/PARTIAL 상태와 COMPLETE apply no-op이 유지된다.
- cleanup은 reaction → reply → root comment → post 순서로 FK를 준수한다.
- `post_image`, namespace 밖 댓글, 테스트 사용자 밖 반응을 외부 참조로 감지해 cleanup을 거부한다.
- 기존 ops-20-v2 사용자 20명과 아이템 240개 보존을 통합테스트가 확인한다.
- 공지·이벤트에는 비공식 테스트 창작 데이터 고지가 포함되고 원문·이미지·고유 캐릭터 복제는 보이지 않는다.

## 검증 증거

```text
JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11
gradlew :backend:test \
  --tests com.finalcall.support.seed.SeedGuardTest \
  --tests com.finalcall.support.seed.BoardOperationsSeedFixtureIntegrationTest \
  --rerun-tasks

BUILD SUCCESSFUL in 45s
4 actionable tasks: 4 executed
```

컴파일 시 기존 테스트 코드의 `MockBean` 제거 예정 경고 25건이 출력됐으나 이번 변경 범위와 무관하며 테스트 실패는 없었다.
