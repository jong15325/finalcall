# FC-173 메모/쪽지 통합 리뷰 (FC-171 백엔드 + FC-172 프론트)

- 리뷰어: reviewer (2026-08-01)
- 1차 판정: **CHANGES-REQUESTED** (MAJOR 2건) → 재작업 → **재검토 PASS** (아래 재검토 결과 참조)

## 재검토 결과 (2026-08-01, 재작업 후) — **PASS**
- **MAJOR-1 해소**: `MemoController.normalizeSize`(MAX=100·DEFAULT=20) order 관례 이식·received/sent 적용. size=-1/0/과대 전부 방어.
- **MAJOR-2 해소**: `StringByteCounter.truncateToByteWidth(str,16)`(폭 metric 공유·글자 중간 안 깸·서로게이트 보호) + `MemoService` 발신자 닉 저장 전 절단. §8.2 해석 정확, VARCHAR(16) 오버플로 원천 차단. V20 무편집.
- **MINOR-1 해소**: `memoBytes.ts` 코드유닛 순회 전환 → 백엔드 동치(이모지 4바이트 일치).
- **MINOR-2 해소**: `MemoServiceTest`(MEMO_003·수신자 전이·발신자 무전이·MEMO_004·>112 400·20자 닉 회귀가드) + `StringByteCounterTest` 절단 6종.
- **MINOR-3 해소**: 낙관적 미열람 감소를 상세 GET 성공 시점(`pendingReadRef`+`useEffect`)으로. 실패 시 뱃지 불변.
- **MINOR-4 이연 유지 OK**: >16자 닉 수신 불가 = 계약 §6·§11 승인 이연. 제품 가시화만 권고(비차단).
- **회귀 없음**: DTO·계약·JSON 형상 무변경, 변경 라인 전부 4개 지적에 추적, 불필요 리팩터 없음.
- **결론**: review_status=passed. 잔여 major 없음.

---
## 1차 리뷰 (원본)

- 판정: **CHANGES-REQUESTED** (MAJOR 2건 · 둘 다 백엔드)
- 대상: `backend/.../domain/memo/**`·`StringByteCounter`·`MemoErrorCode`·`V20__user_memo.sql`·`UserRepository`(파생쿼리) · `frontend/src/features/memo/**`·`lib/{api,queries}/memos`·`MessagesPage`·나비 진입점·`errorCodes` + 테스트

## CRITICAL
- 없음.

## MAJOR
### MAJOR-1 — 커서 `size` 미보정(무한대·음수) : 기존 클램프 관례 위반
- 위치: `memo/controller/MemoController.java:49-62`(received·sent) → `service/MemoService.java:89,97` → `repository/MemoRepositoryImpl.java:30,39`(`.limit(size+1L)`).
- 근거(관례): `settlement/.../OrderController.normalizeSize`·`bid/.../BidController`(`Math.min(size,MAX)`)·shop 컨트롤러 모두 `1..MAX_PAGE_SIZE`로 접는다. memo만 원문 전달.
- 재현: `size=1000000`→`limit(1000001)` 과대 페치 / `size=-1`→`subList(0,-1)` **500** / `size=0`→hasNext=true·빈 content 형상 이상.
- 수정: `OrderController.normalizeSize`와 동일 보정을 컨트롤러(또는 서비스)에 적용.

### MAJOR-2 — 발신자 닉 스냅샷(≤30자) → `sender_nickname VARCHAR(16)` 오버플로(spec §8.2 절단 미구현)
- 위치: `service/MemoService.java:76` `.senderNickname(sender.getNickname())` → `entity/Memo.java:55`·`V20__user_memo.sql:14` `sender_nickname VARCHAR(16) NOT NULL`.
- 근거: `member/entity/User.java:56 @Column(length=30)`·`SignupRequest @Size(max=30)` — 17~30자 닉 정당 존재. spec §8.2는 "30자 닉 스냅샷 시 16 절단" 규정하나 **send() 경로에 절단·검증 없음**.
- 재현: 자기 닉 17~30자 사용자 발신 → INSERT 길이초과 → strict 모드 **500(모든 발신 불가)** / 비-strict면 무단 절단(닉 lineage 손상).
- 수정: send()에서 sender 닉을 §8.2대로 저장 전 16폭 절단(또는 회원 도메인 닉 ≤16 근본정합 §11). 최소한 graceful 처리(500 금지).

## MINOR
1. **바이트 카운터 surrogate 불일치** — 프론트 `memoBytes.ts:22-33`은 `for..of`(코드포인트), 백 `StringByteCounter.java:39`는 `charAt`(코드유닛). 보충문자(이모지)에서 프론트2·백4로 갈림. 한글·ASCII 무해(레거시=코드유닛이 정본). 프론트를 코드유닛 순회로 맞추면 완전 동치.
2. **서비스/IDOR 테스트 부재** — `isParticipant`(MEMO_003)·수신자 한정 읽음 전이·자기발신(MEMO_004)·발신 폭(≤112→400) 서비스/컨트롤러 테스트 없음. 슬라이스가 짧은 닉만 써 MAJOR-2를 못 잡음. authz·전이·경계 테스트 추가 권고.
3. **낙관적 미열람 감소가 상세 GET 성공과 무관** — `MessagesPage.tsx:66-72` 선택 즉시 감소. GET 실패 시 뱃지만 감소해 순간 드리프트(staleTime 30s 자기치유). 경미.
4. **>16자 닉 회원 수신 불가**(계약 §6 ≤16·§11 이연) — 스펙 승인 범위, 제품 가시화 권고.

## FC-172 확인 요청 3건 판정
1. **보낸함 레벨/성별 태그 미표기 — 타당(유지)**. senderLevel/gender=발신자 스냅샷이라 보낸함(상대=수신자)에 붙이면 오표기. `showLevel=received&&!system` 처리 정확.
2. **MEMO_002/003 동일 UI 문구 — 적절(유지)**. 백엔드 404/403 구분 유지·프론트만 뭉침(열거 완화). public_id 26자 ULID라 오라클 위험 낮음. 향후 노출 시 API 404 통일 검토(비차단).
3. **모바일 하단내비 5→6 additive — 수용 가능(디자인 확인 권고)**. 상대순서 보존해 "순서 고정"과 무충돌. 단 ~320px에서 촘촘·"홈" 중앙 밀림 → 최종 디자인 확인 권고.

## 불필요 변경(coding-discipline)
- 위반 없음. 변경 파일 전부 FC-171/172 요청에 추적. `UserRepository`는 파생쿼리 1줄만.

## 재작업 요약
- MAJOR-1·MAJOR-2 → **FC-171(backend) 재작업**. review_status=changes-requested.
- MINOR-1·MINOR-3 → FC-172 소폭 정정(byte 코드유닛 동치·낙관적 감소 GET 성공 시). MINOR-2 → 백엔드 authz 테스트 추가.
- 확인 3건 모두 현행 유지 타당(2·3 비차단 권고).
