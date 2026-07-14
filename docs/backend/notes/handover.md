# 백엔드 handover (2026-07-14)

D-059 핸드오버. "파일에 없는 기억"만. 기존 내용은 경로 참조. 재개 시 이 파일부터 읽는다.

## 완료 (이번 세션)
- auth 도메인 G4-1 완결: signup·login·refresh·logout(api-contract §2 v1.1). 코드리뷰 M1(중복 경쟁 409) 수정 +
  동시성 테스트(signup·rotate). 마무리 정리(LoginResult→TokenBundle, 데모 컨트롤러 제거). 총괄 검수 통과(mgmt/050, 구현 DoD).
- 코드 컨벤션 도입: Naver 핵데이 + Spotless/Checkstyle(B-020~023). CLAUDE.md §7 신설(D-075)·§5 204 예외 명문화(D-076). clean build 그린.
- SCG 게이트웨이 스켈레톤(012): :gateway 멀티모듈·WebFlux(B-026·027). clean build 그린(두 모듈 61 tests). 완료 보고 021.

## 대기 중 (블로커/회신)
- 총괄 020 회신: 게이트웨이 엣지 429 오류 포맷(envelope 통일 여부, 계약 영향) + 관측성(Stage G)·로컬 compose 게이트웨이 추가 후속 순서.
- 총괄 021 검수: 게이트웨이 스켈레톤.
- 다음 도메인 순서: 총괄 지정 대기(D-074). member/item/auction/bid/settlement 중. 임의 착수 금지.
- QA 기동: 사용자 결정 대기. auth G4-1 게이트 최종 통과는 QA 시나리오·defects 후(현재 구현 DoD만 충족).
- 미커밋: 게이트웨이·수신처리·킥오프 §7 반영분 + 이 handover. 커밋 메시지 제안됨(docs(백엔드)), 사용자 실행.

## 보안 게이트2 이월 (추적표 등재됨, G4-n 후 검토)
- B-016(password 바이트/복잡도), B-017(로그인 타이밍 사이드채널), B-018(refresh-탈퇴 순서), B-025(refresh 절대 상한), m3(BCrypt 72바이트 vs @Size 문자).

## 휘발성 맥락 (파일에 없음)
- 코드 스타일: Checkstyle 10.20.2(record), 스페이스4, Spotless=eclipse naver-formatter. 룰 완화 금지·포맷터 튜닝 우선(B-022).
  테스트 한글명 *Test.java suppress(B-023). 새 세션은 CLAUDE.md §7 필독으로 자동 인지(킥오프에도 반영).
- 게이트웨이: 루트=서비스 + :gateway 형제(전면 재구조화 회피). GatewayAccessFilter(서비스측, JWT보다 앞, actuator·error 제외).
  X-Gateway-Token .set() 덮어쓰기. Spring Cloud 2025.0.0 신규 스타터 spring-cloud-starter-gateway-server-webflux. 통합테스트 base enforced=false.
- .env 규약: 홀드. IDE EnvFile 사용 확정, 나머지 실행경로(gradlew/test/CI)·기본값 정책·파일구성 미결. .env=로컬 오버레이·배포=플랫폼 환경변수 방향으로 논의됨(미확정).
- 코드리뷰(auth): 완료·흡수됨. M1 수정. m1(refresh 슬라이딩 vs 절대상한)·m3 게이트2 이월.
- Claude Code 세션 분리: auth=서블릿 세션, 012 게이트웨이=WebFlux 새 세션. 다음 도메인도 스택/독립성 따라 세션 판단.

## 재개 필독 (경로·순서)
1. notes/handover.md(이 파일)
2. inbox-log.md + "수신함 확인" 스캔(신규 [→ 백엔드], B- 언급) — 특히 020 회신·021 검수·다음 도메인 지시.
3. decision-log.md B-015~027
4. 확정 스펙: docs/domain-spec.md·erd.md·api-contract.md(v1.2) + CLAUDE.md(§7 스타일 추가됨)
5. 진행: 020 회신 처리 → 다음 도메인은 총괄 순서 지정 후 착수. 게이트웨이 후속(429·관측성)은 020 결정 후.
