# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-25** (이메일 인증 세션 — spec·계약 확정 직후, 게이트1 상신 직전에서 세션 사고 중단 → 상태 보존)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

> ★ **이 갱신의 경위**: 이전 세션에서 **EPIC-EMAIL-VERIFY(회원가입 이메일 인증)** 를 진행 —
> 게이트2(스키마·계약·정책값 8항목) 사용자 승인 → architect가 spec v0.1 확정 → api-contract v1.15 반영까지
> 완료한 상태에서 **세션이 사고로 중단**됐다. 이 핸드오버는 그 시점을 보존한다. 코드 구현은 아직 시작 안 함.

---

## 지금 어디인가 — 한 문단

**EPIC-EMAIL-VERIFY 활성.** 회원가입 이메일 인증 도입을 진행 중이며, **설계(contract-first)까지 완료·구현 전**이다. 순서상 **게이트2(스키마·API계약·정책값 8항목)를 사용자가 승인(2026-07-24)** → **architect가 spec 확정(`email-verify-spec.md` v0.1, 2026-07-25)** → **api-contract v1.15 반영** 까지 왔다. 남은 관문은 **게이트1(에픽 분해안을 사용자에게 제시·조정)** 이고, 분해안 초안은 spec §8에 이미 있다(백엔드 B1~B7 · 프론트 F1~F4). 아직 **하위 FC 티켓을 발번하지 않았고**(에픽 `children: []`), **문서 3건(spec·계약·에픽)이 미커밋**이다. 세션 중단으로 게이트1 상신 직전에 멈췄다.

---

## A. EPIC-EMAIL-VERIFY 현재 상태 (활성)

### 확정된 것 (되돌리지 말 것)
- **게이트2 승인**(사용자, 2026-07-24) — 8항목 전건. 아래 결정이 계약·spec의 근거다:
  1. 이메일 = **가입 시 선택**(필수 아님). 나중에 추가 가능 → `PUT /me/email` 필요. `Member.email` nullable.
  2. 인증 흐름 = **가입 후 인증**(계정 먼저 미인증 생성 → 코드 발송·확인). 미인증 기능제한 정책은 **이월**(에픽 열린결정 6).
  3. 인증 방식 = **6자리 숫자 코드**(매직 링크 아님), 앱 내 완결.
  4. 발송 = **진짜 SMTP · 네이버**(`smtp.naver.com:465` SSL). 크리덴셜은 **사용자가 env 직접 주입**(총괄 대리 불가·보안). 로컬 = 발송 스킵+코드 로그 / dev·prod = 실발송·fail-fast.
  5. 코드 저장 = **Redis TTL + SHA-256 해시**(RefreshTokenStore 패턴 재사용, Lua 원자 CAS·상수시간 비교). 신규 `EmailVerificationCodeStore`.
  6. 정책값 = **만료 10분 · 재전송 쿨다운 60초 · 시도 5회 · 6자리**. `EmailVerifyProperties`(@ConfigurationProperties+@Validated)로 바인딩.
  7. 이메일 **유니크**(활성 회원 기준, `email_active` 생성컬럼 UK · NULL 제외). Flyway **V17**.
  8. `GET /me` = **`emailVerified`(bool) + `emailMasked`(nullable)** 노출, 원문 미노출.
- **spec 확정**: `docs/spec/email-verify-spec.md` **v0.1** (architect, DRAFT 해제). 데이터 모델·Redis 스킴·API 4종·에러코드·SMTP 설정·보안 체크리스트·분해안(§8) 전부 기재.
- **계약 반영**: `docs/spec/api-contract.md` **v1.15** — signup email 선택 추가·이메일 엔드포인트 3종·GET/PATCH `/me` 필드 2개·§5 `EMAIL_001`~`EMAIL_007` 등재.

### 신규 API 요약 (계약 v1.15 / spec §4)
| 엔드포인트 | 동작 | 응답 |
|---|---|---|
| `signup` 변경 | `email?` 선택 필드(제공 시 미인증 저장, 자동발송 안 함) | 201 무변경 |
| `PUT /api/v1/me/email` | 이메일 설정/변경(verified 재초기화·pending 코드 폐기·동일값 no-op) | 200 `{email, emailVerified:false}` |
| `POST /api/v1/me/email/verification-request` | 6자리 코드 발송(Redis 해시·쿨다운) | 202 (본문 없음) |
| `POST /api/v1/me/email/verify` | 코드 확인(상수시간·시도 5회) | 200 `{emailVerified:true}` |
| `GET·PATCH /api/v1/me` | `emailVerified`·`emailMasked` 추가(3상태 구분) | — |

에러코드: `EMAIL_001`(불일치422)·`002`(만료·미발송422)·`003`(시도초과429)·`004`(쿨다운429)·`005`(이미인증409)·`006`(미설정409)·`007`(이미사용중409).

### 분해안 초안 (spec §8 — 게이트1 조정 대상, 아직 미발번)
- **백엔드**: B1 Flyway V17 → B2 User 엔티티 → (B6 signup 변경, B7 이메일 엔드포인트 3종). B3 Redis Store·B4 메일 인프라는 독립 선행(B1·B2와 병렬). B5 EmailErrorCode+Properties+yml은 B3·B4 후 B7 전.
- **프론트**: F1 가입 폼 email(선택), F2 인증 화면(**디자인 게이트 — 새 화면**), F3 errorCodes.ts 동기화, F4 GET /me 3상태 배너.
- 의존: B1→B2→(B6,B7). B3·B4 독립. 프론트 F2는 디자인 게이트 후.

### ★ 열린 결정 (착수 시)
- **미인증 기능제한 정책**(입찰·판매 차단 등) = **이월**(코어 인증 후 독립 정책 층, 에픽 열린결정 6). 코어 구현을 막지 않음.
- **미인증 이메일 스쿼팅**(accepted risk) = 현 설계는 미인증도 유니크 선점(registration DoS 가능). spec §7에 감수 근거 + 향후 강화안(`IF(is_deleted OR NOT email_verified, NULL, email)`) 기재. 이번 범위는 단순 패턴 유지.

### ★ 총괄이 할 일 (재개 시)
1. **문서 3건 커밋** — spec·계약·에픽. 커밋=사용자 승인 후(섹션 13, [[commit-needs-approval]]). 제안 메시지 아래 D절.
2. **게이트1 상신** — spec §8 분해안을 [[gate2-plain-language]] 원칙(전문용어 없이 제품 언어)으로 사용자에게 제시 → 조정 → 하위 FC 티켓 발번(다음 번호 **FC-117**부터). 에픽 `children` 채우고 미러.
3. **팬아웃** — B1·B2·B3·B4 병렬 가능(쓰기 파일 무교차). F2는 디자인 게이트 후.
4. **미러** — 티켓 발번·전이마다 Jira 즉시 반영([[jira-mirror-discipline]]). 에픽 `jira_key: null` → 미러 생성 필요.

---

## B. 총괄 맥락 — 완료 에픽·환경·보드

### 완료된 에픽 (전건 게이트3 done·사용자 승인·푸시됨)
- **EPIC-SHOP** (KAN-102): 고정가 마켓(등록·구매·취소·만료). 정산 자산(SettlementRecorder·sale_order) 재사용. V15.
- **EPIC-MARKET-DATA** (KAN-108): skill_definition 244행·카드/상세 스킬명 노출·마켓 5천 로컬 시드.
- **EPIC-SHOP-MANAGE** (KAN-115): `GET /me/shops` 내 판매 조회·내리기.
- **EPIC-SEARCH** (KAN-119): ES 8.18.8(nori)+Kafka(KRaft)+Kafka Connect(Debezium+Aiven ES sink) 검색 스택.
- **EPIC-PURCHASE** (FC-088~090): 즉시구매·거래내역(orders 역할별 노출).
- **FC-101** (KAN-113, 최근 done): 마켓 목록 대량 잰더 해소(ShopCard memo·per-second now 격리).
- **FC-102** (KAN-114): 인벤토리 슬롯 UI(코덱스 세션서 96×178 확대 반영·커밋됨).
- **FC-110** (KAN-124): 검색 정합성 하드닝 #1·#2·#4·#5 종결.

### 남은 것 / 후속 (done 안 막음)
- **하드닝 백로그**: 마감 잔액 락·초소액 settle·purchase×close 데드락·시드 오염·토큰 localStorage→쿠키·마스킹 게이트2·dev deps 취약점.
- **남은 백엔드 에픽**: EPIC-GRADE(등급, grade-tier-spec v0.1·게이트2 8항목 준비). 준비중 자리 실기능화: 충전(Toss)·커뮤니티 CRUD·알림·OAuth·**이메일인증(←현재 진행)**·슬롯확장.
- **FC-114**(이메일인증 백로그 티켓) = 지금 EPIC-EMAIL-VERIFY로 실기능화 중. 에픽 done 시 FC-114도 정리.

### 계약 정본
`docs/spec/{shop-spec v1.0, purchase-spec, closing-domain-spec, fee-policy-spec, skill-exposure-spec v1.0, search-spec v0.4, erd v1.4, **api-contract v1.15**, **email-verify-spec v0.1**}` · `references/game-item-skill-format.md §5`.

### 데모 계정
`demo1`~`demo10` / `demo1234!`. 마켓 5천 시드(demo 판매자별 ~500). 5천 재시드는 DB 리셋 필요(DROP은 사용자 직접).

---

## C. Git 상태
- **커밋된 것은 전부 푸시됨**: 로컬 `master` == `origin/master`(미푸시 없음).
- **워킹트리 미커밋**:
  - M: `docs/spec/api-contract.md`(v1.15 이메일 인증)
  - ??: `docs/board/epics/EPIC-EMAIL-VERIFY.md` · `docs/spec/email-verify-spec.md`(신규 spec·에픽)
  - ??: `.tmp-market-debug/`(코덱스 스크린샷 3장 — **커밋 제외 대상**, 정리 필요) · `docs/game_ui/card_info/*.png`(4장 — 추적 여부 결정)
- **push는 사용자만**(게이트3 훅이 에이전트 push 차단).

---

## D. 재개 시 커밋 제안 (사용자 승인 후 — 섹션 13)

문서 3건은 이메일 인증 설계 확정의 atomic 산출물이다.

```
docs(spec): 이메일 인증 계약·spec 확정 — api-contract v1.15 · email-verify-spec v0.1 (EPIC-EMAIL-VERIFY 게이트2)

목적
- 회원가입 이메일 인증 설계를 contract-first로 확정(구현 전).

세부 내용
- 계약: api-contract v1.15 — signup email 선택·이메일 엔드포인트 3종·GET/PATCH /me 필드 2개·§5 EMAIL_001~007.
- spec: email-verify-spec v0.1 확정(데이터 V17·Redis 스킴·정책값·SMTP·보안·분해안 §8).
- 에픽: EPIC-EMAIL-VERIFY(게이트2 승인 기록·열린결정).

수정 파일
  변경(M): docs/spec/api-contract.md
  추가(A): docs/spec/email-verify-spec.md · docs/board/epics/EPIC-EMAIL-VERIFY.md
```

- `.tmp-market-debug/`·`card_info/*.png`는 이 커밋에 **포함하지 않는다**(별도 정리·gitignore 판단).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지.
2. 이 파일 + `git log --oneline -20` + `git status` + `docs/spec/email-verify-spec.md`(활성 spec) + `docs/board/epics/EPIC-EMAIL-VERIFY.md`.
3. 메모리: `commit-needs-approval`·`gate2-plain-language`·`jira-mirror-discipline`·`main-session-no-direct-verify`·`options-need-html-mockup`·`design-mockup-first`.
4. 검색·앱 스택이 재부팅으로 내려가 있으면 아래 "환경 기동". 이메일 인증 설계는 스택 없이도 진행 가능(구현 착수 전).

---

## 다음 수
1. **사용자 "출근" 후**: 문서 3건 커밋 승인 상신(D절) → **게이트1 분해안 상신**(A절 §8, 평이한 언어) → 조정 → FC-117~ 발번·미러 → 팬아웃(B1·B2·B3·B4 병렬).
2. **디자인 게이트**: 프론트 F2(이메일 인증 화면)는 새 화면 → 디자인 방향 사용자 확인 후 착수([[design-mockup-first]] — HTML 목업 선제작).
3. **SMTP 크리덴셜**: 구현·실발송 검증 단계에서 사용자가 네이버 env(`MAIL_USERNAME`/`MAIL_PASSWORD`) 직접 주입 필요(총괄 대리 불가). 로컬은 `sender-enabled:false`로 크리덴셜 없이 코드-로그 테스트.

---

## 환경 기동 — ★ 함정 (검색 스택)
```bash
# DB/캐시: docker start finalcall-mysql finalcall-redis
# 검색 스택(무거움): cd backend && docker compose -f docker-compose.local.yml up -d --build
#   create-index: bash docker/search/create-index.sh (인덱스 템플릿+alias listings_search)
#   커넥터: docker exec -i finalcall-mysql mysql -uroot -proot < docker/search/mysql/debezium-user.sql; bash docker/search/register-connectors.sh
# 백엔드: JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11 ; (루트에서) ./gradlew :backend:bootRun --args='--spring.profiles.active=local'
#   → 부팅 재색인(local)이 ES에 ~5040건. Flyway V1~V16 자동(이메일 인증 구현 시 V17 추가).
# 프론트: cd frontend && npm run dev (localhost:5173, /api→8080 프록시+X-Gateway-Token)
```
- **함정 A(폐쇄망)**: Confluent Hub CDN 차단 — ES sink는 Aiven(GitHub).
- **함정 B(ES 버전)**: Boot 3.5 ES 클라=8.18.8 → 서버도 8.18.8(불일치 시 검색 503).
- **함정 C(인덱스 매핑)**: create-index는 인덱스 템플릿으로 keyword 매핑 고정(동적 text면 정렬 fielddata 오류).
- **함정 D(mysql binlog)**: finalcall-mysql이 compose 밖이면 CDC 라이브 동기 안 됨.
- **함정 E(gradlew cwd)**: bootRun은 레포 루트에서. ⚠ Flyway 체크섬 오류 시 `flyway repair`.
- **함정 F(SMTP·신규)**: 이메일 실발송은 네이버 메일 POP3/SMTP 사용 ON + 애플리케이션 비밀번호 필요. 로컬 기본 `sender-enabled:false`로 부팅(크리덴셜 없이).

---

## 교훈
1. **설계는 확정, 구현은 미착수 시점의 스냅샷이 재개에 가장 중요하다** — 게이트2 승인 8항목·spec v0.1·계약 v1.15가 되돌리면 안 되는 확정선이다.
2. **크리덴셜은 총괄이 대리 입력 못 한다** — SMTP env는 사용자 주입, 로컬은 발송 스킵으로 우회.
3. **게이트1 분해안은 평이한 언어로 상신**([[gate2-plain-language]]) — 기술 라벨(B1~B7)이 아니라 사용자가 조정할 수 있는 제품 단위로.
4. **미인증 스쿼팅은 감수한 위험**(spec §7) — 재론 시 강화안 존재하나 이번 범위는 단순 패턴.
