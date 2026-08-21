# 총괄 세션 핸드오버

> 갱신: 2026-08-22 KST / 브랜치 `master`

## Git·환경
- 로컬 HEAD: `17112604b5ae314b3776786ffb76b9fb52d9f303`
- upstream 원격 HEAD: `9ae6670b24310dbbc27667b686c467aedbd6ad5a`
- unpushed commit: 1
- 작업 트리: dirty — 이 `HANDOVER.md` 갱신만 미커밋이다.
- 실행 서비스: backend `18088`(PID 35244)·`18089`(PID 58360), gateway `18090`(PID 55448)·`18091`(PID 35160)가 listen 중이다.
- Docker: FinalCall MySQL·Redis·Kafka·Kafka Connect·Elasticsearch·MinIO가 healthy다. 별도 on-race 서비스도 실행 중이므로 종료·재기동 시 대상 이름과 포트를 먼저 확인한다.
- 임시 성능 runner 컨테이너는 제거했고 GitHub 등록 self-hosted runner는 0개다.
- 최종 redacted artifact: 저장소 밖 `D:\tmp\fc341-final-32503805495\chat-performance-extended-32503805495`.

## 완료
- FC-338: 전역 Kafka lag/outbox monitor를 배포당 단일 active collector로 보정했다. `docs/spec/chat-domain-spec.md` §13·§14 참조.
- FC-339: hosted diagnostic은 10/s smoke, self-hosted extended는 10→50→150→300/s 출시 판정으로 실행 경계를 분리했다.
- FC-340: 성능 topology의 app별 Hikari fixed pool 32개·connection timeout 1초와 MySQL reserve 검증을 반영했다.
- FC-341: send 응답 후속 사용자 SELECT/read TX를 제거했고 reviewer를 통과했다. 최신 원격 커밋은 `9ae6670`이다.
- 최종 self-hosted run `32503805495`를 완료했다. 지속 300/s 5분까지는 통과했고 1,000/s burst에서 실패해 socket 단계는 계약대로 실행하지 않았다.
- 최종 출시 차단 판정을 `docs/backend/fc-329-chat-release-validation.md`, FC-329·FC-341 티켓, FC-324 리뷰에 반영하고 `1711260`으로 커밋했다.

## 진행 중
- EPIC-CHAT/KAN-359는 `doing`이다.
- FC-341/KAN-385는 구현·reviewer가 통과한 `review/passed` 상태다.
- FC-329/KAN-373은 1,000/s burst DoD 미달로 `blocked/changes-requested`다.
- FC-324/KAN-368은 FC-329 선행 미충족으로 `blocked/changes-requested`다.
- 최종 reviewer 판정은 `CHANGES REQUESTED / RELEASE BLOCKED`다. 사용자 지시에 따라 추가 최적화·재진단 루프는 자동으로 시작하지 않는다.

## 남은 일
- 이 HANDOVER 변경을 사용자 승인 후 별도 atomic commit해야 한다.
- 커밋 후 사용자가 원격 push를 수행해야 한다. 현재 미푸시 커밋은 `1711260`이며 HANDOVER 커밋이 추가될 예정이다.
- 다음 세션에서 사용자가 FC-329 성능 개선 재개를 지시하면, 기존 pool 증설은 반복하지 않고 현재 burst artifact를 출발점으로 게이트2 범위를 확정한다.
- 성능 계약을 완화하거나 300/s 지속 용량만으로 출시 범위를 바꾸는 결정도 게이트2 대상이다.
- FC-329가 통과하기 전에는 socket 100→1,000→5,000→20,000, FC-324 최종 통과, EPIC-CHAT Gate3/Done 전이를 진행하지 않는다.
- Jira `Blocks` 관계 링크 검사 방향 정규화 결함을 별도 보정해야 한다. 중복 링크 생성을 막기 위해 현재 `--apply` 반복 실행은 금지한다.

## 검증
- GitHub Actions run `32503805495`: 10/s 101건, 50/s 1,501건, 150/s 4,501건, 300/s 9,001건, 300/s 5분 90,001건 모두 drop 0·HTTP 201 100%·p95/p99 SLO 통과.
- 같은 run의 1,000/s 60초 burst: 완료 57,757건, drop 2,243건, HTTP 실패 1,479건, p95 3,799ms, p99 4,184ms, Hikari timeout 1,351건으로 실패.
- FC-341 관련 단위·통합 테스트, spotlessCheck, checkstyleMain, checkstyleTest와 reviewer 통과. `docs/board/reviews/FC-341-review.md` 참조.
- 최종 판정 문서 4개 `git diff --check` 통과. 파일 보드 `--local` 검사 377건 통과.
- 템플릿·컨벤션 준수: 확인 — `templates.md [8]` 형식으로 이 문서를 덮어썼고 push는 실행하지 않았다.

## Jira 미러 패리티
- `node scripts/jira-sync.mjs --check`: 로컬 보드 377건·Jira KAN 인증 정상.
- FC-329/KAN-373, FC-324/KAN-368, FC-341/KAN-385의 key·summary·상태·에픽 귀속은 파일 정본과 일치한다.
- 전체 검사에는 `Blocks` 관계 링크 532건만 드리프트로 남았다. 기존 `issuelinks` 조회/방향 판정 결함으로 보이며 중복 생성 방지를 위해 `--apply`는 실행하지 않았다.

## 다음 첫 행동
1. `출근` 절차로 로컬·원격 HEAD와 Jira 패리티를 다시 확인한다.
2. 사용자가 FC-329 재개를 지시하면 run `32503805495`와 §14.3을 기준으로 다음 게이트2 선택지를 한 번만 상신한다.
