# 기획/설계 대화 핸드오버 (2026-07-13)

성격: 세션 상태 스냅샷 — 새 기획/설계 대화가 이어받기 위한 인수인계. 근거는 각 정본 파일.

## 0. 너는 누구인가
- FinalCall(게임 아이템 경매 플랫폼)의 기획/설계 담당. 산출물: domain-spec.md → erd.md → api-contract.md(이 순서로만).
- 대화 간 직접 통신 불가. 모든 전달은 파일 버스(각자 outbox/) + 사용자 중계("수신함 확인해").

## 1. 시작 시 필독 (동기화)
1. docs/management/collaboration-guide.md — 협업 규약 정본(역할·에스컬레이션·파일버스·게이트).
2. docs/management/templates.md — 모든 메시지·로그·브리핑 템플릿(16절 브리핑 골격 필수).
3. docs/management/decision-log.md — 총괄 D 로그(내 근거의 정본).
4. docs/management/decision-index.md — 전체 ID 목차.
5. docs/design/decision-log.md — 내 P 로그. docs/design/inbox-log.md — 내 수신 이력.
6. CLAUDE.md — 코드/도메인 컨벤션.

## 2. 현재 단계
- domain-spec 논의 7개 주제 전부 종결(D-004~005, D-008, D-044~047, D-050~053, D-056~058).
- docs/domain-spec.md v0 DRAFT 작성 완료 — 단, 아이템 소절(7)만 미작성(플레이스홀더).
- 게이트: G1(domain-spec 확정) 미통과. 절차 = 기획 초안 + 총괄 검수 + 사용자 승인.

## 3. 확정 결정 요약 (정본은 D 로그)
- 주제1 판매방식: 경매(Auction, buyNowPrice 선택속성) + 고정가(FixedSale) 분리. buyNowPrice>startPrice. (P-001/002)
- 주제2 입찰: 계단식 증분(설정기반 시작), 자기·연속입찰 금지(proxy 제외), 소프트클로즈(T-30/+30, 총연장상한 필수), buyNow (b)최고가<buyNow 유지. (D-004)
- 주제3 생명주기: SCHEDULED(경매만) / status(SOLD/UNSOLD/CANCELLED)+resultType(BID/BUYNOW) / 판매자취소=무입찰&ACTIVE만 / 경매·고정가 SOLD→Order 핸드오프 / 고정가 선택 endAt→EXPIRED / 유찰재등록=신규. (D-005)
- 주제4 동시성: 정합성은 DB(CAS+유니크), 락은 최적화 / 종료전이 CAS 단일승자 / SOLD-Order 단일TX / 입찰 경매단위 직렬화(소프트클로즈 연장 동일 단위). (D-008)
- 주제5 아이템: 서프형 단순화 — 중앙 시드 item_template + 정형컬럼 인스턴스(JSON 없음) + 2단 카테고리 / 매물=template FK+인스턴스컬럼+표시스냅샷 / 강화·합성 범위밖(레벨=상태) / 고정 시드(가상명칭). (D-044~047)
- 주제6 사용자·화폐: 단일 User(관리자=플래그) / 2단 화폐(캐시 토스테스트 충전=별도 도메인 콜백·멱등키, 게임머니로 거래·입찰·정산, 교환비율 파라미터) / 입찰 홀드 / 환전·환불 범위밖 / 4-C 단일TX 확정. (D-050~053)
- 주제7 마감: 하이브리드(재예약 지연 인덱스+짧은주기 워커+DB 재구축) / 단일 인덱스 통합 / CAS 멱등+DB 재구축 / 마감 차감·홀드해제 동일 직렬화 단위. (D-056~058)
- 내 자율 발번: P-001(모델링) P-002(가격제약) P-008(상위입찰 시 홀드 즉시해제). P-003~007=void(재사용 금지).

## 4. 중요 규약 예외
- D-048: 아이템 도메인은 자율 결정 예외. 컬럼·특수스킬 목록 등 two-way door 세부까지 전부 총괄 안건화(사용자 참여). P 발번 금지. 다른 도메인(경매·입찰·주문)은 기존 위임 그대로.
- D-049/D-055: 매 응답 끝에 사용자 브리핑 4줄(한 일/수신·발신/발번·상태/할 일) 필수. templates 16절.

## 5. 열린 항목 (대기 중)
- design/outbox/012 (아이템 소절 목차·서술 방향 안건, D-048) — 총괄 회신 대기(SENT). 회신 오면:
  1) 안건 1(서술 깊이 a/b) 2) 안건 2(가상명칭 초안 주체) 3) 안건 3(소절 목차 승인) 반영
  → domain-spec.md 7절 작성 → 완료 보고(outbox 신규) → 총괄 검수 → 사용자 승인(G1).
- domain-spec.md 7절만 채우면 초안 완성.

## 6. 다음 액션 (재개 시)
1. "수신함 확인해" 지시 시 전 역할 outbox에서 [X → 기획/설계] 스캔 → inbox-log에 없는 것 처리.
2. outbox/012 회신 확인 → 아이템 소절 작성 → domain-spec 완료 보고.
3. G1 통과 후 erd.md 착수(D-036 골격: 네이밍/Mermaid/테이블표/인덱스표(이유열)/Flyway). ERD 아이템 테이블은 D-048로 안건화. 특수스킬 필터·시세 집계 인덱스 필수 케이스(D-044 조건).
4. G2 후 api-contract.md(D-035 골격, auth 섹션 우선 D-002). 기술 규칙(테이블네이밍·URL·페이징)은 G1 직후 백엔드 조기 협의 확정(D-035 조건) — 그 전 임의 확정 금지.

## 7. 내 폴더 구조
```
docs/design/
├─ decision-log.md   (P 로그: P-001/002/008, 주제 참조)
├─ inbox-log.md      (수신 이력, 표 형식)
├─ notes/            (topic-4/5/6, spec-format-checklist, 이 handover)
└─ outbox/           (001~012, NNN-주제.md, 발신 후 상태줄만 갱신)
```
docs/domain-spec.md = 내 산출물(루트, DRAFT v0).

## 8. 메시지/로그 형식 (templates.md)
- outbox 3줄 골격: `상태:` / `회신대상:`(회신일 때) / `# [발신 → 수신] 유형: 제목`. 유형 4종.
- 결정요청엔 선택지+추천+이유+"신규 발번 ID". 회신 발견 시 내 outbox 상태를 ANSWERED로 갱신.
- P 로그 항목: 상태·소유·관련·날짜 + 결정/이유/기각. 총괄 확정분은 escalated-as D-xxx 참조만(중복 금지).

## 9. Git
- 저장소 루트 D:\Java\finalcall(원격 github jong15325/finalcall). docs만 마운트되면 git 불가 → 루트 접근 필요.
- 커밋/푸시는 사용자가 인텔리제이로 실행(대행 시 루트 연결 + 자격증명 필요, 샌드박스엔 push 자격 없음).
- 미커밋: domain-spec.md, outbox/012, decision-log(P-008), 이 handover 등 — 사용자 커밋 필요.
