# FC-351 전역 채팅 unread 동기화 통합 리뷰

## 최종 판정

- **PASSED**
- Critical 0 · Major 0 · Minor 0
- 검토 계약: `chat-domain-spec.md` v1.9 §10.1.2, `api-contract.md` v1.30 §2.7.3

## 재리뷰 결과

- 최초 조회와 trailing 조회를 명시적인 2단계로 제한했다. trailing 조회 중 새 신호가 들어와도 동일 작업에서 세 번째 REST 요청을 만들지 않으며, 다음 독립 트리거 또는 polling에서 수렴한다.
- WebSocket lifecycle을 Promise chain으로 직렬화했다. token 교체는 이전 `disconnect()` 완료 후 새 client를 연결하고, logout은 연결을 종료하며, StrictMode의 setup-cleanup-setup에서도 활성 transport가 최대 하나로 유지된다.
- deferred disconnect, trailing 조회 중 재오염, StrictMode, token 교체와 logout 시나리오가 회귀 테스트로 추가됐다.
- 최초 리뷰의 Major 2건은 모두 해소됐다.

## 최초 리뷰 Major와 해소 근거

### 1. 지속 이벤트 중 unread 후속 조회가 1회로 제한되지 않아 REST 요청이 무한 연장될 수 있음

- 위치: `frontend/src/features/chat/lib/ChatRealtimeProvider.tsx:43-72`
- 재현 시나리오: 첫 unread 조회가 진행 중일 때 `MESSAGE_CREATED`, focus, reconnect 등의 신호를 계속 발생시킨다. 각 조회가 끝나기 전에 다음 신호가 하나라도 들어오면 `refreshDirtyRef`가 다시 `true`가 되고, `do...while`이 제한 없이 다음 조회를 시작한다. 지속적인 채팅 이벤트에서는 한 번의 in-flight 작업이 끝나지 않은 채 REST를 계속 직렬 호출한다.
- 기대: 계약대로 최초 in-flight 조회와 그 진행 중 합쳐진 **후속 조회 최대 1회**만 수행한 뒤 작업을 종료한다. 후속 조회 중 새 사건은 다음 독립 트리거 또는 polling으로 수렴해야 한다.
- 실제: `while (refreshDirtyRef.current && generation === generationRef.current)`가 반복 횟수를 제한하지 않아 burst가 이어지는 동안 3회 이상, 이론상 무한히 조회할 수 있다. 이는 event burst에서 REST 폭주를 막는 성능 계약을 위반한다.
- 필요한 회귀 증거: 첫 조회 중 다수 신호뿐 아니라 **후속 조회 중 다시 신호가 들어와도 총 2회에서 종료**되는 테스트가 필요하다. 현재 테스트는 첫 조회 중 신호만 합쳐지는 경우만 검증한다.
- 해소: `ChatRealtimeProvider.tsx:52-73`이 최초 fetch 후 dirty 여부에 따라 trailing fetch를 한 번만 실행한다. 추가 테스트가 trailing 진행 중 재신호 후에도 호출 횟수 2회를 고정한다.

### 2. token 교체와 React StrictMode에서 이전 socket 종료 완료 전에 새 socket을 연결함

- 위치: `frontend/src/features/chat/lib/ChatRealtimeProvider.tsx:80-132`, `frontend/src/features/chat/lib/chatRuntime.ts:140-150`, `frontend/src/main.tsx:8`
- 재현 시나리오 1: access token을 refresh한다. effect cleanup은 `void realtime.disconnect()`로 비동기 종료를 기다리지 않고, 다음 effect가 즉시 새 client의 `connect()`를 호출한다. STOMP `deactivate()`가 끝날 때까지 이전 transport와 새 transport가 겹친다.
- 재현 시나리오 2: 개발 환경의 `React.StrictMode`가 effect를 setup → cleanup → setup으로 재실행한다. 동일하게 첫 disconnect 완료 전 두 번째 connect가 시작되어 초기 진입만으로도 일시적인 중복 연결이 생긴다.
- 기대: v1.9 계약대로 이전 token socket을 **먼저 종료한 뒤** 새 token으로 연결하고, AppShell 생명주기에서 활성 연결·구독을 하나로 유지한다.
- 실제: generation 검사는 이전 callback의 UI 반영만 차단할 뿐, 이전 WebSocket transport의 실제 종료를 기다리지 않는다. 서버의 사용자당 연결 상한을 불필요하게 소비하고 token 교체 순간 중복 구독·연결 churn을 만든다.
- 필요한 회귀 증거: deferred `disconnect()`를 사용해 resolve 전에는 두 번째 `connect()`가 호출되지 않음을 검증하고, `<StrictMode>` mount에서도 안정화 후 하나의 활성 client만 남는 테스트가 필요하다. 현재 token 테스트는 `disconnect` 호출 여부만 확인하며 순서를 검증하지 않는다.
- 해소: `ChatRealtimeProvider.tsx:42,107-150`이 cleanup의 disconnect를 lifecycle chain에 연결하고 다음 setup이 해당 chain 뒤에서 시작되도록 직렬화한다. deferred disconnect·StrictMode·logout 테스트에서 최대 활성 연결 수 1과 최종 0을 검증한다.

## 통과한 검토 항목

- AppShell에 provider를 배치하고 `ChatWorkspace`의 독립 client 생성을 제거한 구조는 계약 방향과 일치한다.
- `MESSAGE_CREATED`는 `sentByMe`를 client에서 재추론하지 않고 event를 그대로 소비하며, 송신 성공·송수신 event·본인 `READ_UPDATED`에서 REST unread 정본으로 수렴한다.
- 다른 사용자의 `READ_UPDATED`는 전역 unread refetch에서 제외한다.
- 최초 연결·재연결 성공, online, focus, 30초 polling fallback이 연결돼 있다.
- 사용자 public ID 변경·logout 시 chat query 전체를 제거하고 generation으로 이전 callback을 폐기한다.
- ChatWorkspace의 연결 상태점과 FC-346 내부 스크롤·입력창 레이아웃 변경에서 이번 diff로 인한 추가 접근성·UX 회귀는 확인되지 않았다.
- 인증·인가 경계를 새로 넓히거나 IDOR, 시크릿, 결제·잔액 로직을 변경하지 않았다.

## 검증

- `ChatRealtimeProvider.test.tsx`, `AppShell.test.tsx`, `ChatWorkspace.test.tsx`: **26/26 통과**
- TypeScript typecheck 통과
- 변경 대상 ESLint 통과
- `git diff --check` 통과
