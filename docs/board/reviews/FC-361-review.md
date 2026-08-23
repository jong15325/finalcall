# FC-361 공통 모달 전수 적용 통합 리뷰

## 최종 판정

- PASSED
- Critical: 0
- Major: 0
- Minor: 0

## 확인 범위

- 운영 소비처의 직접 Portal·개별 dialog 패널 잔존 여부
- 경매 즉시구매·판매 등록, 마켓 판매 등록·판매 취소·목록 중첩 구매
- 회원 탈퇴, 새 대화·메시지 신고, 게시글 삭제의 실제 `AppModal` 연결
- 하단 액션의 `primary`·`secondary`·`danger` 공통 버튼 역할과 hover·focus·active·disabled·pending 상태
- 제출·검증·오류 매핑·mutation·모바일 판매 검토 스크롤 gate 보존
- 중첩 모달 스택, 최상위 Escape 처리, focus trap·restore, body scroll lock, backdrop·처리 중 닫기 잠금
- 모바일 bottom sheet와 데스크톱 centered dialog CSS 계약, safe-area 및 reduced-motion
- 카드정보 모달의 마켓·인벤토리 CTA 공통 버튼 전환과 기존 중첩 확인 CSS 제거

## 검증 증거

- 관련 통합·컴포넌트 테스트 13개 파일 90건 통과
- 최종 보정 대상 테스트 4개 파일 21건 통과
- Frontend typecheck 통과
- 대상 ESLint 통과
- `check:ui-system` 및 workbench guard 통과
- 전수 검색 결과 운영 직접 `createPortal`은 공통 `AppModal`과 허용된 비모달 `ProfileCard`만 잔존
- 전체 테스트의 이번 범위 직접 회귀였던 `AuctionDetailPage` 모달 포털 계약 테스트 보정 후 통과
- 전체 테스트에 남은 `MEMBER_003` 계약 1건과 Workbench fixture/data attribute 4건은 이번 공통 모달 변경 범위 밖 기존 실패로 분리 확인

## 리뷰 이력

- action `autoFocus`가 DOM 순서상 닫기 버튼에 밀리던 초기 초점 우선순위 수정
- 커스텀 접근성 닫기 라벨이 일반 action CSS에 포함되던 선택자를 `.app-modal-close` 기준으로 수정
- 경매 상세의 기존 Portal class 단언을 공통 overlay 계약으로 갱신
- 마켓·인벤토리 카드정보 CTA를 `AppModalButton` 공통 primary 역할로 전환
- 제거된 카드정보 nested confirm 패널의 개별 버튼·hover·색상 CSS 삭제
- 최종 재리뷰에서 critical/major/minor 해소 확인
