# FC-345 채팅 첫 메시지 생성과 스크롤 UX 통합 리뷰

## 최종 판정
- **PASSED**
- Critical 0 · Major 0 · Minor 0

## 1차 지적과 해소
- 제거된 `POST /direct`를 소비하던 fast-path·다중 노드·Redis 복구 통합 테스트와 FC-329 부하 fixture를 v1.29 `POST /direct/messages`로 이행했다.
- 첫 메시지가 sequence 1을 차지하는 계약에 맞춰 message·outbox·gap replay 기대값을 정정했다.
- `chat-domain-spec.md` REST 요약과 §12.2~§12.3의 구 생성 전용 계약 잔존을 v1.29와 일치시켰다.

## 확인 결과
- room·양측 state·첫 message·발신자 read·outbox 단일 TX와 실패 전체 rollback.
- 사용자쌍 UK·room `FOR UPDATE`·최대 3회 전체 TX retry·clientMessageId 멱등과 본문 충돌 판정.
- SecurityContext 주체, 활성 nickname resolve 후 내부 ID 권위, 차단·IDOR·rate limit 유지.
- 신규·미캐시 `MESSAGE_CREATED` 즉시 bucket 병합, room hydration, 실패 시 목록 refetch·gap replay.
- timeline 내부 스크롤, 하단 체류·본인 전송 시 이동, 과거 탐색 중 새 메시지 버튼, prepend 위치 보존.
- 키보드 조작, live region, reduced-motion 분기와 local exact Origin 2종 확인.

## 검증
- 백엔드 핵심 5개 클래스 22/22 통과.
- 프론트 `ChatWorkspace.test.tsx` 8/8 통과.
- 프론트 TypeScript typecheck 통과.
- 백엔드 Spotless·Checkstyle main/test 통과.
- `git diff --check` 통과.

## 잔여 수동 확인
- 자동화 브라우저가 없어 390px·1280px 실제 렌더의 overflow·시각 대비는 정적 레이아웃과 jsdom 근거로 판정했다. 실브라우저 확인은 게이트3 전 잔여 수동 항목이다.

## 온디맨드 보안 리뷰
- 기존 통합 reviewer와 별도 security pass를 수행했고 출시 차단 없음으로 판정했다.
- Critical 0 · High 0 · Medium 0 · Low 2.
- Low: 인증 사용자의 공개 nickname 저속 열거 가능성. message user/IP 제한과 신규 room 20/시간 제한, 실패 전체 rollback으로 완화한다.
- Low: 장시간 열린 채팅 화면의 `messagesByRoom` 캐시에 명시적 상한이 없다. 서버 본문·rate limit과 REST pagination으로 완화하며 최근 N건 cap/virtualization을 후속 hardening 후보로 둔다.
- AGENTS가 지목한 `.Codex/Codex-security-guidance.md`는 저장소에 없어, 존재하는 `.claude/claude-security-guidance.md`와 concurrency-review 지침을 위협모델 근거로 사용했다.
