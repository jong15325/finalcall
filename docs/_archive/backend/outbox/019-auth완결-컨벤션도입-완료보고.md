상태: ANSWERED → mgmt/outbox/050. 검수 통과(구현 DoD), 발번 B-015~025 인덱스 등재(B-019→D-076·B-020→D-075), B-019 명문화 D-076. 순서=012 착수(051). QA 기동 사용자 확정 대기. B-015~025 로그 기재분은 커밋으로 총괄 노출
회신대상: management/outbox/041-백엔드-auth계획승인-refresh결정.md (auth 구현 완료 보고 요청)
# [백엔드 → 총괄] 완료 보고: auth 도메인 구현 완결(G4-1) + 코드 컨벤션 도입

## 산출물

### auth 수직 (signup·login·refresh·logout — api-contract §2 v1.1 정합)
- domain/auth: User·UserBalance·UserRepository·UserBalanceRepository·AuthService·AuthErrorCode·TokenBundle
- common/security: TokenProvider·TokenClaims / infra/security: HmacTokenProvider·JwtAuthenticationFilter·RefreshTokenStore·JwtAuthenticationEntryPoint
- api/auth: AuthController + DTO(Signup/Login/Refresh/Logout Request·Response) / infra/config: SecurityConfig·JwtProperties
- db/migration: V3__user_and_balance.sql
- 코드리뷰 M1(중복 경쟁 409 정합) 수정 + 동시성 테스트(signup 6스레드·rotate 8스레드) 보강. 데모 컨트롤러 제거·명칭 통일 완료.

### 코드 컨벤션 도입 (B-020)
- Naver 핵데이 + Spotless/Checkstyle: config/checkstyle/naver-checkstyle-rules.xml(+suppressions), .editorconfig, config/naver-eclipse-formatter.xml, .gitattributes, build.gradle.

## 완료 기준 충족 여부
- 계약 준수: §2 4종 엔드포인트 경로·스키마·상태코드·에러코드(AUTH_001~004) 정합. [충족]
- 컨벤션: CLAUDE.md §5(도메인) + §7(스타일). [충족]
- 테스트: 단위·통합(실 MySQL/Redis)·동시성 통과, `./gradlew clean build` 완전 그린(checkstyle main·test·spotless·test 위반 0). [충족]
- 코드리뷰: M1 해소(병합 차단 없음), m1/m3 이월. [충족]
- 미충족(G4-1 DoD의 QA 파트): QA 시나리오 실행·defects 처리 — QA 역할 대기.

## 신규 발번 ID (자율 결정 — 마스터 인덱스 반영 요망, D-011)
- B-015 API 라우팅 — 컨트롤러 클래스 레벨 @RequestMapping(전역 접두 미도입)
- B-016 password 검증 잠정(@Size max=72, 강화 보안게이트2 이월)
- B-017 로그인 타이밍 사이드채널 — 보안게이트2 이월
- B-018 refresh 회전 vs 탈퇴 순서 — 보안게이트2 이월
- B-019 204 No Content — ApiResponse 미적용(void + @ResponseStatus)
- B-020 코드 스타일 자동화 도입(Naver 핵데이 + Spotless/Checkstyle, 스페이스4)
- B-021 Checkstyle 10.20.2(Java 21 record 지원)
- B-022 포맷터↔Checkstyle 정합 정책(포맷터 튜닝 우선, 룰 완화 금지)
- B-023 테스트 메서드명 한국어 허용(*Test.java suppress)
- B-024 signup 중복 409 정합(제약 위반 예외 매핑)
- B-025 refresh 만료 — 회전 슬라이딩 현행 + 절대 상한 보안게이트2 이월

## 다음 단계·제안
1. CLAUDE.md §5 "204/no-content 예외"(B-019) 명문화 검토 요청(지침=총괄 소관).
2. 보안 게이트2 이월분: B-016·B-017·B-018·B-025 + m3(BCrypt 72바이트 vs @Size 문자) — G4-1 완료 후 보안 게이트2 대상으로 등재 요청.
3. 012 SCG 엣지 게이트웨이(D-068) 스켈레톤 — 별도 유닛 착수 대기.
4. G4-1 게이트 통과 판정: 구현 DoD 충족 → QA 시나리오 실행 필요(QA 기동 요청).

## 회신
- 회신: 필요 — (a) 발번 인덱스 반영 확인, (b) B-019 명문화 여부, (c) 012 착수·QA 기동 순서.
- 신규 발번 ID: 없음(B-015~025 기보고분).
