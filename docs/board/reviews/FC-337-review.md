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

## 원격 실행 재개
- workflow dispatch와 parse는 성공했으나 Linux checkout에서 `gradlew` 실행 비트가 없어 bootJar 단계가 exit 126으로 실패했다.
- 실제 인프라·부하 단계는 시작되지 않았으며 파일 모드 비의존 실행으로 보정한다.

## Linux 파일 모드 보정 재리뷰
- passed (2026-08-20)
- `bash ./gradlew`로 실행 비트 의존을 제거했고 저장소의 shell/python/PowerShell 호출이 모두 명시적 interpreter를 사용하는지 확인했다.
- reviewer critical/major 0건, actionlint·Gradle dry-run 통과.

## 원격 fresh-infra 재개
- changes-requested (2026-08-20)
- GitHub Actions run `32376609307`에서 빌드와 k6 설치는 통과했으나 connector init이 HTTP 400으로 실패했다.
- redacted compose log에서 MySQL이 `debezium` 계정 로그인을 거부한 사실을 확인했다.
- 계정 생성 SQL은 저장소에 존재하지만 MySQL의 `/docker-entrypoint-initdb.d`에 연결되지 않아 fresh volume에서 실행되지 않는다.

## fresh MySQL 초기화 보정 구현
- MySQL service가 기존 Debezium 계정 SQL을 read-only initdb script로 mount하도록 보정했다.
- fresh volume의 계정·필수 권한 생성을 실제 임시 MySQL로 검증했고, 기존 volume에서는 init script가 재실행되지 않음을 확인했다.
- 기존 volume의 수동 1회 절차는 호환 경로로 유지하며 운영 시크릿·connector 계약·SQL 권한은 변경하지 않았다.

## fresh MySQL 초기화 보정 재리뷰
- passed (2026-08-20)
- critical 0건, major 0건, minor 0건.
- local-only credential과 최소 CDC 권한은 기존 계약을 유지하고, fresh volume 자동 초기화 및 기존 volume 비재실행 동작이 안전함을 확인했다.

## 원격 diagnostic latency 재개
- changes-requested (2026-08-20)
- run `32379511392`는 fresh infra·앱·fixture까지 통과했으나 첫 10/s 단계에서 성공률 100%에도 p95 1.43초, p99 2.34초로 중단됐다.
- receiving p95는 28ms이고 waiting p95가 1.41초였으며, fixture가 app1만 예열한 뒤 app2 최초 요청이 0.7~2.0초를 기록하고 수십 ms대로 수렴한 비대칭 cold-path 형상을 확인했다.
- 성능 threshold는 유지하고 두 Gateway의 비채점 prewarm 후 기존 10/s 측정을 재실행하는 orchestration 보정이 필요하다.

## 대칭 prewarm 구현
- 각 Gateway를 기존 k6 scenario로 `2/s × 5초` 비채점 prewarm하고, gateway별 HTTP 201과 응답 data 성공이 각각 최소 5건이며 실패 0건인지 검증한다.
- 두 Gateway 조건을 만족하지 못하면 정식 측정 전에 중단하며, 기존 10→50→150→300/s와 p95·p99 threshold는 변경하지 않았다.
- 성공·실패 dry-run, URL 개수 guard, Bash 문법 및 secret 출력 경로를 검증했다.

## 대칭 prewarm 재리뷰
- passed (2026-08-20)
- critical 0건, major 0건, minor 0건.
- 비채점 옵션은 gateway별 prewarm에만 한정되고, 성공 검증·fail-fast·artifact secret scan과 기존 정식 threshold가 유지됨을 확인했다.
