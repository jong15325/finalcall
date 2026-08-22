# FC-358 기본 캐릭터 프로필 통합 리뷰

## 최종 판정

- PASSED
- Critical: 0
- Major: 0
- Minor: 0

## 확인 범위

- 허용 캐릭터 ID `1~12`, `25~28` 및 `13~24` 거부
- V28 DB CHECK, `PATCH /me`, `MEMBER_003`, 큰 정수 축소 변환 우회 차단
- 게시판·채팅·쪽지의 프로필 wire 계약, 탈퇴 회원 null, 배치 조회와 N+1 방지
- Premium 및 모든 `btn_2` 자산 제외, 16개 기본 캐릭터 매핑
- 프로필 오른쪽 fixed overlay와 프로필 동일 크기 선택 셀
- 모바일·태블릿·PC의 2·4·6개 페이지 캐러셀과 수평·세로 viewport 경계
- 현재 선택값 페이지 초기화, 숨은 항목 DOM 제외
- 외부 클릭, Escape 포커스 복귀, reduced-motion
- 동적 오류 높이 변경 시 ResizeObserver 재배치와 cleanup

## 검증

- Frontend 관련 테스트 23건 통과
- Frontend typecheck 및 대상 ESLint 통과
- Backend member controller/service/repository, wire contract, memo 대상 테스트 통과
- Backend Spotless 및 Checkstyle 통과
- `git diff --check` 오류 없음(기존 줄바꿈 경고만 존재)

## 리뷰 이력

- 수평 viewport 초과와 잘린 포커스 대상 수정
- 큰 정수 `intValue()` 축소 변환 우회 수정
- 현재 선택 캐릭터 페이지 초기화 수정
- Escape 종료 후 프로필 트리거 포커스 복귀 수정
- 초기 및 동적 높이 변화의 세로 viewport 경계 처리 수정
- 최종 재리뷰에서 모든 critical/major/minor 해소 확인

## 반응형 선택 UI 재검토

- PC: 프로필 오른쪽에 동일한 `112px` 슬롯 6개를 연속 배치하고 별도 패널 장식 제거
- 모바일: 프로필 아래 `4×4` 보드로 16개 전체 노출, 390px에서 프로필과 동일한 약 `80px` 셀 유지
- PC 캐러셀과 모바일 전체 보드의 viewport 경계, 숨은 포커스, 저장·취소·Escape 동작 확인
- 최종 판정: PASSED (`Critical 0 / Major 0 / Minor 0`)

## 프로필 노출 지점 재검토

- 상단 계정 메뉴와 모바일 마이페이지 내비게이션에 로그인 사용자의 캐릭터 적용
- 게시글 상세, 댓글·답글 작성자에 API의 `authorPrimaryCharacterId` 적용
- 채팅 양방향 메시지와 optimistic 메시지에 발신자 캐릭터 적용
- 받은·보낸 쪽지 상세에서 상대 방향에 맞는 캐릭터 적용
- 삭제 회원 placeholder, nullable fallback, 접근성 이름 유지
- 최종 판정: PASSED (`Critical 0 / Major 0 / Minor 0`)
