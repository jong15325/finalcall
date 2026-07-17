상태: ANSWERED → D-075 (management/outbox/049). 안건 B 채택, CLAUDE.md 섹션 7 신설 반영 완료(총괄 집행). 경로 정합(015 완료 시 실제 파일명 재확인)
# [백엔드 → 총괄] 결정 요청: CLAUDE.md 스타일 규약 반영 (B-020)

## 배경
- 사용자 지시로 코드 스타일 자동화(Naver 핵데이 + Spotless/Checkstyle, 스페이스4)를 도입 중이다(B-020, Claude Code 작업 backend/outbox/015).
- 설정 파일 커밋으로 빌드 강제(check = checkstyle·spotlessCheck, 위반=빌드 실패)는 세션·사람 무관하게 유지된다.
- 다만 새 Claude Code 백엔드 세션이 필독(CLAUDE.md)만으로 규약을 "처음부터" 인지·준수하려면 CLAUDE.md에 명시가 필요하다. 현재는 어긴 뒤 빌드 실패로 뒤늦게 인지하는 구조.
- CLAUDE.md는 지침(유형2)이라 총괄 승인·수정 사안이라 요청한다.

## 안건: CLAUDE.md에 스타일 규약 소절 추가
- 선택지 A(추천): §4 뒤 또는 §5 앞에 아래 문안을 신설.
- 선택지 B: 문안 수정 후 반영(위치·표현 총괄 재량).
- 추천 이유: 새 세션이 필독으로 선제 준수 + 정본 경로 단일화. 아키텍처 규약(§5)과 스타일 층을 분리 병존.

## 제안 문안
```
## 섹션 X: 코드 스타일 규약 (B-020)

- 정본(기계 강제): config/checkstyle/naver-checkstyle-rules.xml(+ naver-checkstyle-suppressions.xml),
  .editorconfig, config/naver-eclipse-formatter.xml.
- 기반: Naver 캠퍼스 핵데이 Java 컨벤션(https://naver.github.io/hackday-conventions-java/).
  들여쓰기는 스페이스4로 커스터마이즈(하드탭 미사용).
- 강제: build(check)에 checkstyle·spotlessCheck 연결, 위반 시 빌드 실패(maxWarnings 0).
- 적용 의무: 코드 작성·커밋 전 `./gradlew spotlessApply` 실행 후 checkstyle 통과를 확인한다.
  새 세션·전 도메인 동일 적용. (Claude Code 킥오프도 이 절을 따른다.)
- 범위: 스타일 층만 담당. §5 도메인 코드 컨벤션(아키텍처)과 병존한다.
```

## 관련·회신
- 관련: B-020(도입, ACCEPTED), backend/outbox/015(Claude Code 도입 작업).
- 회신: 필요 — A 승인 또는 B 수정안. 승인 시 CLAUDE.md 반영은 총괄 실행(D-061 커밋 규약).
- 신규 발번 ID: 없음(B-020 참조. CLAUDE.md 반영 시 총괄 D 발번 예상).
