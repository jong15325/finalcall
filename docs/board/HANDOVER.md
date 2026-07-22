# 총괄(메인 세션) 핸드오버

목적: 총괄 세션 교체용 상태 스냅샷. 새 세션은 **이 파일 + `docs/board/` + `git log` + CLAUDE.md 섹션 8~13**으로 이어받는다.
갱신: **2026-07-22** (EPIC-CLOSING·EPIC-PURCHASE 완료 + UI 폴리시 + 데모 시드 반영 — 세션 교체 지시로 작성)

**재개 규약**: 사용자가 **"출근"** 명령을 주면 이 파일을 읽고 "다음 수"부터 진행한다.

---

## 지금 어디인가 — 한 문단

**백엔드 동결 해제됨.** 오늘 백엔드 에픽 2종을 완주했다 — **EPIC-CLOSING**(경매 마감 워커 + 낙찰 정산 SOLD/UNSOLD·수수료 수익원장) + **EPIC-PURCHASE**(즉시구매 buyNow + 거래내역 orders). 프론트 재구축(EPIC-FE-REBUILD)은 앞 세션에 완료됐고, 이번에 사용자 실물 검증 피드백을 받아 **UI/반응형 폴리시 3건**(FC-085 아이템 스프라이트/비교버튼/이미지·FC-086 반응형/사이드바·FC-087 사이드바 핀+hover/목록 무한스크롤)을 반영했다. 검증용 **로컬 데모 시드**(FC-084)도 넣어 **앱이 지금 로컬에서 실행 중**이다. 각 에픽은 게이트 절차(계약→구현→동시성/보안 검수→게이트3) 전건 통과·사용자 승인·기록됨. **로컬 14커밋 미푸시**(오늘 작업 전부).

---

## 이어받는 법 (새 세션)
1. `CLAUDE.md` 섹션 8~13 숙지.
2. 이 파일 + `git log --oneline -30` + `git status`. **미푸시 14커밋** 있음(push는 사용자).
3. 메모리: `brand-identity`(장터)·`mockup-fidelity-only-fix`(목업 그대로·색만 브랜드)·`gate2-plain-language`(기술 결정은 평이하게 상신).
4. 계약 정본: `docs/spec/{closing-domain-spec v1.0, purchase-spec v1.0, fee-policy-spec v1.0, erd v1.4, api-contract v1.13}` · `docs/ux/rebuild-contract-map.md`.
5. **★ 앱이 실행 중일 수 있다**(아래 "앱 실행 상태"). 다음 수로 진행.

---

## ★ 앱 실행 상태 (이 세션에서 띄워둠 — 새 세션 확인 필요)
- **실행 중**: docker `finalcall-mysql`·`finalcall-redis`(healthy) · 백엔드 `gradlew :backend:bootRun`(local, :8080) · 프론트 `npm run dev`(:5173). **재부팅/세션 종료 시 내려갈 수 있음** — 없으면 아래 "환경 기동"으로 재기동.
- **★ 포트 충돌 주의**: 다른 프로젝트 `on-race` 컨테이너가 3306·6379를 점유하면 finalcall이 못 뜬다. 이 세션에서 사용자가 on-race를 종료함. `docker ps`로 확인.
- **데모 계정**: `demo1`~`demo10` / 공통 비번 `demo1234!`. 시드는 **멱등**(이미 시드됨·재부팅해도 유지). 곧-마감 경매(정산 실시간 관전)는 **최초 시드 때만** 신선 — 다시 보려면 재시드(DB 초기화).
- **즉시구매 테스트**: buyNowPrice 설정 ACTIVE 경매 7건 존재. demo1로 남의 경매 상세 → 즉시구매 → 인벤/지갑/거래내역 확인.

---

## ★ 완료된 백엔드 에픽 (오늘)

### EPIC-CLOSING (KAN-89) — 경매 마감·낙찰 정산 [done·push 완료]
- 정본 `closing-domain-spec.md` v1.0. `@Scheduled` 마감 워커(auction 행 비관락+종료성 CAS·SCHEDULED 포함)·SOLD(WON·홀드 CAPTURED·아이템 이전·수수료 누진·판매자 크레딧·**수익원장 적립**)·UNSOLD(반환).
- **수수료 귀속 = ④-C 전용 수익 원장**(`platform_revenue_ledger`, 게이트2 D-103). 게임머니 **총량 보존**(불변식 I-H).
- V14(`sale_order`+`platform_revenue_ledger`). test 255. concurrency+보안 리뷰 통과.

### EPIC-PURCHASE (KAN-97) — 즉시구매 + 거래내역 [done·미푸시]
- 정본 `purchase-spec.md` v1.0(게이트2 D-104). 즉시구매 `POST /auctions/{id}/purchase`(buyNow 즉시 SOLD·BUYNOW·구매자 직접차감·진행입찰 홀드 RELEASE·정산 재사용). 거래내역 `GET /me/orders`·`/orders/{id}`(IDOR·**fee/settle 판매자만**).
- **SettlementRecorder 추출**(마감·구매 공통 정산 꼬리). **A4 잔액 락 user_id 오름차순**(검수 major 1건 수정·데드락 회귀 테스트). 스키마 무변경. test 281. concurrency+보안 리뷰 통과.

### UI/반응형 폴리시 (사용자 실물 피드백) [done·FC-087만 일부 미푸시]
- FC-085(아이템 스프라이트 스테이지 공용 통일·비교버튼·이미지 확대·임시보관 아트·배너 스와이프) · FC-086(인벤 2/3/6 반응형·전 페이지 반응형·사이드바) · FC-087(사이드바 **핀+hover 모델**·Vuexy 라디오 토글·목록 무한스크롤).
- FC-084 로컬 데모 시드(`@Profile("local")`·동적 타임스탬프·멱등).

---

## 남은 백엔드 에픽 (동결 해제됨 — 게이트1부터)
- **EPIC-SHOP** (고정가 마켓): 프론트 "준비 중" 자리 존재. `sale_order.source_type`·SettlementRecorder가 재사용 준비됨.
- **EPIC-GRADE** (등급): 초안 `grade-tier-spec.md` v0.1·게이트2 8항목(D-102).
- **EPIC-SEARCH** (검색): 초안 `search-spec.md` v0.1·게이트2 C1~C3/A1~A5.
- **미구현 준비중 자리**(프론트): 커뮤니티 CRUD·알림·충전(Toss)·OAuth·이메일인증·슬롯확장.

---

## 이월 미결 / 하드닝 백로그
- **마스킹 게이트2**: 계약 §3.3 판매자 마스킹 vs 구현 `sellerNickname` 원문(프론트 `isOwnAuction` 1지점 격리).
- **토큰 저장소**: localStorage→httpOnly 쿠키(미결4, 백엔드 변경 선행).
- **하드닝 백로그(정확성 무관)**: 마감 잔액 락 순서 M1(EPIC-CLOSING) · 초소액 settle<0 M2 · **purchase×close 교차 데드락**(동기 정산 추가 시 CloseService user_id 정렬 재검토). 전부 money 안전·비차단.
- **운영 시드 오염**: LocalDemoSeeder는 local 전용이나 V13 데모 시드는 전 프로파일. 프로파일 분리 미결.
- **dev deps 취약점**(vitest/vite dev, prod 무관) · **LLM 보안 CI**(PR 워크플로+CLAUDE_API_KEY 필요).

---

## 다음 수
1. **사용자 "출근" 후 지시 대기** — 후보:
   - **(a) EPIC-SHOP**(고정가 마켓) — 정산 자산(SettlementRecorder·sale_order source_type) 재사용으로 가장 준비됨. 프론트 마켓 자리도 대기.
   - **(b) EPIC-GRADE / EPIC-SEARCH** 게이트2 확정 후 구현.
   - **(c) 준비중 자리 실기능화**(충전/커뮤니티/알림) 또는 하드닝 백로그.
2. **미푸시 14커밋 push**(사용자) — 오늘 작업 백업.

---

## 환경 기동 — ★ 함정 (변동 없음)
```bash
# 포트 충돌 시 먼저: docker stop on-race-main-mysql on-race-main-redis
docker start finalcall-mysql finalcall-redis
# 백엔드: JAVA_HOME=C:\Users\howee\.jdks\ms-21.0.11 ; ./gradlew :backend:bootRun --args='--spring.profiles.active=local'
#         (또는 IntelliJ FinalcallApplication, local). Flyway V1~V14 자동. LocalDemoSeeder 자동(멱등).
# 프론트: cd frontend && npm run dev  (localhost:5173, /api→8080 프록시+X-Gateway-Token)
```
- **함정 A(시드 시각)**: LocalDemoSeeder가 동적 타임스탬프라 V13 정적 시드 함정 해소됨. 단 V13 데모 경매는 부팅 직후 마감 워커가 종결.
- **함정 B(아트 크로마키)**: 아이템·프레임 PNG 알파 없음·네 귀퉁이 #0000FF. predev/prebuild sync-assets가 복사본만 RGBA 변환.
- **⚠ Flyway 체크섬**: 부팅 실패 시 `flyway repair`(V11 편집 이력, FC-035 m9).

---

## 교훈 (오늘 추가)
1. **게이트2 상신은 평이하게.** 백엔드 전문용어(CAS·비관락·원장) 말고 구체 숫자 예시로. 기술 선택은 architect 추천 위임, 제품 결정만 사용자에게(메모리 `gate2-plain-language`).
2. **정산 자산 재사용 설계.** EPIC-CLOSING의 SettlementRecorder를 EPIC-PURCHASE가 재사용 — 공통 정산 꼬리 단일화 + 경로별 머리 분리. EPIC-SHOP도 재사용 예정.
3. **검수 major는 계약 이탈에서 나온다.** 즉시구매 A4(잔액 락 순서)가 게이트2 승인과 어긋나 major — backend-impl이 "하드닝 후속"으로 남긴 걸 reviewer가 결함으로 확정. **게이트2 승인분은 구현이 정확히 따라야** 한다.
4. **실물 피드백이 폴리시를 낳는다.** 데모 시드로 앱을 띄워 사용자가 만지자 UI/반응형 피드백 3건이 나왔다. 시드+실행이 검증 루프를 만든다.
5. **병렬 팬아웃은 코드베이스로 가른다.** backend(FC-089)∥frontend(FC-090)는 파일 무교차라 병렬. reviewer 돌릴 땐 bootRun 내려 gradle 충돌 회피.
