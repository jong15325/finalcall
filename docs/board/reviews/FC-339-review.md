# FC-339 리뷰

- 판정: `passed`
- reviewer: reviewer
- 검토일: 2026-08-21

## 범위

- hosted diagnostic의 prewarm·10/s smoke 종료 경계
- self-hosted extended의 독립 10→50→150→300/s 및 후속 부하 단계
- runner 자원 사전조건, 단계별 SLO 검증, telemetry 수집·정리·artifact 보존
- secret 노출, shell 실패 경로, topology·keep-alive·fixture IP 분산 회귀

## 결과

- critical: 없음
- major: 없음
- minor: spec §16의 구현 티켓 참조가 `FC-337`로 남아 있어 `FC-339`로 정정 완료
- 최종 판정: 구현과 계약이 일치하며 review 통과

## 검증

- `git diff --check` 통과
- `node --check scripts/chat/k6-chat-load.js` 통과
- workflow YAML 파싱 통과
- diagnostic 종료점과 extended 단계 순서 정적 검증 통과
- 로컬 환경 제약으로 reviewer의 shell 동적 실행은 생략했으며 backend-impl의 Bash 문법 검증은 통과

## Hosted smoke 후속 검증

- GitHub Actions run `32450659844`에서 topology·fixture·artifact scan·teardown을 통과했다.
- 10/s smoke는 101/101 HTTP 201, scheduled iteration drop 0, p95 140ms, p99 194ms로 실제 SLO를 통과했다.
- 최초 실행 실패는 k6 0.57 summary의 최상위 `passes`·`fails` 구조를 `values.rate`로 읽은 검증기 오류였다.
- parser를 실제 구조와 wrapper 구조 모두 지원하도록 보정하고, aggregate checks와 write가 `passes > 0`,
  `fails == 0`을 만족하도록 fail-closed 처리했다.
- 실제 artifact 성공과 metric 누락·passes 0·value-only·fails 1 실패 회귀를 reviewer가 재확인했으며 최종 판정은 `passed`다.
