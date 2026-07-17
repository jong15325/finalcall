# FC-005 리뷰 — member 도메인 (FC-002·003·004)

대상: FC-002·FC-003·FC-004 · reviewer 판정을 메인세션이 기록 · **통과 권고**

## 판정
review_status: **passed** (critical 0 · major 0 · minor 3)

## 심각도별 발견
### Critical / Major
- 없음.

### Minor (비차단 · 후속 위생)
1. `User.java` 원본 컬럼 `login_id`/`nickname`에 `unique=true` 선언이 erd D-081(생성 컬럼 UK) 문언과 불일치. `ddl-auto=validate`에선 무해(inert)하나 `update/create` 전환 시 잠재 함정 — 주석 또는 `unique` 제거 권고. **(FC-004 대상 외 선행 엔티티)**
2. `RefreshTokenStore` 해시 비교 비대칭(`validate`=상수시간 / `rotate` Lua=일반 비교). SHA-256 해시라 실질 타이밍 공격면 없음 — 이론적 일관성 지적.
3. `MemberService.toNicknameDuplicateException`가 `to*` 네이밍이면서 예외를 던지는 형태 — 가독성 minor(동작 정상).

## 확인된 정합 (요지)
- 보안: IDOR/인가(주체=SecurityContext, 타인 /me 경로 부재), mass-assignment 차단(nickname 단일 필드), 탈퇴 세션 폐기 순서(delete→revokeAll), 재가입 UK 활성필터(D-081), 탈퇴 동의 필수, 열거 방지(탈퇴 주체 401 COMMON_005).
- QA: 계약 2.5절 응답/에러코드 준수, 204 무래핑, MEMBER_001/002·COMMON_005 매핑·테스트 일치.
- MEMBER_002 확장 지점(경매·주문 TODO) 명시적 잔류.
- coding-discipline 원칙 3: 변경 라인 전부 티켓 추적, 무관 변경 없음.

## 후속 권고 (비차단, 향후 티켓)
- minor 1: User.java `unique=true` 정리(ddl-auto 전환 함정 예방).
- MEMBER_002 확장 TODO는 auction/bid/order 도메인 착수 티켓에서 반드시 소진(현재 홀드만 차단).
