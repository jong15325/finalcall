# FC-337 구현 리뷰

## 판정
- changes-requested (2026-08-20)
- critical 0건, major 2건, minor 3건

## Major
1. connector init service 성공과 `finalcall-chat-outbox-source` connector/task `RUNNING` 상태를 확인하지 않아 CDC 없는 시험이 진행될 수 있다.
2. extended socket 검증이 100→1,000→5,000 단계를 건너뛰고 20,000 VU로 바로 진입하며 runner `ulimit -n` 전제도 확인하지 않는다.

## Minor
1. redaction 실패 시 예정 artifact의 완결성을 확인하는 manifest/count가 없다.
2. k6 성공률 threshold `>0.99`는 문서의 “99%”보다 엄격하므로 표현을 맞춰야 한다.
3. self-hosted runner 강제 종료 시 잔여 fixture/container를 막기 위한 ephemeral runner·외부 정리 전제가 필요하다.

## 1차 재리뷰
- changes-requested: 기존 major 2건은 해소됐으나 stale PID 재사용 시 무관한 프로세스를 종료할 수 있고 Compose project name이 고정되지 않은 major 1건을 확인했다.
- 추가 minor: 필수 compose service 존재 미검증, 수집 실패 후 불완전 artifact upload 가능, `ulimit -n=unlimited` 미처리.

## 2차 재리뷰
- changes-requested: 안전성 문제는 해소됐으나 기동은 상대 jar 경로, teardown 소유권 검증은 절대 jar 경로를 사용해 정상 프로세스 종료가 실패하는 major 1건을 확인했다.

## 최종 판정
- passed (2026-08-20)
- critical 0건, major 0건, minor 0건
- 절대 jar 경로 기동과 teardown 소유권 검증이 일치하며, connector readiness·단계별 socket·전용 Compose project·artifact/secret gate의 회귀가 없음을 확인했다.

## 원격 검증 재개
- GitHub workflow dispatch가 job-level `env`의 `${{ runner.temp }}`를 인식하지 못해 parse 단계에서 실패했다.
- 실제 부하 job은 시작되지 않았으며, GitHub context 사용 위치를 보정한 뒤 재리뷰한다.

## 원격 parse 보정 재리뷰
- passed (2026-08-20)
- job-level `runner.*`를 제거하고 checkout 직후 `$RUNNER_TEMP` 기반 경로를 `$GITHUB_ENV`로 전달하도록 보정했다.
- actionlint v1.7.7과 reviewer context 위치 재감사에서 critical/major/minor 0건을 확인했다.
