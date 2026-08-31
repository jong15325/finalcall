# FinalCall API Contract (계약서)

상태: **v1.40 — FC-415 홈 추천 rate 설정 검증·동적 Retry-After 확정(2026-08-31).** 이후 변경은 계약 변경 절차(`common/rules.md [6]`) 경유 + v+1.
소유: 기획/설계 (변경은 확정 후 6절 절차)
근거: domain-spec v0.5, chat-domain-spec v1.9, erd v2.0, D-035(형식 골격)·D-002(auth 우선)·D-065·B-004~009(기술 규약)
버전 규칙: G3 확정 = v1. 이후 변경은 계약 변경 절차(`common/rules.md [6]`) 경유 + v+1.

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1.40 | 2026-08-31 | **FC-415 보안 2차 수정 구현 계약 확정.** `gateway.home-recommend-rate-limit` validated properties에 replenish/burst/requested를 바인딩하고 전부 양수·`burst >= replenish`를 gateway 부팅 시 fail-fast 검증한다(silent clamp 없음). 홈 `Retry-After=ceil(requestedTokens/replenishRate)`를 long 안전 계산해 기본 1/1=1초·비기본 3/2=2초를 보장한다. 홈 전용 fail-closed composition과 기존 limiter를 분리하며 성공 API·rate 기본값·추천/구매 정확성 경계는 불변 |
| v1.39 | 2026-08-31 | **FC-415 구현 실측에 따른 계약 정정.** 사용자 승인 fail-closed 결정은 불변이나 SCG 기본 `RedisRateLimiter`가 Redis 장애 응답을 `allowed=true, remaining=-1`로 처리함을 테스트로 확인했다. 홈 추천 route 전용 `FailClosedRedisRateLimiter`가 이 오류 응답만 deny로 변환해 429 `GATEWAY_429`·하류 호출 0건을 보장한다. 정상 허용/소진 판정·rate 기본값·성공 API는 불변. `Retry-After` 설정 연동은 v1.40에서 확정 |
| v1.38 | 2026-08-31 | **홈 추천 보안 후속 게이트2 사용자 승인 확정.** 공개 `GET /api/v1/home/shop-recommendations`에 gateway IP rate limit을 적용한다. 기본 `replenishRate=1`·`burstCapacity=10`·`requestedTokens=1`, `HOME_RECOMMEND_RATE_LIMIT_*` 환경변수 조정, 일반 service route보다 선행, 기존 `TrustedProxyClientIpKeyResolver` 재사용. 한도 초과와 Redis limiter 장애는 429 `GATEWAY_429`+`Retry-After`로 fail-closed 처리한다. 구체 수단은 v1.39에서 실측 정정했다. Redis는 추천·구매 정확성 수단이 아니며 성공 API·무캐시·reason·쿼터·다양성은 불변. V29 운영 절차 정본 = `docs/backend/flyway-deployment-runbook.md` |
| v1.37 | 2026-08-31 | **FC-409 성능 후속 게이트2 A안 사용자 승인 확정.** MySQL 8·ACTIVE 2,000건 실행계획을 근거로 홈 추천 신규/GENERAL 최신 후보용 `ix_shop_status_created_at_id(status,created_at,id)` 1개를 추가한다. 검증 판매자 쿼리와 무캐시 정책은 유지하고 ACTIVE 2만·10만 재측정에서 후속 read model/cache 필요성을 별도 상신한다. `GET /home/shop-recommendations` 경로·응답·reason·쿼터·다양성 및 기존 API는 불변. 정본 = shop-spec §12.5~§12.6, erd v2.4 §5 |
| v1.36 | 2026-08-31 | **FC-408 게이트2 H1~H5 사용자 승인 확정.** §3.2에 공개 `GET /api/v1/home/shop-recommendations` 추가. 최대 6건, 응답 `{items:[{reason,shop:ShopSummary}],calculatedAt}`. 24시간 내 마감·완료 판매 5회 임계, 판매자 1건·템플릿 2건 제한과 템플릿→판매자 순 완화, 1차 무캐시·신규 인덱스 없음 및 `EXPLAIN ANALYZE` 후 별도 상신을 확정했다. 기존 API·ShopSummary·스키마·에러코드 무변경. 정본 = shop-spec §12 |
| v1.35 | 2026-08-25 | **FC-397 게이트2 사용자 승인 확정.** 기존 SPA 주도+backend code 교환, 즉시 자동가입, 이메일 자동연결 금지, 기존 JWT/refresh, `POST /api/v1/auth/oauth/{provider}` 요청·응답·에러 형상을 유지한다. 브라우저 `sessionStorage` pending state를 `provider+state+issuedAt+안전한 내부 returnPath`로 보강하고 5분 TTL·일회 소비·마지막 시도 우선 정책을 적용한다. PKCE·계정 연결·HttpOnly token cookie는 범위 밖이다. provider key는 환경변수 only, callback은 provider 콘솔·frontend·backend가 정확 일치해야 한다. **스키마·Flyway 무변경.** 정본=`oauth-live-hardening-spec.md` v1.0, 영향=FC-398~403. |
| v1.34 | 2026-08-23 | **FC-366 변경 계약 사용자 승인 확정.** `cardInfo.formalName`은 카드정보 모달·inline·상세 정보영역의 `{레벨}레벨 {원형 종류}` 명칭으로, `shortName`은 마켓·실시간 경매 등 목록과 compact card의 `Lv.{레벨} {속성약칭}{종류약칭}` 표시명으로 의미를 분리한다. 예: `9레벨 칼` / `Lv.9 바검`, `5레벨 마법` / `Lv.5 흙필`, 스페셜필은 `5레벨 스페셜필` / `Lv.5 흙스필`. `9바검`·`바검`·`불신`·`흙필` 등은 화면 표시명이 아닌 후속 검색 alias로 분리하며 이번 `cardInfo`에 검색 필드를 추가하지 않는다. DTO 형상·DB·엔드포인트·조회 계약은 불변이다. 정본=`item-domain-spec.md` §5.6, `frontend-ui-system-contract.md` §6.7. 영향=FC-367~369. |
| v1.33 | 2026-08-23 | **FC-366 Gate 2 사용자 승인 확정.** 경매·고정가의 공통 `item` 블록, 인벤토리·임시보관·배송의 `ItemSummaryResponse`, 아이템 인스턴스 상세에 동일한 중첩 `cardInfo`를 가법 추가한다. 서버가 목록 표시명과 카드정보 명칭, 분류·종류·속성 label/약어, 채널 제한, 블랙/골드 프레임·GF 잔여 일수, 슬롯별 스킬 표시와 `calculatedAt`·`validUntil`을 요청/목록당 단일 `Clock` 기준 시각으로 계산한다. 두 명칭의 표시 형식과 사용 경계는 v1.34에서 정정했다. 프론트는 이 값을 재계산하지 않고 렌더한다. 기존 `nameSnapshot`·`displayName`·`goldforceExpireAt` 및 모든 기존 필드는 호환·감사 목적으로 유지한다. DB·엔드포인트·에러코드·검색 계약은 불변이며 스키마 마이그레이션이 없다. 약칭/스킬 검색은 후속 에픽이다. 정본=`item-domain-spec.md` §5.6, `frontend-ui-system-contract.md` §6.7. 영향=FC-367~369. |
| v1.32 | 2026-08-22 | **FC-352 변경 계약 사용자 승인 확정.** `primaryCharacterId` 허용 집합을 종전 1..28에서 `{1..12,25..28}`로 축소하고 13..24는 `MEMBER_003`(400)으로 거부한다. 기본값 1, API wire, PATCH 부분 수정·원자성, 공개 프로필 노출 의미는 불변이다. 선택 UI·동기화에서 premium 13..24 자산을 제거한다. 정본=`member-domain-spec.md` v1.1, DB=`erd.md` v2.3/V28. 영향=FC-352~358. |
| v1.31 | 2026-08-22 | **FC-352 Gate 2 사용자 승인 확정.** `GET/PATCH /me`에 `primaryCharacterId`를 가법 추가하고 PATCH를 nickname/character 부분 수정으로 확장한다. 채팅·게시판·쪽지의 당사자 프로필 응답에도 현재 `primaryCharacterId`를 가법 노출한다. 선택 ID 1..28, 기본값 1, 정적 자산 매핑 정본=`member-domain-spec.md` v1.0. DB=`erd.md` v2.2/V28. `ch_*_btn_2_*`는 전면 제외. 영향=FC-353~358. |
| v1.30 | 2026-08-22 | **FC-347 사용자 승인.** wire 변경 없이 로그인 브라우저 탭의 AppShell당 단일 STOMP 연결·구독과 unread client lifecycle을 확정했다. `MESSAGE_CREATED.sentByMe`는 수신 principal 관점이며 송신자 자기 배지는 증가시키지 않는다. MESSAGE_CREATED·본인 READ_UPDATED·REST 전송 성공·재연결에서 `/unread-count`를 서버 권위로 coalesced refetch하고 30초 polling을 fallback으로 유지한다. token 교체·logout·다중 탭·ChatWorkspace 중복 연결 제거 규약 포함. 영향 = FC-348~351. REST/STOMP/event/DB schema·ERD 불변. |
| v1.29 | 2026-08-22 | **G2-CHAT-12 보정안 A 사용자 승인.** `direct/messages` 요청 상대 식별자를 `counterpartNickname`으로 교체한다. 서버 원자 TX가 현재 활성 nickname 소유자를 resolve한 시점의 내부 user ID를 권위로 고정하고 이후 nickname 재조회 금지, 변경·탈퇴 resolve 실패는 전부 rollback `CHAT_002`, 성공 응답 `room.counterpart`가 최종 publicId/nickname을 제공한다. 추가 회원 검색 API 없음. 영향 = FC-342~345·FC-329·FC-324. DB schema·ERD와 event schema 불변. |
| v1.28 | 2026-08-22 | **G2-CHAT-12 권고안 A 사용자 승인.** `POST /api/v1/me/chat-rooms/direct/messages`가 기존 room 재사용 또는 room+첫 message를 원자 커밋하고 생성 전용 `/direct`를 대체한다. client draft·동시 생성·멱등·차단/rate-limit/IDOR, timeline 내부 스크롤, 미캐시 `MESSAGE_CREATED` hydration, local exact Origin 2종을 확정했다. 영향 = FC-342~345·FC-329·FC-324. DB schema·ERD와 STOMP/Redis/Kafka/outbox event schema는 불변. |
| v1.27 | 2026-08-18 | **EPIC-CHAT(FC-316) — G2-CHAT-1~6 권고안 전건 사용자 승인 확정.** **§2.7 채팅 신설**: 1:1 direct room 생성/목록/상세, 방별 sequence 메시지 최신·과거·gap 조회, REST 멱등 전송, 단조 읽음, 차단/해제, 신고, 전체 unread의 REST 10종 + `/ws/chat` STOMP 1.2 user-destination push 계약. 영속 명령/replay는 REST+MySQL 정본, STOMP는 server push only(`SEND` 금지). CONNECT bearer JWT·strict Origin·JWT exp 강제종료·SecurityContext 주체·IDOR 404 통일·IP/user rate limit을 확정했다. **§5 `CHAT_001`~`009` 등재.** 스키마 = erd v2.0(6테이블·V25 예약), 도메인/장애/보존/성능 정본 = `chat-domain-spec.md` v1.0. 직접 기존 티켓 파급 = FC-317(Vuexy 승인 UI가 본 계약 소비), 공용 JWT 검증 결과에 `expiresAt` 가법 노출 및 후속 backend/frontend·CDC·부하 티켓 필요. 기존 auth/auction/bid/settlement/delivery/memo API 형상은 불변(additive). |
| v1.26 | 2026-08-07 | **FC-221 — 댓글·답글 응답에 `ownedByMe: boolean` 가법 추가(게이트2 사용자 승인).** `SecurityContext.userId == comment.authorId`일 때만 `true`; 비로그인·관리자가 작성하지 않은 타인 댓글·tombstone은 `false`. 판정은 닉네임 스냅샷과 무관하므로 닉네임 변경·재사용에도 안정적이며 `authorId`는 외부에 노출하지 않는다. 기존 `editable`(작성자 또는 관리자에게 수정·삭제 UI 허용)과 의미를 분리하고, 자기 댓글 반응은 계속 서버가 `authorId`로 차단해 `COMMENT_003`(422)을 반환한다. **직접 구현 파급 = FC-222(backend)·FC-223(frontend). 기존 완료 티켓 FC-207~FC-212의 댓글 응답 생산·소비 계약에는 가법 파급만 있으며 재개하지 않고 FC-222·FC-223이 흡수한다.** 엔드포인트·요청·스키마·에러코드 무변경. 정본 = `board-domain-spec.md` v1.3 §13.2. |
| v0 | 2026-07-13 | 골격 착수 — 공통 규약 + auth 섹션 |
| v0.1 | 2026-07-13 | 전 섹션 초안 완성 — §3 경매·고정가·입찰, §4 아이템·인벤토리·주문·화폐, §5 에러코드. G3 검수 대기 |
| v0.2 | 2026-07-14 | 보안 게이트 1 findings 반영 — SEC-001·002(충전 confirm 인증·서버검증·pg_tx_id 멱등), SEC-003(자기구매 차단), SEC-004(교환 멱등키), SEC-006(토큰 회전), SEC-007(열거 완화), SEC-009(시간 검증) + item_template 식별자 typeCode 통일(035). 보안 델타 재확인 대기 |
| v1 | 2026-07-14 | G3 확정 — 총괄 검수 + 보안 게이트 1(S-002) + 사용자 승인. 설계 3종 확정, 구현(G4-n) 진입. 이후 변경은 6절 절차 |
| v1.1 | 2026-07-14 | 6절 계약 변경 — §2 /refresh 응답에 refreshToken 추가 + 회전 정책(1회성·재사용 탐지) 명시. 사유: D-070/SEC-006(refresh 회전 구현 정합) |
| v1.2 | 2026-07-14 | 6절 계약 변경 — 등급 필터 제거(D-073), §3.3 목록/상세 응답 스키마 구체화(a안). 사유: 원게임 무등급 + 프론트·QA 단일 진실 |
| v1.3 | 2026-07-14 | 6절 계약 변경 — §1.6 게이트웨이 엣지 오류 응답 명세 추가(429 rate limit·403 직접접근 차단을 서비스 envelope로 통일) + §5 GATEWAY_* 코드. 사유: D-068 엣지 게이트웨이 429 포맷 통일, 총괄 056(안건1 A)·지시 057 |
| v1.4 (메타 정정, 2026-07-14) | — | **내용 무변경·버전 미상향.** 근거 줄 참조 버전 전사 누락 정정(domain-spec v0.3→v0.5, erd v0.2→v0.7). 엔드포인트·스키마·에러코드 무변경이라 6절 대상 아님(총괄 090 승인). 전파 불요 |
| v1.4 | 2026-07-14 | 6절 계약 변경 — §2.5 회원 리소스 신설(GET/PATCH/DELETE `/me`) + §2 제목 "인증·회원" + `MEMBER_001`·`MEMBER_002` §5 등재 + §2 말미 전방 참조 미이행 정정("3절" → §2.5·§4.4). 사유: 회원 프로필·수정·탈퇴 계약 부재(backend/022 발견, 068 승인, 지시 069). 탈퇴 잔액 소멸 동의 = D-080 |
| v1.5 | 2026-07-17 | 6절 계약 변경 — §2.5 GET·PATCH·DELETE `/me` 탈퇴(soft delete) 주체가 만료 전 access로 호출한 경우를 401 `COMMON_005`(세션 무효)로 명시. 미인증·만료 토큰 401과 동일 코드·포맷이라 탈퇴 여부가 응답으로 드러나지 않는다. 사유: 게이트2 승인 — 회원 열거 방지(SEC-007) |
| v1.6 | 2026-07-18 | 6절 계약 변경 — §5에 `ITEM_003`(relocate 대상 아이템이 임시보관 TEMP 상태 아님, 409) 등재 + §4.2 relocate 에러 목록에 반영. 사유: EPIC-ITEM 구현 정합(FC-022 신설 코드, 도메인 enum↔계약 1:1 규약 · 프론트 분기 명확). 총괄 등재 승인 |
| v1.7 | 2026-07-18 | 6절 계약 변경 — EPIC-AUCTION 게이트2(FC-025) 결정 반영: (f) §3.1 등록·§5 `AUCTION_001`을 "403/409" → **403 단일**로 정밀화(미소유·미보유·미존재 통일, enum↔계약 1:1 + SEC-007 열거 방지; "이미 출품중"만 `AUCTION_002` 409). (G6) §3.1 취소 대상 상태를 "ACTIVE만" → **"SCHEDULED\|ACTIVE & 입찰0(highest_bidder_id IS NULL)"**로 정밀화(예약 경매 에스크로 잠김 해소, domain-spec §5 정합). 사유: 게이트2 승인(2026-07-18), auction-domain-spec v0.2 |

| v1.8 | 2026-07-18 | 6절 계약 변경 — EPIC-BID 게이트2(FC-030) 결정 반영: (F2) §3.3에 **`BidSummary` 응답 스키마 등재**(`GET /auctions/{id}/bids`가 "offset 페이지(입찰 이력)"로만 적혀 프론트·QA 단일 진실이 없었다). (F3) §3.3 `AuctionDetail`에 **`minNextBidAmount`** 파생 필드 추가(최소 증분 정책의 클라이언트 복제·드리프트 방지). (F4) §5에 **`BID_007`**(경매 미개시, 409) 신설 + §3.1 입찰 에러 목록 반영(종전 코드 집합으로는 SCHEDULED·미도래 경매 입찰을 표현 불가 — `BID_006`은 "마감/종료됨"). (F5) §3.1 입찰에 **첫 입찰 하한 = `startPrice`** 문언 추가(증분식이 "현재 최고가 + 증분"이라 최고가 부재 시 하한이 미규정이었다). 사유: 게이트2 승인(2026-07-18), bid-domain-spec v0.2 |
| v1.9 | 2026-07-18 | 6절 계약 변경 — §3.3 **공통 item 블록 필드 타입 명세 추가**(필드별 타입·nullable·출처 표). 종전에는 필드명만 나열돼 타입 진술이 없었고, 프론트(FC-036)가 `element` 등 코드 축을 `string`으로 추정하는 드리프트가 발생했다. 실제 서버는 5개 코드 축·`level`·`skillPercent` 전부 **정수**(`AuctionItemView` record `int`, erd `INT` 정합)이며 `skill1`·`skill2`·`goldforceExpireAt`만 nullable이다. 아울러 **`element` 코드값(1=물·2=불 외)은 "미확정"으로 명시**했다 — 시드(V9)에 1·2만 실재하고 3·4는 erd 나열 순서 추정에 불과해 정본에 확정 기재하지 않는다(EPIC-ITEM 시드 확장 시 실측 확정). 사유: 계약 타입 공백 보완(FC-030 후속 spec 정본 보정). **엔드포인트·필드 집합·에러코드 무변경**(기존 구현과 이미 정합, 파급 없음) |
| v1.16 | 2026-07-29 | 6절 계약 변경 — 게이트2(EPIC-OAUTH, FC-152) 승인 반영. 네이버·카카오 소셜 로그인(방식 B — 프론트 주도 + 백엔드 교환). **§2 소셜 로그인 subsection 신설** — `POST /api/v1/auth/oauth/{provider}`(provider ∈ naver\|kakao) 단일 엔드포인트 find-or-create, 요청 `{ code, redirectUri }`(state는 프론트 소유 CSRF·백엔드 미검증이라 요청 바디 제외), 응답 = 기존 `LoginResponse` 형상 그대로(**가입·로그인 모두 200**, 신규/기존 비노출 SEC-007). **§5 `AUTH_006`~`AUTH_008` 등재**(미지원 provider 400·인가코드 교환 실패 401·provider 통신 실패 502). 결정 3건(①로그인·가입 통합 ②이메일 비연결=provider+id가 신원키·소셜 이메일 미저장 ③닉네임 유니크 접미사) 반영. 스키마 = erd v1.5(`user_social_account` 신설·`user.password_hash`·`login_id` nullable화, V19). AUTH_005~008 enum 등록 = 구현 티켓(FC-154). |
| v1.18 | 2026-07-30 | 6절 계약 변경 — EPIC-LOGINID-CHECK(FC-165, 사용자 게이트1 승인 2026-07-30) 반영. **§2 `GET /api/v1/auth/login-id/availability` 신설**(회원가입 아이디 라이브 중복확인용, 닉네임 가용성 v1.17 미러). 인증 불요·permitAll(`/nickname/availability`와 동류 등재), 요청 query `loginId`(형식·길이=signup 규칙 재사용 `@NotBlank`·`@Size(max=50)`), 응답 `{ available: boolean }`(DTO `LoginIdAvailability{Request,Response}`), 판정=`existsByLoginIdAndIsDeletedFalse`(가입 유니크 검사와 단일 경로), advisory·최종 권위는 signup `AUTH_001`(409). **게이트웨이 배선을 계약 DoD 로 명문화** — 이 경로를 엣지 게이트웨이 `auth-rate-limited` `Path=` predicate 에 등재(FC-161 MAJOR-1 재발 방지, backend FC-166 이 코드+게이트웨이 동시 수행). **신규 도메인 에러코드 없음**(형식 위반은 COMMON 검증 400). 응답 형상 불변·스키마 무변경. loginId 는 자격증명이라 열거 민감도가 닉네임보다 높으나 signup `AUTH_001`이 이미 존재를 노출해 새 열거면 없음 — rate limit·응답 최소화 최종 점검 = FC-168(reviewer). 구현 = FC-166(backend)·FC-167(frontend). |
| v1.25 | 2026-08-07 | FC-217 — **BEST 댓글 기능 제거**(사용자 요청). **§6.3에서 `GET /posts/{id}/comments/best` 엔드포인트 절 삭제** + §6.3 제목에서 "BEST" 제거 + §6.5 인가 요약의 `/comments/best` GET permitAll 항목 제거. 백엔드 `CommentController.best`·`CommentService.getBestComments`·`CommentRepository.findBestRootComments`·`BoardCommentBestProperties`·`BestCommentsResponse`·`board.comment.best.*` 설정·BEST 통합테스트 동반 제거. **정렬 순공감순(`sort=LIKES`)은 별개 기능이라 유지**(BEST 고정 랭킹만 폐지). 스키마 무변경(BEST는 컬럼 추가 없음·`like_count`는 반응 기능이 계속 사용). 정본 = `board-domain-spec.md` v1.2 §13. |
| v1.24 | 2026-08-06 | EPIC-COMMENT-V2(FC-206) — 네이버식 댓글 확장. **게이트2 3건 사용자 승인 확정(board-spec §14, 2026-08-06 — (a)A1 답글 1단계+@멘션 · (b)B1 comment_reaction 유저당1행 UK · (c)C1 형상 교체 · 기본 정렬 LATEST · 삭제 tombstone · COMMENT_003).** **§6.3 댓글 절 재작성** — (1) **루트 댓글 목록**(`GET /posts/{id}/comments`)에 `sort` param(`LATEST` 최신순 기본·`OLDEST`·`LIKES` 순공감순) + 응답 `CommentResponse`에 `replyCount`·`likeCount`·`dislikeCount`·`myReaction`(뷰어종속 optional-auth)·`deleted`(tombstone) 가법 + **루트만 반환**(답글 분리); (2) **답글 목록**(`GET /posts/{id}/comments/{commentPublicId}/replies` offset·id asc, `ReplyResponse` = CommentResponse + `mentionedNickname`); (3) **답글 작성**(`POST …/comments/{commentPublicId}/replies`, parentCommentId·mentionedNickname 서버 파생); (4) **반응 토글**(`PUT …/comments/{commentPublicId}/reaction { type: LIKE|DISLIKE }`, 등록·전환·취소 흡수·응답 `{ likeCount, dislikeCount, myReaction }`); (5) **BEST 댓글**(`GET /posts/{id}/comments/best`, 순공감 상위 N·임계). **§5 `COMMENT_003`(자기 댓글 반응 불가, 422) 등재.** 대댓글 = **1단계 저장**(답글의 답글도 루트 귀속·`@멘션` 닉 스냅샷). **삭제 루트 tombstone**(활성 답글 보유 시 마스킹 잔류). **기존 댓글 목록 형상 하위호환 없이 교체**(FC-199/203 방금 배포·외부 소비자 없음·게이트2 (c)). 스키마 = erd v1.9(comment_reaction·comment 확장 V24). 정본 = `board-domain-spec.md` v1.1 §13·§14. 구현 = FC-207~209(backend)·FC-210~212(frontend). |
| v1.23 | 2026-08-06 | EPIC-BOARD(FC-196) — 커스텀 게시판 시스템. **게이트2 3건 사용자 승인 확정(2026-08-06).** **§6 게시판(board·post·comment·image) 신설**(§5 에러코드 표 뒤 가법 — 기존 §1~§5 번호 불변). 게시판 목록(`GET /boards`·`/boards/{slug}`)·게시글 CRUD+커서목록(`/boards/{slug}/posts`)·댓글 CRUD(`/posts/{postPublicId}/comments` offset)·**이미지 업로드(`POST /board-images` multipart, 응답·목록·상세의 `url`=오브젝트 스토리지 presigned GET)**. 인가 = 목록·상세 공개·쓰기 인증+게시판 write_policy(ADMIN_ONLY→ROLE_ADMIN·AUTHENTICATED)·수정삭제 작성자\|admin(IDOR 주체=SecurityContext). **§5 에러코드 표에 `BOARD_001`~`003`·`POST_001`~`002`·`COMMENT_001`~`002`·`IMAGE_001`~`002` 등재.** 스키마 = erd v1.8(`board`·`post`·`comment`·`post_image` 신설 V22·공지 이관 V23). **공지(notice) 흡수** — `/notices/**` 참조구현 API 폐지·notice 도메인 제거·board가 새 참조구현 승계·CLAUDE.md §1 갱신(§6 서두·FC-201). **게이트2 3건 확정**: (a) 이미지 저장 = **오브젝트 스토리지(MinIO 로컬·S3 운영)** + StoragePort(S3 호환)·비공개 버킷 presigned GET 서빙(로컬 디스크·`/raw` 프록시 기각) (b) 공지 흡수·notice 제거·참조구현 승계 (c) 옵션 모델 표준 3축. 정본 `board-domain-spec.md` v1.0. 구현 = FC-197~201(backend)·FC-202~204(frontend). |
| v1.22 | 2026-08-05 | EPIC-ITEM-DELIVERY(FC-185) — **§4.6 게임 아이템 지급·배송 신설**. (a) **구매자 배송 상태 조회(웹 REST)** `GET /me/deliveries`(커서·`status` 필터)·`GET /me/deliveries/{id}`(당사자만) — `recipient=주체` 스코프(IDOR 차단), `DeliverySummary`(status PENDING/CLAIMED/APPLIED/DEFERRED/FAILED·item 요약·itemInstancePublicId), claimToken/claimedAt 미노출. **기존 `/me/inventory`·`/me/orders` 응답 형상 불변**(배송 상태는 신규 엔드포인트에서만·형상 보존). (b) **게임 claim = DB 직접 프로토콜 명세**(웹 REST API 아님 — 통합 스키마 read 통합/write 소유자, memo boundary 선례): claim/apply/ack 조건부 CAS·item_uuid UK exactly-once·boundary 번역은 게임 서버 소속·claim 실이식은 후속 별건. api-contract envelope·에러체계 미편입(비-API 프로토콜 문서화). **§5 `DELIVERY_001`(배송 없음·미존재/비당사자 통일 404) 등재.** 스키마 = erd v1.7(`item_delivery` 신설 V21·`item_instance.location` IN_GAME 확장). **게이트2 형상 3건(delivery-domain-spec §13) 사용자 승인 대상**: (a) location enum 확장 IN_GAME (b) 게임 claim DB 프로토콜 (c) sale_order_id 1:1 UK 양 경로 커버. 정본 `delivery-domain-spec.md` v1.0. 구현 = FC-186~189(backend)·FC-190(frontend). |
| v1.21 | 2026-08-04 | 6절 계약 변경 — EPIC-CARD-SYSTEM T1(FC-179, 게이트2 A 승인 2026-08-04) 반영. **§4.2 인벤토리·임시보관 "요약"(ItemSummaryResponse) 블록에 `skill1Name`·`skill2Name`(string, nullable) 가법 추가.** 출처 `skill_definition.name`, `skill1Code`/`skill2Code`가 null이면 각각 null(마법 카드는 skill1 부재라 skill1Name=null). §3.3 공통 item 블록의 스킬명(v1.14/FC-098)을 요약 블록에도 대칭 적용해 스킬명 단일 원천을 백엔드로 통일한다(프론트 "스킬 #코드" 폴백 제거). **순수 가법** — 기존 필드(`skill1Code`·`skill2Code`·`skillPercent` 등)·JSON 형상·에러코드·엔드포인트 전부 불변, 인벤토리·임시보관 쿼리가 skill_definition 을 이미 fetch join 하고 코드 노출에서 `getSkill1()`을 이미 참조하므로 N+1·추가 조인 없음. 스키마 무변경(DB 마이그레이션 없음). 정본 `card-system-consolidation-proposal-v0.1.md` §4. FE 배선 = T6. |
| v1.20 | 2026-08-01 | EPIC-MEMO(FC-170) — **§2.6 메모/쪽지 신설**(회원 간 쪽지, 게임 `new_sp.user_memo` 계승 네이티브 도메인). 엔드포인트 6종(`POST /me/memos` 발신·`GET /me/memos/received`·`/sent` 커서·`/unread-count`·`GET /me/memos/{id}` 상세+읽음 전이·`DELETE /me/memos/{id}` soft delete), 전건 인증·`/me` 접두·주체 SecurityContext·발신 type=5 서버 고정(시스템 메모 사칭 차단). 당사자만 조회라 상대 닉 **비마스킹**, 레벨·성별 **분해 노출**(게임 패킹 int·28바이트 패딩은 게임 boundary 전용·웹 미노출). **§5 `MEMO_001`~`004` 등재**(수신자 없음 404·메모 없음 404·당사자 아님 403·자기 발신 422). 스키마 = erd v1.6(`user_memo` 신설·V20). **게이트2 4결정 사용자 승인 확정(2026-08-01)**: (a) 레벨·성별 = 메모 스냅샷 2컬럼·현재 기본값 `senderLevel=1`·`senderGender=0`(남) (b) 깔끔 원문 저장 + 게임 boundary에서만 28바이트 패딩 (c) `user_memo` 신규·V20·이름 유지 (d) **발신 = 자유 텍스트 단일 필드 + 게임 boundary 28바이트 자동 줄바꿈(필수)·프론트 미리보기 필수**. 정본 `memo-domain-spec.md` v1.0. 구현 = FC-171(backend)·FC-172(frontend). |
| v1.19 | 2026-07-30 | 6절 계약 변경 — 회원가입 중복확인 필수 게이팅 반영(FC-169, 사용자 결정 2026-07-30). **§2 `nickname/availability`·`login-id/availability` 두 조항의 프론트 제출 동작 문구만 정정** — 종전 "프론트는 `available:true`여도 제출 시 409 처리(제출 비차단 advisory)"를 "프론트는 회원가입 제출 전 아이디·닉네임 **중복확인(available) 완료를 필수 전제로 요구**(미확인·중복·확인 후 값변경 시 제출 차단·재확인 유도), **백엔드 409(`AUTH_001`/`AUTH_002`)는 최종 방어선으로 유지**"로 변경. **엔드포인트 자체는 여전히 advisory**(예약·스냅샷 아님)임은 유지. **엔드포인트 계약(경로·응답·검증·에러코드) 전부 불변** — 프론트 동작 서술만 정정. erd·타 절 무변경. |
| v1.17 | 2026-07-30 | 6절 계약 변경 — EPIC-NICKNAME-UX(FC-160, 사용자 게이트1 승인 2026-07-30) 반영. **§2 `GET /api/v1/auth/nickname/availability` 신설**(회원가입 라이브 중복확인용, 인증 불요·permitAll, 응답 `{ available: boolean }`, 판정=`existsByNicknameAndIsDeletedFalse` 재사용으로 유니크 검사와 단일 경로, advisory·최종 권위는 signup `AUTH_002`). **§2 소셜 최초가입 닉네임 정책 개정** — "provider 표시명 + **항상** 무작위 꼬리표(`_XXXX`)"(종전 "UK 충돌 시에만 접미사"에서 개정, 예 `홍길동_A3F9`). 닉네임 **유니크 제약·중복검사 로직 무변경**(FC-159 결정 B, `nickname_active` UK V4 유지) — 조회 API 추가 + 소셜 부여 방식만 손댐. **신규 도메인 에러코드 없음**(형식 위반은 COMMON 검증 400). 응답 형상 불변. 도메인 규칙 정본 = domain-spec §6.1. 구현 = FC-161(backend)·FC-162(frontend), 열거·rate limit 점검 = FC-163(reviewer). |
| v1.15 | 2026-07-25 | 6절 계약 변경 — 게이트2(EPIC-EMAIL-VERIFY, 8항목) 승인 반영(2026-07-24): **회원가입 이메일 인증 도입.** **§2 signup 요청에 `email` 선택 필드 추가**(`{ loginId, password, nickname, email? }`, `@Email`·≤255, 미제공 시 이메일 없는 계정 생성 — 응답 201 무변경). **§2 이메일 엔드포인트 3종 신설**(모두 인증 필요·주체=SecurityContext·`/me` 접두): `PUT /api/v1/me/email`(이메일 설정/변경, verified 재초기화·pending 코드 폐기)·`POST /api/v1/me/email/verification-request`(6자리 코드 발송, 202)·`POST /api/v1/me/email/verify`(코드 확인, 200). **§2.5 GET·PATCH `/me` 응답에 `emailVerified`(bool)·`emailMasked`(string, nullable) 추가**(3상태 미설정/미인증/인증완료 구분, 이메일 원문 미노출). **§5 `EMAIL_001`~`EMAIL_007` 등재**(코드 불일치·만료·시도초과·쿨다운·이미인증·미설정·이미사용중). 이메일 유니크 = 활성 회원 기준(`email_active` 생성컬럼 UK, NULL 제외 — Flyway V17). 코드 저장 = Redis TTL+SHA-256(정책 만료10분·쿨다운60초·시도5회·6자리). 발송 = 네이버 SMTP 465 SSL(로컬 스킵+로그·운영 fail-fast). 정본 `email-verify-spec.md` v0.1. 구현 = EPIC-EMAIL-VERIFY 하위(backend/frontend). |
| v1.14 | 2026-07-24 | 6절 계약 변경 — 게이트2(FC-110 DoD#3) 승인 반영(2026-07-24): **§4.5 관리자 검색 재색인 엔드포인트 2건 신설** — `POST /api/v1/admin/search/reindex`(비동기 202+jobId, `mode` IN_PLACE\|REBUILD)·`GET /api/v1/admin/search/reindex/{jobId}`(job 상태). 운영 초기색인 수단 부재(부팅 트리거 없음) 해소 + 무중단 blue-green alias 스위치. 인가 = 기존 `ROLE_ADMIN`(신규 모델 없음, `/api/v1/admin/**` 보호 배선). **§5 SEARCH 코드 등재** — `SEARCH_001`(엔진 일시불가 503, 기존 enum 정본화)·`SEARCH_002`(재색인 진행 중 409)·`SEARCH_003`(재색인 job 없음 404). 정본 `search-spec.md` v0.4 §12.5. 구현 = FC-110 하위 backend-impl. **q·relevance(C1~C3)는 무관·PROPOSAL 유지** |
| v1.13 | 2026-07-22 | 6절 계약 변경 — 게이트2(EPIC-PURCHASE, FC-088) 승인 반영: **§3.1 즉시구매 동작 정밀화**(금전=구매자 잔액 직접 차감·홀드 미경유, 진행 최고입찰 홀드 RELEASED+bid OUTBID, 최고입찰자 본인구매 허용, live 종료성 CAS `end_at>now`·result_type=BUYNOW, 요청 본문 없음). **§4.3 SaleOrderResponse 스키마 신설**(BidSummary v1.8 선례) — OrderSummary/OrderDetail 필드 확정 + **역할별 노출 정밀화**(`feeAmount`·`settleAmount` = 판매자 전용, 구매자엔 필드 부재·`finalPrice`만) + IDOR 스코프(`/me/orders`=buyer OR seller, `/orders/{id}`=당사자만) + `myRole`·`counterpartyMasked`(§3.3 마스킹 규약). **§5 AUCTION_006 라벨 확대**("이미 종료" → "처리 불가 상태(종료/즉시구매 시 미개시 포함)", 신규 코드 미추가 — enum↔계약 1:1 유지). **엔드포인트·필드 집합·에러코드 무변경**(즉시구매·orders 엔드포인트 기등재, 신규 필드는 응답 스키마 명세뿐·서버 기존 sale_order 재사용). 스키마 무변경. 사유: 즉시구매+거래내역 확정. 구현 = FC-089(backend)·FC-090(frontend). 정본 `purchase-spec.md` v1.0 |
| v1.12 | 2026-07-21 | 6절 계약 변경 — 게이트2(EPIC-CLOSING 코어, FC-081) 승인 반영: **§3.3 마감·정산 semantic 명확화 주 추가**. 마감(내부 워커) 후 `AuctionDetail.resultType`=`BID`(SOLD)·`status`=영속 SOLD/UNSOLD·`BidSummary.status`=`WON`이 **실제로 채워지기 시작**함을 명시(값의 의미 명확화). 마감은 외부 API 없음 — 클라 마감 후 서버 status 수렴에 워커 tick 지연(짧은 전이 구간). 거래내역 조회(`GET /me/orders`·`/orders/{id}`)는 코어 범위 밖(후속)임을 명기. **엔드포인트·필드 집합·에러코드 무변경**(신규 필드 없이 기존 필드 semantic만 명확화). 사유: 마감·낙찰 정산 코어 확정. 구현 = EPIC-CLOSING FC-082(워커)·083(SOLD)·084(UNSOLD). 정본 closing-domain-spec v1.0 |
| v1.11 | 2026-07-20 | 6절 계약 변경 — 게이트2(EPIC-CLOSING) 승인 반영: **§4.3 주문 상세**에 수수료 근거 주 추가 — 응답 `feeAmount`·`settleAmount`의 계산 근거·구간·최소/상한 정본이 신규 **`fee-policy-spec.md`**(판매자 단독 부담, 게이트2 2026-07-20)임을 각주로 연결하고 `settleAmount = finalPrice − feeAmount` 관계식을 명시. **엔드포인트·필드 집합·에러코드 무변경**(신규 필드 없이 기존 fee/settle의 의미만 명확화). 사유: 수수료 정책 확정의 계약 반영. 구현 소유 = EPIC-CLOSING(백엔드 동결 해제 후) |
| v1.10 | 2026-07-19 | 6절 계약 변경 — 게이트2(FC-044) 승인 반영: **§3.1 아이템 코드 사전 신설**(4축 전 코드값 정본화). 종전 v1.9가 `element`·`kind`·`subGroup`·`mainCategory` 전 축의 코드값을 "미확정"으로 남겨 프론트가 표시명 스냅샷에만 의존했다. 원게임 `new_sp.gameshop` `itm_type` 전수 조회로 4축이 확정됐다 — **(D4)** `element` 1=물·2=불·**3=흙·4=바람**(4경로 교차확증), **(D3)** `kind`는 **`subGroup`에 의존**(WEAPONE/ARM 각 4값, MAGIC **2값뿐**)이라 대분류별 표를 분리하고 `kind` 단독 필터에 다의성 경고를 명기, **(D1·D2)** 원본 코드 체계를 전면 채택하고 `type_code` **자리 의미를 교정**(`mainCategory`=상품군·`subGroup`=무기/방어구/마법). 동반 필수 조항으로 **`item_template` 스코프 = 상품군 1(아이템 카드)**을 명시했다. 사유: 게이트2 승인(2026-07-19), 제안서 `spec/proposals/item-code-dictionary.md` v2. **엔드포인트·필드 집합·에러코드 무변경**(값 사전·서술 보강). ⚠ **V9 시드는 교정 전 코드라 계약과 불일치** — 시드 재작성은 백엔드 동결 해제 후 별도 티켓(제안서 §3.3 대조표가 작업지시서) |

---

## 1. 공통 규약 (B-004~007)

계약 전체에 적용되는 규약. 개별 엔드포인트는 이 규약을 전제로 요청/응답만 기술한다.

### 1.1 URL·버전·식별자 (B-004)
- Base: `/api/v1`. 버전은 URI 경로 버저닝.
- 리소스는 복수형 명사: `/auctions`, `/shops`, `/bids`, `/items`, `/orders`, `/charges`, `/users`.
- 종속 리소스는 1단 중첩까지: `/auctions/{auctionId}/bids`.
- 상태 전이 액션은 동사 URL을 최소화하고 하위 리소스/필드로 표현(불가피할 때만 동사).
- 외부 노출 식별자는 `public_id`(ULID)를 URL·응답에 사용. 내부 `id`(BIGINT)는 노출하지 않는다.

### 1.2 인증·인가 (D-065, B-009)
- 서비스 자체 JWT. `Authorization: Bearer <accessToken>`.
- 사용자 식별은 서버가 토큰을 검증해 SecurityContext에서 얻는다. `X-User-Id` 등 헤더 신뢰 없음.
- 인증 필요 엔드포인트는 각 절 "인증: 필요"로 표기. 미인증 시 401, 권한 부족 시 403.
- 관리자 전용은 "인증: 필요(관리자)".

### 1.3 페이징·정렬·필터 (B-005~007)
- 목록 기본 페이징은 cursor(실시간 목록), 관리·소규모는 offset 예외.
  - cursor 요청: `?cursor=<opaque>&size=<n>`. 응답 `data: { content:[...], nextCursor: "<opaque>|null", hasNext: <bool> }`.
  - offset 요청: `?page=<n>&size=<n>`. 응답 `data: { content:[...], page, size, totalElements, totalPages }`.
- 정렬: `?sort=<field>,<asc|desc>` (다중 허용). 필드는 엔드포인트별 화이트리스트(ERD 인덱스와 1:1, B-006).
- 필터: 명명 파라미터 + 화이트리스트. 범위는 `minXxx`/`maxXxx`, enum 값은 대문자.

### 1.4 응답 envelope (B-007)
- 성공: `{ "success": true, "data": <object|null>, "timestamp": "<ISO-8601 UTC>" }`.
- 에러: `{ "success": false, "code": "<DOMAIN_NNN>", "message": "<사람용>", "errors": [ {field, reason} ]?, "timestamp": "..." }`.
  - `errors`는 검증 실패 시에만 포함.
  - `code`는 도메인 ErrorCode(`{DOMAIN}_{3자리}`), HTTP status는 별도. 공통 예: `COMMON_004 LOCK_ACQUISITION_FAILED` → 409.
- 시간 표기는 ISO-8601 UTC(Instant).

### 1.5 상태 코드 관례
- 200 조회/갱신, 201 생성, 204 본문 없음. 400 검증, 401 미인증, 403 권한, 404 없음, 409 상태 충돌(이미 종료·중복 선점·락 실패), 422 도메인 규칙 위반.

### 1.6 게이트웨이 엣지 오류 (D-068, 057)
엣지 게이트웨이(SCG)가 서비스 도달 전에 반환하는 오류도 서비스와 동일한 에러 envelope(1.4)로 통일한다. 클라이언트가 엣지/서비스 오류를 구분 처리하지 않도록 하기 위함이다(총괄 056 안건1 A).
- 형식: `{ "success": false, "code": "GATEWAY_NNN", "message": "<사람용>", "timestamp": "<ISO-8601 UTC>" }`. `errors`는 미포함(필드 검증 오류는 서비스 전용).
- `code`는 `GATEWAY_` 프리픽스의 엣지 발생 코드로, 도메인 ErrorCode enum과 1:1 대상이 아니다(엣지 예외 — 5절 주석). 게이트웨이가 직접 세팅한다. envelope 포맷 자체는 서비스와 동일하며 변경하지 않는다.
- 엣지 오류 목록:
  - `GATEWAY_429` rate limit 초과(인증 계열 등, SEC-005) → 429. 재시도 대기를 위해 `Retry-After` 헤더를 동반한다.
  - `GATEWAY_403` 게이트웨이 미경유 직접접근 차단(X-Gateway-Token 불일치, 서비스측 GatewayAccessFilter) → 403. 정상 경유 클라이언트는 만나지 않으며, QA·보안의 음성 테스트 기준으로만 명세한다(프론트 별도 처리 불요).

---

## 2. 인증·회원 (auth · member) — D-002 우선

인증 API는 도메인보다 먼저 확정해 프론트에 전달한다. JWT 스켈레톤 기준(HS256, access 만료 CLAUDE.md).

토큰 전략(SEC-006 확정): access는 무상태 JWT(짧은 만료). refresh는 서버 저장(해시된 값)·재발급 시 회전(이전 refresh 폐기)·재사용 탐지 시 해당 세션 무효화. logout은 refresh 무효화 필수. 자금 시스템이라 탈취·로그아웃 대응이 가능한 서버 저장 방식을 채택한다.

요청 제한(SEC-005): 인증 계열(login·signup·refresh)은 엣지 게이트웨이(SCG, D-068)의 rate limit이 담당한다(앱 레벨 rate limit off 유지, CLAUDE.md E2). 계약 무영향.

### POST /api/v1/auth/signup — 회원가입
- 인증: 불요
- 요청(body): `{ loginId, password, nickname, email? }` — `email`은 **선택**(`@Email`·≤255). 미제공(null)이면 이메일 없는 계정을 생성한다. 제공 시 정규화(lowercase+trim)해 `email_verified=false`로 저장하며 **코드를 자동 발송하지 않는다**(인증은 §2 이메일 엔드포인트로 분리 — 가입이 SMTP 장애에 결합되지 않게).
- 응답 201: `{ userPublicId, nickname }` (email·인증상태 미노출)
- 에러: `AUTH_001` 중복 loginId(409), `AUTH_002` 중복 nickname(409), `EMAIL_007` 이메일 이미 사용 중(409, email 제공 시 유니크 위반), 검증 400
- 회원 열거 방지(SEC-007): loginId 존재 여부가 무차별 열거되지 않도록 가입 실패 응답은 구체 사유를 최소화하고, 게이트웨이 rate limit(D-068)로 시도를 제한한다. nickname 중복은 표시용이라 유지. 이메일 유니크(활성 회원 기준, `email_active` 생성컬럼 UK·NULL 제외)는 `AUTH_002` 대비 노출면이 크지 않으며 동일 rate limit로 완화한다.

### GET /api/v1/auth/nickname/availability — 닉네임 가용성 조회 (라이브 중복확인, EPIC-NICKNAME-UX v1.17)

회원가입 폼의 "중복확인" 실동작용 조회다. 입력→가용성 조회→즉시 피드백으로 제출 전 UX를 개선하되, 제출 시 서버 유니크 검사(`AUTH_002`)는 그대로 최종 권위로 유지한다.

- 인증: **불요**(회원가입 중 비로그인 호출). SecurityConfig **permitAll 대상**이다 — `/api/v1/auth/signup`·`/login`·`/refresh`·`/oauth/**`와 동류로 `/api/v1/auth/nickname/availability`를 permitAll 목록에 추가한다(엣지 게이트웨이 X-Gateway-Token 경유는 유지).
- 요청(query): `nickname`(필수) — 검사할 닉네임. 형식·길이 규칙은 signup·`PATCH /me`의 nickname과 **동일**(`@NotBlank`·`@Size(max=30)`, erd `nickname` VARCHAR(30) 정합. 현재 최소길이·정규식 미도입 상태를 그대로 재사용 — 규칙 강화는 signup과 동반 확정할 별건).
- 응답 200: `{ available: boolean }`(DTO 네이밍 `NicknameAvailabilityResponse`, §5 컨벤션). `true`=현재 사용 가능(활성 회원 중 동일 닉네임 없음), `false`=사용 중.
- 판정: 유니크 검사와 **동일 비교를 단일 경로로** 쓴다 — `existsByNicknameAndIsDeletedFalse`(재사용, `nickname_active` UK 기준). 대소문자 민감도 등 비교 의미는 이 컬럼 collation을 그대로 따르며, 가용성 조회와 가입 유니크 검사가 드리프트하지 않게 한다.
- 정규화: 별도 lowercase·trim을 **가하지 않는다**. signup이 닉네임을 원문 그대로 저장·검사하므로 가용성 조회도 동일 원문으로 판정해 조회 결과와 가입 결과의 일관성을 맞춘다(정규화를 도입하려면 signup·PATCH와 동반 개정 — 이 티켓 범위 밖).
- **비보장(advisory)**: `available:true`는 조회 시점 스냅샷일 뿐 **예약이 아니다**. 엔드포인트 자체는 예약·스냅샷 권위를 갖지 않으며(조회~제출 사이 선점 TOCTOU 가능), 최종 권위는 signup의 `AUTH_002`(409)·`PATCH /me`의 `MEMBER_001`(409)이다. **프론트 제출 게이팅(필수 전제, FC-169)**: 프론트는 회원가입 제출 전 닉네임 **중복확인(available) 완료를 필수 전제로 요구**한다 — 미확인·중복(`available:false`)·확인 후 값 변경 시 제출을 차단하고 재확인을 유도한다. 그럼에도 **백엔드 409(`AUTH_002`)는 최종 방어선으로 유지**된다(선점 시 409 처리, §4 프론트 매핑 재사용).
- 에러: 형식·길이 위반 시 **400**(COMMON 검증, `errors[]` 필드 매핑). **신규 도메인 에러코드 없음**.
- 열거 방지(SEC-007): 닉네임은 목록·상세 표시용 **공개값**이고 signup의 `AUTH_002`가 이미 동일한 존재 여부를 노출하므로 이 엔드포인트가 새 열거면을 열지 않는다. 시도 제한은 게이트웨이 rate limit(D-068, auth 계열 동일). 남용·rate limit 정합은 reviewer(FC-163)가 최종 점검한다.

### GET /api/v1/auth/login-id/availability — 아이디(loginId) 가용성 조회 (라이브 중복확인, EPIC-LOGINID-CHECK v1.18)

회원가입 폼의 아이디 "중복확인" 실동작용 조회다. 닉네임 가용성(v1.17)과 **대칭**이며, loginId 는 로그인 자격증명(유일)이라 사전 중복확인 UX 가치가 크다. 입력→가용성 조회→즉시 피드백으로 제출 전 UX 를 개선하되, 제출 시 서버 유니크 검사(`AUTH_001`)는 그대로 최종 권위로 유지한다.

- 인증: **불요**(회원가입 중 비로그인 호출). SecurityConfig **permitAll 대상**이다 — `/api/v1/auth/signup`·`/login`·`/refresh`·`/oauth/**`·`/nickname/availability`와 동류로 `/api/v1/auth/login-id/availability`를 permitAll 목록에 추가한다(엣지 게이트웨이 X-Gateway-Token 경유는 유지).
- **게이트웨이 배선(DoD·필수 — FC-161 MAJOR-1 재발 방지)**: 이 경로를 엣지 게이트웨이 `auth-rate-limited` 라우트의 `Path=` predicate 에 **등재**한다(`backend/gateway/src/main/resources/application.yml`, 현재 `.../nickname/availability` 바로 뒤에 `,/api/v1/auth/login-id/availability` 추가). 미등재 시 auth 계열 rate limit(SEC-005)이 이 경로에 미적용되므로, backend 구현 티켓(FC-166)이 backend 코드와 게이트웨이 predicate 를 **한 티켓에서 동시** 수행한다(닉네임은 배선이 리뷰에서 뒤늦게 잡혔다 — 재발 방지).
- 경로 네이밍: `login-id`(kebab-case). 복합어 세그먼트라 kebab 표기가 §1.1(리소스 명사) 관례에 정합하다. 단수 하위 조회 경로라 복수형 대상이 아니다(`nickname/availability` 선례와 형태 일치).
- 요청(query): `loginId`(필수) — 검사할 아이디. 형식·길이 규칙은 signup 의 loginId 와 **동일**(`@NotBlank`·`@Size(max=50)`, erd `login_id` VARCHAR(50) 정합. 현재 최소길이·정규식 미도입 상태를 그대로 재사용 — 규칙 강화는 signup 과 동반 확정할 별건). DTO 네이밍 `LoginIdAvailabilityRequest`(§5 컨벤션).
- 응답 200: `{ available: boolean }`(DTO 네이밍 `LoginIdAvailabilityResponse`, §5 컨벤션). `true`=현재 사용 가능(활성 회원 중 동일 loginId 없음), `false`=사용 중.
- 판정: 유니크 검사와 **동일 비교를 단일 경로로** 쓴다 — `existsByLoginIdAndIsDeletedFalse`(재사용, signup 이 이미 사용하는 메서드). 대소문자 민감도 등 비교 의미는 `login_id` 컬럼 collation 을 그대로 따르며, 가용성 조회와 가입 유니크 검사가 드리프트하지 않게 한다.
- 정규화: 별도 lowercase·trim 을 **가하지 않는다**. signup 이 loginId 를 원문 그대로 저장·검사하므로 가용성 조회도 동일 원문으로 판정해 조회 결과와 가입 결과의 일관성을 맞춘다(정규화 도입은 signup 동반 개정 — 이 티켓 범위 밖).
- **비보장(advisory)**: `available:true`는 조회 시점 스냅샷일 뿐 **예약이 아니다**. 엔드포인트 자체는 예약·스냅샷 권위를 갖지 않으며(조회~제출 사이 선점 TOCTOU 가능), 최종 권위는 signup 의 `AUTH_001`(409, "이미 사용 중인 로그인 아이디입니다.")다. **프론트 제출 게이팅(필수 전제, FC-169)**: 프론트는 회원가입 제출 전 아이디 **중복확인(available) 완료를 필수 전제로 요구**한다 — 미확인·중복(`available:false`)·확인 후 값 변경 시 제출을 차단하고 재확인을 유도한다. 그럼에도 **백엔드 409(`AUTH_001`)는 최종 방어선으로 유지**된다(선점 시 409 처리).
- 에러: 형식·길이 위반 시 **400**(COMMON 검증, `errors[]` 필드 매핑). **신규 도메인 에러코드 없음**.
- 열거 방지(SEC-007): loginId 는 닉네임(공개 표시값)과 달리 로그인 **자격증명**이라 유효 아이디 열거는 크리덴셜 스터핑 표적화에 유리할 수 있어 민감도가 더 높다. 다만 signup 의 `AUTH_001`(409)이 이미 동일한 loginId 존재 여부를 노출하므로 이 엔드포인트가 **새 열거면을 열지는 않는다**(노출면 순증분 0). 시도 제한은 게이트웨이 rate limit(D-068, auth 계열 동일 — 위 배선 등재가 필수 전제)이 담당하고, 응답은 `available` boolean 단일로 최소화(사유·계정 상세 미노출)한다. 자격증명 성격상 rate limit 실적용·응답 최소화를 reviewer(FC-168)가 **최종 점검**한다(닉네임 대비 강화 점검 포인트).

### 이메일 인증 (EPIC-EMAIL-VERIFY, v1.15) — 정본 `email-verify-spec.md` v0.1

이메일은 가입 시 선택이며, 아래 3종으로 설정·인증한다. **모두 인증 필요**이고 주체는 SecurityContext(userId)다 — 임의 이메일을 파라미터로 받지 않아(자기 계정 이메일만) 이메일 열거면이 열리지 않는다(SEC-007). `/me` 접두는 인증 주체 리소스 규약(§4)에 정합하며 `/api/v1/me/**`는 이미 인증 강제라 별도 배선이 없다.

#### PUT /api/v1/me/email — 이메일 설정/변경
- 인증: 필요
- 요청(body): `{ email }`(`@Email`·≤255, 정규화)
- 동작: `email` 저장 + **`email_verified=false` 재초기화** + pending 인증 코드·쿨다운 폐기(이메일 변경 TOCTOU 방어). **동일 이메일 재제출은 no-op**(인증 상태 유지).
- 응답 200: `{ email, emailVerified: false }` — 호출자가 방금 제출한 정규화 값 에코(열거면 아님). GET /me의 원문 미노출과 의도적 구분.
- 에러: `EMAIL_007` 이미 사용 중(409), 검증 400, 401

#### POST /api/v1/me/email/verification-request — 인증 코드 발송
- 인증: 필요. 요청 body 없음(계정 이메일 사용)
- 응답: **202 Accepted**(본문 없음) — 발송 성공이 이메일 유효성을 확증하지 않음
- 동작: 6자리 코드 생성 → Redis(SHA-256 해시·TTL 10분) 저장 → SMTP 발송 → 쿨다운(60초) 세팅
- 에러: `EMAIL_004` 재전송 쿨다운(429), `EMAIL_005` 이미 인증됨(409), `EMAIL_006` 이메일 미설정(409), 401

#### POST /api/v1/me/email/verify — 인증 코드 확인
- 인증: 필요. 요청(body): `{ code }`(6자리 숫자 `@Pattern("\\d{6}")`)
- 응답 200: `{ emailVerified: true }`
- 동작: Redis 코드 대조(상수시간·시도 5회 상한) → 성공 시 `email_verified=true` 커밋 + 코드 키 삭제
- 에러: `EMAIL_001` 코드 불일치(422), `EMAIL_002` 만료·미발송 통일(422), `EMAIL_003` 시도 초과·코드 폐기(429), `EMAIL_005` 이미 인증됨(409), 검증 400, 401

### POST /api/v1/auth/login — 로그인
- 인증: 불요
- 요청(body): `{ loginId, password }`
- 응답 200: `{ accessToken, refreshToken, accessExpiresAt }`
- 에러: `AUTH_003` 자격 불일치(401)

### POST /api/v1/auth/refresh — 액세스 토큰 재발급
- 인증: 불요(refreshToken으로 검증)
- 요청(body): `{ refreshToken }`
- 응답 200: `{ accessToken, refreshToken, accessExpiresAt }` (회전된 신규 refreshToken 포함)
- 회전(SEC-006, D-070): 재발급마다 이전 refreshToken을 폐기(1회성 회전)하고 신규 refreshToken을 발급한다. 폐기된 토큰 재사용이 탐지되면 해당 refresh 세션을 무효화한다.
- 에러: `AUTH_004` refresh 만료·무효·재사용(401)

### POST /api/v1/auth/logout — 로그아웃
- 인증: 필요
- 동작: refreshToken 무효화(서버 저장분 폐기 필수, SEC-006). 응답 204

### 소셜 로그인 (OAuth) — 방식 B(프론트 주도 + 백엔드 교환) (EPIC-OAUTH, v1.16)

스키마 정본 = erd §4.1 `user_social_account`·`user` nullable 델타. 게이트2 승인(2026-07-29).

라이브 활성화·브라우저 state·환경변수·provider callback·관측성·롤백 정본 = `oauth-live-hardening-spec.md` v1.0(FC-397, v1.35). **본 절의 API·신원·JWT·스키마 형상은 불변**이다.

네이버·카카오 소셜 로그인. 프론트가 provider 인가 페이지로 리다이렉트해 `code`를 받고, 백엔드가 그 `code`로 토큰 교환·프로필 조회·find-or-create 후 **기존 `/login`과 동일한 JWT를 발급**한다(스테이틀리스 JWT·게이트웨이·`RefreshTokenStore.issue(userId)`를 그대로 재사용 — provider 무관 userId 기반). provider 리다이렉트 복귀지는 백엔드가 아니라 **프론트 `/oauth/callback`**이다. 콜백 API는 `/login`처럼 permitAll이며 엣지 게이트웨이(X-Gateway-Token, D-068)를 경유한다.

신원 모델(결정, 2026-07-29): 신원 키는 **`provider + provider_user_id`**다. 소셜 프로필의 이메일은 **신원이 아니라 프로필 데이터**이며, 같은 이메일의 기존 비밀번호 계정에 **자동 연결하지 않는다**(결정 2). 로그인·가입은 **단일 엔드포인트가 find-or-create**로 통합한다(결정 1) — 최초 호출=자동가입, 이후=로그인(단일 동작).

#### POST /api/v1/auth/oauth/{provider} — 소셜 로그인·가입(통합)
- 인증: 불요(콜백 API, `/login` 동류)
- 경로: `{provider}` ∈ `naver` | `kakao`. 그 외 값은 `AUTH_006`(400).
- 요청(body): `{ code, redirectUri }`
  - `code`(string, 필수): provider가 프론트 `/oauth/callback`으로 넘긴 1회용 인가 코드.
  - `redirectUri`(string, 필수): 프론트가 인가 요청에 사용한 redirect_uri. provider 토큰 교환의 redirect_uri **일치 요건** 충족용. 백엔드는 **서버 설정 화이트리스트**(provider별 env)와 대조해 불일치·형식오류 시 400(검증) — open redirect·토큰 탈취 방어.
  - `state`(CSRF)는 **프론트 소유**다 — 프론트가 생성·세션 보관하고 콜백 복귀 시 대조한다(불일치면 백엔드를 호출하지 않고 중단). 스테이틀리스 백엔드는 자신이 만들지 않은 state를 권위 있게 검증할 수 없어(세션 부재) **요청 바디에 두지 않는다**(게이트2 확정 2026-07-29 — state 요청필드·에러코드 없음).
    - v1.35 보강: pending은 `provider+state+issuedAt+returnPath`로 `sessionStorage`에 저장하고 **5분 TTL**로 일회 소비한다. `returnPath`는 same-origin 내부 상대 경로만 허용하며 무효 시 `/`로 폴백한다. 마지막 인가 시도 하나만 유효하다. 상세 검증 순서와 금지값은 `oauth-live-hardening-spec.md` §3을 따른다.
- 동작(단일 TX): (1) `code`+`redirectUri`+서버 보관 client_id/secret으로 provider **토큰 교환** → (2) **userinfo** 조회로 `provider_user_id`(+표시명 등 프로필) 획득 → (3) `user_social_account(provider, provider_user_id)` 조회 — **있으면** 해당 user 로그인, **없으면** user(+ `user_balance`(0,0,0), signup과 동일 흐름) · `user_social_account` 생성(자동가입) → (4) 기존 `TokenProvider` + `RefreshTokenStore.issue(userId)`로 발급.
- 응답 200: `{ accessToken, refreshToken, accessExpiresAt }` — **기존 `LoginResponse` 형상 그대로**(형상 보존). **가입·로그인 모두 200**(201 미사용) — 신규/기존 여부가 상태코드로 드러나지 않게 통일(SEC-007 열거 방지).
- 신규 가입 시 계정 채움: `password_hash`=NULL·`login_id`=NULL(소셜 전용 — 비밀번호 로그인 불가) · `email`=NULL(소셜 이메일 미저장, 결정 2) · `nickname`=provider 표시명 스템 + **항상** 무작위 꼬리표(아래) · `is_admin`=false · `public_id`=ULID.
- 닉네임 부여(결정 3 → EPIC-NICKNAME-UX v1.17 개정): provider 표시명을 스템으로 정규화(트림·꼬리표 여유분 절단)한 뒤 **항상 무작위 꼬리표(`_XXXX`, 4자 영숫자)를 붙인다**(예: `홍길동_A3F9`). 종전 "`nickname_active` UK 충돌 시에만 접미사"에서 **항상 부여**로 개정한다 — 소셜 표시명은 흔해 충돌·사칭 소지가 크므로 최초가입부터 유일 핸들을 부여한다. 꼬리표 부착 후에도 UK 충돌 시 새 꼬리표로 재시도(최대 N회, 초과 시 스템 재생성). 표시명이 비었으면 대체 기본값(예: `user`)에서 시작. 부여 후 회원은 §2.5 `PATCH /me`로 변경 가능. **응답 형상 불변**(닉네임은 기존대로 `LoginResponse`에 미노출). 유니크 제약·중복검사 로직은 무변경(FC-159 결정 B). 도메인 규칙 정본 = domain-spec §6.1.
- 이메일(결정 2): 소셜 프로필 이메일은 **`user.email`에 저장하지 않는다**(NULL 유지). `user.email`은 회원이 §2 `PUT /me/email`로 직접 설정·인증하는 자기 소유 채널로만 채워진다 → `email_active` UK(활성 유니크, EMAIL_007)와 소셜 가입이 **충돌하지 않는다**.
- 에러: `AUTH_006` 미지원 provider(400) · `AUTH_007` 인가 코드 교환 실패(무효·만료·재사용, 401) · `AUTH_008` provider 통신 실패(토큰 교환·userinfo 조회 중 provider 오류·타임아웃, 502) · `redirectUri` 화이트리스트 위반·형식오류(400 검증)
- 열거 방지(SEC-007): 성공은 신규·기존 불문 200·동일 형상이라 소셜 계정 존재 여부가 응답으로 드러나지 않는다. 시도 제한은 게이트웨이 rate limit(D-068, login·signup 계열과 동일). provider 비밀정보(client secret 등)는 환경변수(`${OAUTH_<PROVIDER>_*}`, 운영 fail-fast)로 두고 프론트에 미노출한다. provider 호출은 풀링 RestClient(FC-151 커넥션 누수 교훈) — 구현 세부(FC-153/154).
- v1.35 범위 고정: PKCE·계정 연결/해제·이메일 자동연결·HttpOnly token cookie는 포함하지 않는다. provider 콘솔 callback, 프론트 `VITE_OAUTH_REDIRECT_URI`, 백엔드 `OAUTH_REDIRECT_URI`는 exact match이며 키 실값은 환경변수로만 주입한다. 스키마·Flyway 변경은 없다.

### 2.5 회원 리소스 (member) — 069, v1.4

계정 생애주기 중 가입·인증은 위 2절이 담당하고, 이 절은 나머지(프로필 조회·수정·탈퇴)를 규정한다. **잔액 조회는 화폐 관심사라 §4.4 `GET /me/balance`에 두며 여기서 중복 명세하지 않는다.** 도메인 규칙 근거는 domain-spec §6.1.

주(v1.4 정정): v1.3까지 이 자리에 있던 "user 리소스 엔드포인트는 3절(후속)에서 기술"은 **전방 참조 미이행**이었다(§3은 경매·고정가·입찰). 본 절이 그 참조를 이행한다 — 프로필·수정·탈퇴는 §2.5, 잔액은 §4.4.

주(v1.5, 게이트2): 아래 세 엔드포인트(GET·PATCH·DELETE `/me`)는 인증 필요이며, 토큰은 유효하나 주체가 탈퇴(soft delete)된 계정이 만료 전 access로 호출한 경우 **401 `COMMON_005`**(세션 무효)로 응답한다. 미인증·만료 토큰 401과 **동일 코드·포맷**이라 탈퇴 여부가 응답으로 드러나지 않는다(회원 열거 방지, SEC-007). 세 엔드포인트 공통이므로 각 "에러:" 줄에서 반복하지 않는다.

#### GET /api/v1/me — 내 프로필 조회
- 인증: 필요
- 응답 200: `{ userPublicId, nickname, primaryCharacterId, isAdmin, createdAt, emailVerified, emailMasked? }`
- `primaryCharacterId`: integer 허용 집합 `{1..12,25..28}`. 기본값 1. 프로필 자산 매핑 정본은 `member-domain-spec.md` §3이며 URL/파일명은 API가 반환하지 않는다.
- 노출 범위: `loginId`·`passwordHash`는 응답에 싣지 않는다(노출 이득 없음, 열거 리스크 SEC-007). `isAdmin`은 관리자 UI 노출 제어용으로 포함하되 **인가는 서버 권위**다(§1.2 — 클라 플래그는 표시 제어일 뿐).
- 이메일(v1.15, EPIC-EMAIL-VERIFY): `emailVerified`(bool)와 `emailMasked`(string, nullable — 예 `a***@naver.com`)로 노출한다. **이메일 원문은 싣지 않는다**(마스킹만). `emailMasked=null`이면 이메일 미설정, non-null이면 설정됨 — `emailVerified`와 조합해 프론트가 **미설정 / 설정·미인증 / 인증완료** 3상태를 구분한다. 이메일 설정·인증은 §2 이메일 엔드포인트(`PUT /me/email`·`.../verification-request`·`.../verify`).
- 타인 프로필 조회(`/users/{publicId}`)는 **범위 밖**이다. 목록·상세의 소유자·최고입찰자 마스킹(§3.3)과 상충하고 회원 열거 노출면(SEC-007)을 넓힌다(domain-spec §6.1).
- 에러: 401(미인증)

#### PATCH /api/v1/me — 프로필 부분 수정
- 인증: 필요
- 요청(body): `{ nickname?, primaryCharacterId? }`. 최소 한 필드는 제공해야 하며 누락 필드는 유지한다. 명시적 `null`, 빈 body, 알 수 없는 필드는 400이다. `nickname`은 기존 검증, `primaryCharacterId`는 integer 허용 집합 `{1..12,25..28}`이며 13..24도 유효하지 않다. 비밀번호 변경은 범위 밖이고 이메일은 `PUT /me/email`로 분리한다.
- 두 필드를 함께 제공하면 단일 트랜잭션으로 원자 변경한다. 닉네임 중복 등 한 필드가 실패하면 어느 필드도 적용하지 않는다.
- 응답 200: `{ userPublicId, nickname, primaryCharacterId, isAdmin, createdAt, emailVerified, emailMasked? }` (조회와 동일 스키마)
- 변경 빈도 제한 없음(domain-spec §6.1)
- 에러: `MEMBER_001` 닉네임 중복(409), `MEMBER_003` 기본 캐릭터 범위 위반(400), 검증 400, 401(미인증)

#### DELETE /api/v1/me — 탈퇴 (soft delete)
- 인증: 필요
- 요청(body): `{ balanceForfeitAcknowledged: true }` — 잔존 잔액 소멸·복구 불가에 대한 **명시 동의**(D-080). 미동의·누락 시 400. 잔액이 0이어도 필드는 필수다(클라 분기 제거·감사 추적 일관성).
- 응답 204
- 동작: soft delete + **refresh 세션 전부 폐기**(SEC-006 — 탈퇴 후 잔여 세션으로 접근 불가). 잔존 캐시·게임머니는 소멸하며 복구되지 않는다(D-080, 환불·역환전은 범위 밖).
- 차단 조건: 진행 중 경매(판매자)·홀드 보유 입찰·미완료 주문이 하나라도 있으면 `MEMBER_002`(409). 잔액 잔존은 **차단 사유가 아니다**(D-080).
- 재가입: login_id·nickname 재사용 허용(domain-spec §6.1, erd 1절 soft delete UK 규약)
- 에러: `MEMBER_002` 진행 중 거래 보유(409), 400(동의 누락), 401(미인증)

### 2.6 메모/쪽지 (memo) — EPIC-MEMO, v1.20(게이트2 확정 2026-08-01)

회원 간 메모(쪽지). 게임 인게임 쪽지와 **동일 데이터**를 공유하는 finalcall 네이티브 도메인이다(통합 스키마·단일 정본). 게임 클라 고정 계약(28바이트 고정폭 렌더·`레벨×100+성별` 패킹·`char(16)` 닉네임)은 **게임 boundary 포맷터**로 흡수하고, 아래 웹 API는 **분해된 깔끔한 필드**를 노출한다(패킹 int·패딩 문자열 미노출). 도메인 규칙 정본 = `memo-domain-spec.md` v1.0. **게이트2 4결정(memo-domain-spec §11)은 2026-08-01 사용자 승인으로 확정됐고 아래에 반영됐다.**

전 엔드포인트 **인증 필요**, 주체 = SecurityContext, `/me` 접두(§2.5 회원 리소스 규약과 정합 — IDOR 설계 차단). 발신은 `memo_type`을 서버가 **5(USER)로 고정**한다(클라가 임의 type으로 시스템 메모 0/14를 사칭 불가). 발신자는 요청 바디가 아니라 토큰 주체로만 취한다.

메모는 **당사자(발신자·수신자)만** 조회하므로 상대 닉네임을 **마스킹하지 않고 원문 노출**한다(비당사자 마스킹 §3.3과 성격이 다르다 — 대화 상대를 알아야 함). `senderLevel`·`senderGender`는 분해된 값으로 노출(게임 패킹 int는 boundary 전용).

#### POST /api/v1/me/memos — 발신
- 인증: 필요(발신자 = 주체)
- 요청(body): `{ receiverNickname, body }` — `receiverNickname`(`@NotBlank`·≤16, 활성 회원 닉네임)·`body`(`@NotBlank`, **자유 텍스트 단일 필드**, 폭 검증 memo-domain-spec §8.3 **≤112바이트**(`getStringByte` metric: 한글 2·영문숫자 1)). `type`·발신자 필드는 요청에 없다(서버 고정). **본문은 사용자가 수동 개행 없이 자유롭게 입력**하며, 게임 표시용 28바이트 자동 줄바꿈은 게임 boundary가 수행한다(웹 저장은 순수 원문 — 게이트2 (d) 확정, memo-domain-spec §8.3). 프론트 작성 화면은 28바이트 줄바꿈 미리보기를 제공(FC-172).
- 동작: `receiverNickname`을 활성 회원(`existsByNicknameAndIsDeletedFalse` 재사용)으로 조회해 `receiver_id`로 정규화, `sender_id`=주체, `memo_type`=5, 닉·레벨·성별 스냅샷 저장. **레벨·성별 소스(게이트2 (a) 확정) = 현재 기본값 `senderLevel=1`·`senderGender=0`(남)** — user에 게임 레벨·성별 필드가 아직 없어 기본값을 채운다(향후 user 게임필드 도입 시 실값 교체). 저장은 분해 컬럼, 게임 boundary가 `레벨×100+성별` 재합성.
- 응답 201: `{ memoPublicId, createdAt }`
- 에러: `MEMO_001` 수신자 없음(404), `MEMO_004` 자기 발신 불가(422), 검증 400, 401

#### GET /api/v1/me/memos/received — 받은함(커서)
- 인증: 필요. 요청(query): `?cursor=<opaque>&size=<n>`(§1.3 cursor)
- 응답 200: `CursorResponse<MemoSummary>` — `receiver_id=주체 AND is_deleted=false`, `id desc` 정렬. `MemoSummary` = `{ memoPublicId, type, senderNickname, senderPrimaryCharacterId, senderLevel, senderGender, bodyPreview, isRead, createdAt }`(목록은 본문 미리보기 `bodyPreview`). `senderPrimaryCharacterId`는 현재 활성 발신 회원의 값이며 삭제 회원이면 null이다.
- 에러: 401

#### GET /api/v1/me/memos/sent — 보낸함(커서)
- 인증: 필요. 요청(query): `?cursor=&size=`
- 응답 200: `CursorResponse<MemoSummary>` — `sender_id=주체 AND is_deleted=false`, `id desc`. 보낸함 `MemoSummary`는 상대가 수신자이므로 `receiverNickname`, `receiverPrimaryCharacterId`를 싣는다(sender 필드 자리에 receiver 노출). 삭제 회원의 character ID는 null이다.
- 에러: 401

#### GET /api/v1/me/memos/unread-count — 미열람 개수
- 인증: 필요
- 응답 200: `{ count }` — `receiver_id=주체 AND is_deleted=false AND is_read=false` 카운트(뱃지용).
- 에러: 401

#### GET /api/v1/me/memos/{memoPublicId} — 상세 열람(+읽음 전이)
- 인증: 필요. 당사자(sender_id 또는 receiver_id=주체)만.
- 동작: **호출자가 수신자이고 미열람이면** `is_read=true`·`read_at=now`로 1회 전이(보낸함 열람은 전이 없음).
- 응답 200: `MemoResponse` = `{ memoPublicId, type, senderNickname, senderPrimaryCharacterId?, senderLevel, senderGender, receiverNickname, receiverPrimaryCharacterId?, body, isRead, readAt?, createdAt }`. character ID는 현재 회원값이며 해당 회원 삭제 시 null이다.
- 에러: `MEMO_002` 메모 없음(404), `MEMO_003` 당사자 아님(403), 401. (열거 민감 시 타인 메모를 404로 통일할지 reviewer FC-173 확인 — 초안 404/403 구분)

#### DELETE /api/v1/me/memos/{memoPublicId} — 삭제(soft)
- 인증: 필요. 당사자만.
- 동작: soft delete(`is_deleted=true`·`deleted_at=now`). **게임 `memo_del` 단일 플래그 계승** — 한쪽 삭제가 양쪽 박스에서 사라진다(당사자별 개별 삭제는 범위 밖, memo-domain-spec §4.2).
- 응답 204
- 에러: `MEMO_002` 메모 없음(404), `MEMO_003` 당사자 아님(403), 401

### 2.7 1:1 채팅 (chat) — EPIC-CHAT, v1.29(G2-CHAT-12 보정안 A 승인 확정 2026-08-22)

> **APPROVED — G2-CHAT-12 사용자 승인(2026-08-22).** 기존
> `POST /api/v1/me/chat-rooms/direct` 생성 전용 계약을 아래 원자 명령으로 대체한다.

#### POST /api/v1/me/chat-rooms/direct/messages — direct room + 첫 메시지 원자 전송

- 요청(body): `ChatDirectMessageSendRequest = { counterpartNickname, clientMessageId, body }`.
  - `counterpartNickname`: 현재 활성 상대 회원 nickname, `@NotBlank`, 최대 30자. 별도 회원 검색 API나
    `memberPublicId` 직접 입력 UX는 제공하지 않는다.
  - `clientMessageId`, `body`: 기존 `ChatMessageSendRequest`와 동일한 UUID v4·NFC·길이·control 문자 규칙.
- 동작: `SecurityContext` 주체와 상대 쌍의 기존 room이 있으면 재사용하고, 없으면 room·양측 member state를
  만든다. 같은 TX에서 첫/새 message, 발신자 read 위치, metadata-only outbox까지 커밋한다. 어느 하나라도
  실패하면 전부 rollback되어 상대 목록에 room이 나타나지 않는다.
- 상대 resolve: 같은 원자 TX에서 현재 활성 `counterpartNickname` 소유자를 resolve한 시점의 내부 user ID가
  권위다. 이후 nickname으로 다시 조회하거나 인가하지 않는다. nickname 변경·탈퇴로 resolve하지 못하면
  room/member state/message/outbox를 모두 rollback하고 `CHAT_002`를 반환한다. 성공 응답의
  `room.counterpart`가 서버가 확정한 최종 `memberPublicId`와 nickname을 제공한다.
- 동시성: 사용자 쌍 unique constraint 충돌/deadlock loser는 bounded 전체-TX retry 후 승자 room을
  `FOR UPDATE`한다. 반대 방향 동시 첫 send는 한 room의 연속 sequence로 직렬화된다. Redis lock은 사용하지
  않는다.
- 멱등: 최종 `(room,sender,clientMessageId)`가 권위다. 같은 정규화 본문 재시도는 원 room/message를 200과
  `deduplicated=true`로 반환하고, 다른 본문은 `CHAT_004`다. 보장 기간은 기존 180일이다.
- 응답: 신규 message `201`, dedup `200`.
  `ChatDirectMessageSendResponse = { room: ChatRoomResponse, message: ChatMessageResponse,
  roomCreated: boolean, deduplicated: boolean }`.
- 에러: `CHAT_002` 상대 없음/비활성(404), `CHAT_003` 자기대화(422), `CHAT_004` 멱등 키 본문 충돌(409),
  `CHAT_005` 대화 불가(409), `CHAT_009` rate limit(429), 검증 400, 401.
- rate limit: 기존 message IP/user 제한을 항상 적용하고, 실제 신규 room 생성 시 기존 방 생성 20/시간도
  적용한다. 경쟁 중 기존 room 재사용으로 수렴한 요청에는 방 생성 quota를 중복 소비시키지 않는다.
- 첫 커밋의 기존 `MESSAGE_CREATED` event가 상대에게 신규 room 신호가 된다. 별도 event type/version/schema는
  추가하지 않으며 미캐시 client는 room detail REST hydration 후 목록에 삽입한다.
- 기존 생성 전용 `POST /api/v1/me/chat-rooms/direct`는 v1.28에서 제거한다. 상대 선택은 서버 호출 없는
  client draft이고, 실패 시 같은 `clientMessageId`와 본문을 유지해 재시도한다.

외부 REST 계약은 breaking 변경이나 DB schema·ERD, 기존 room message REST, STOMP/Redis/Kafka/outbox event
schema는 불변이다. local WebSocket Origin은 `localhost:5173`과 `127.0.0.1:5173` exact 두 값만 허용하며
dev/prod strict exact allowlist·gateway token·CONNECT bearer 정책은 완화하지 않는다.

사용자 간 1:1 텍스트 채팅. **REST+MySQL이 영속 명령·조회·replay 정본**이고 STOMP/WebSocket은
server→client best-effort push 전용이다. Redis Pub/Sub·Kafka·STOMP 전달 실패는 성공한 DB 메시지를
취소하지 않으며 클라이언트는 방별 `roomSequence`로 gap을 복구한다. 도메인/장애/보존/성능 정본 =
`chat-domain-spec.md` v1.8, 스키마 = `erd.md` §4.6(v2.0).

전 REST 엔드포인트 **인증 필요**, 주체 = `SecurityContext`. sender/reporter/reader user ID를 요청으로 받지
않는다. 미존재 room과 비참여 room은 모두 `CHAT_001` 404로 통일하고 내부 BIGINT ID는 노출하지 않는다.

#### POST /api/v1/me/chat-rooms/direct — 제거됨(v1.28)

생성 전용 endpoint와 `ChatDirectRoomCreateRequest`는 G2-CHAT-12 승인으로 제거됐다. 상대 선택·패널 진입은
서버 호출 없는 client draft이며, 최초 영속 명령은 위 `/api/v1/me/chat-rooms/direct/messages`만 사용한다.

#### GET /api/v1/me/chat-rooms — 내 방 목록

- 요청(query): `?cursor=<opaque>&size=<n>`, 기본 20·최대 100.
- 정렬: `(lastActivityAt DESC, 내부 room id DESC)` 안정 keyset. cursor는 versioned
  `(lastActivityAt,id)` Base64URL 문자열이며 손상 시 `COMMON_001` 400.
- 응답 200: `CursorResponse<ChatRoomResponse, String>`.
- 에러: 401.

#### GET /api/v1/me/chat-rooms/unread-count — 전체 unread

- 응답 200: `{ count: long }` — 모든 참여 room의 `lastSequence-lastReadSequence` 합.
- 에러: 401.

#### GET /api/v1/me/chat-rooms/{roomPublicId} — 방 상세

- 응답 200: `ChatRoomResponse` — 현재 차단/상대 활성 상태를 다시 읽는 권위 응답.
- 에러: `CHAT_001`(404), 401.

`ChatRoomResponse`:

```json
{
  "roomPublicId": "01K...",
  "counterpart": {
    "memberPublicId": "01K...",
    "nickname": "판매자닉네임",
    "primaryCharacterId": 25
  },
  "lastMessage": {
    "messagePublicId": "01K...",
    "roomSequence": 42,
    "senderNickname": "구매자닉네임",
    "bodyPreview": "안녕하세요",
    "createdAt": "2026-08-18T10:00:00Z"
  },
  "lastSequence": 42,
  "lastReadSequence": 40,
  "counterpartLastReadSequence": 38,
  "unreadCount": 2,
  "blockedByMe": false,
  "canSend": true,
  "createdAt": "2026-08-17T10:00:00Z",
  "lastActivityAt": "2026-08-18T10:00:00Z"
}
```

- `lastMessage`는 메시지가 없거나 180일 보존 만료로 남은 행이 없으면 `null`, `bodyPreview`는 최대
  80 code point다.
- `lastReadSequence`는 현재 주체, `counterpartLastReadSequence`는 상대의 단조 읽음 위치다. 후자의
  sequence 이하인 내가 보낸 메시지는 상대가 읽은 것으로 표시할 수 있다.
- `blockedByMe`는 본인이 만든 차단 해제 UI용이다. `canSend=false`는 어느 방향 차단·상대 비활성 등을
  합친 값이며 상대가 나를 차단했는지 별도 사유로 노출하지 않는다.
- 탈퇴한 상대 nickname은 `탈퇴한 사용자`, `canSend=false`로 반환한다.
- 탈퇴한 상대 `primaryCharacterId`는 null이다. 활성 상대는 현재값 `{1..12,25..28}` 중 하나를 반환한다.

#### GET /api/v1/me/chat-rooms/{roomPublicId}/messages — 메시지 최신/과거/gap 조회

- 요청(query), 기본 50·최대 100:
  - `?beforeSequence=<long>&size=`: 해당 sequence 미포함, 더 오래된 메시지.
  - `?afterSequence=<long>&size=`: 해당 sequence 미포함, 재접속 gap/새 메시지.
  - 둘 다 없으면 최신 메시지. 둘을 동시에 보내면 `COMMON_001` 400.
- 응답 200: `CursorResponse<ChatMessageResponse, Long>`. 어떤 모드든 `roomSequence ASC`.
- 채팅은 순서 복구가 공개 계약이므로 공통 opaque cursor의 가법적 예외로 숫자 sequence를 쓴다.
  최신/과거의 `nextCursor`는 반환된 최소 sequence, gap 조회는 최대 sequence다.
- 에러: `CHAT_001`(404), 검증 400, 401.

`ChatMessageResponse`:

```json
{
  "messagePublicId": "01K...",
  "clientMessageId": "c96278a5-f102-4b76-a09d-4dfe30caa243",
  "roomSequence": 42,
  "sender": {
    "memberPublicId": "01K...",
    "nickname": "구매자닉네임",
    "primaryCharacterId": 2
  },
  "body": "안녕하세요",
  "sentByMe": true,
  "createdAt": "2026-08-18T10:00:00Z"
}
```

#### POST /api/v1/me/chat-rooms/{roomPublicId}/messages — 메시지 전송

- 요청(body): `ChatMessageSendRequest = { clientMessageId, body }`.
  - `clientMessageId`: canonical UUID v4 문자열(36자), 발신 client가 생성한다.
  - `body`: NFC 정규화 후 `@NotBlank`, 최대 1,000 code point와 UTF-8 4,000 byte를 모두 만족.
    NUL 및 `\n`·`\t` 이외 C0 control 문자를 허용하지 않는다. HTML/Markdown은 해석하지 않는다.
- 동작: room row를 `FOR UPDATE`, 참여자·차단을 검증하고 `roomSequence=lastSequence+1`로 저장한다.
  발신자의 읽음도 새 sequence까지 전진한다. 같은 TX에 metadata-only outbox를 쓴다.
- 멱등: `(room,sender,clientMessageId)` 같은 본문 재시도는 원 메시지를 `200`과
  `deduplicated=true`로 반환한다. 다른 본문 재사용은 `CHAT_004`. 최초 저장은 `201`.
- 응답 data: `ChatMessageSendResponse = { message: ChatMessageResponse, deduplicated }`.
- 에러: `CHAT_001`(404), `CHAT_004`(409), `CHAT_005`(409), `CHAT_009`(429), 검증 400, 401.

#### PUT /api/v1/me/chat-rooms/{roomPublicId}/read — 읽음 위치 갱신

- 요청(body): `ChatReadUpdateRequest = { throughSequence: long }`, 0 이상.
- 동작: `lastReadSequence=max(current,throughSequence)` 단조 갱신. 실제 전진할 때만 `readAt`과
  `READ_UPDATED` event를 갱신한다. `throughSequence > room.lastSequence`는 거절한다.
- 응답 200: `ChatReadResponse = { lastReadSequence, readAt }`.
- 에러: `CHAT_001`(404), `CHAT_006`(422), 검증 400, 401.

#### PUT /api/v1/me/chat-rooms/{roomPublicId}/block — 상대 차단

- 동작: room 상대에 대한 방향성 차단을 멱등 생성. 어느 방향의 차단이든 양쪽 신규 전송을 막고 기존
  history/신고 접근은 유지한다. send/block은 같은 room row를 먼저 잠근다.
- 응답 204.
- 에러: `CHAT_001`(404), 401.

#### DELETE /api/v1/me/chat-rooms/{roomPublicId}/block — 내 차단 해제

- 동작: 본인이 만든 방향성 차단만 멱등 삭제한다. 상대 방향 차단이 남으면 `canSend=false`다.
- 응답 204.
- 에러: `CHAT_001`(404), 401.

#### POST /api/v1/me/chat-rooms/{roomPublicId}/reports — 상대 메시지 신고

- 요청(body): `ChatReportCreateRequest = { messagePublicId, reason, detail? }`.
  - `reason`: `SPAM` | `ABUSE` | `FRAUD` | `OTHER`.
  - `detail`: 최대 500자.
- 동작: 같은 room에서 상대가 보낸 메시지만 신고 가능. 당시 본문·발신 nickname snapshot을 보존하며
  일반 메시지 purge 뒤에도 증거를 3년 유지한다. 자동 삭제/정지는 하지 않는다.
- 응답 201: `ChatReportResponse = { reportPublicId, createdAt }`.
- 에러: `CHAT_001`(404), `CHAT_007`(422), `CHAT_008`(409), `CHAT_009`(429), 검증 400, 401.

#### 2.7.1 WebSocket/STOMP 실시간 계약

- 외부 WebSocket endpoint: `GET /ws/chat` HTTP Upgrade. gateway `ws://` 전용 route를 경유하고
  `X-Gateway-Token` 검증을 유지한다.
- handshake query/cookie에 JWT를 넣지 않는다. 브라우저는 연결 후 5초 안에 STOMP 1.2 `CONNECT`를 보낸다.

```text
accept-version:1.2
heart-beat:10000,10000
Authorization:Bearer <access-token>
```

- JWT `ChannelInterceptor`가 공용 `TokenProvider`로 검증해 `Principal=userId`를 설정하고 message 인가보다
  먼저 실행된다. Origin은 운영 frontend exact allowlist다.
- 서버는 검증된 JWT `exp`에 socket을 강제 종료한다. refresh 후 새 access token으로 재연결해야 한다.
  logout은 frontend가 즉시 disconnect하며 별도 장기 chat session은 없다.
- `SUBSCRIBE /user/queue/chat.events` 하나만 허용한다. `SEND`, room topic, 임의 user destination,
  `ACK/NACK`, transaction frame은 거절한다. subscription ack는 `auto`다.
- heartbeat 10초/10초, 30초 무응답 종료. application frame 최대 8KiB, transport buffer 16KiB,
  session send buffer 512KiB·send time limit 10초. 느린 client는 끊고 REST replay로 복구한다.

`ChatEventResponse`:

```json
{
  "eventId": "01K...",
  "eventType": "MESSAGE_CREATED",
  "eventVersion": 1,
  "occurredAt": "2026-08-18T10:00:00Z",
  "roomPublicId": "01K...",
  "payload": {
    "message": {
      "messagePublicId": "01K...",
      "clientMessageId": "c96278a5-f102-4b76-a09d-4dfe30caa243",
      "roomSequence": 42,
      "sender": { "memberPublicId": "01K...", "nickname": "구매자닉네임" },
      "body": "안녕하세요",
      "sentByMe": false,
      "createdAt": "2026-08-18T10:00:00Z"
    }
  }
}
```

| eventType | recipient | payload |
|---|---|---|
| `MESSAGE_CREATED` | 두 참여자의 모든 활성 session | recipient 관점 `ChatMessageResponse` |
| `READ_UPDATED` | 두 참여자의 모든 활성 session | `{ readerMemberPublicId, throughSequence, readAt }` |
| `BLOCK_CHANGED` | 두 참여자의 모든 활성 session | `{ changedAt }`; room detail query invalidate 지시 |

Kafka/outbox/Redis에는 원문을 넣지 않고 local app node가 DB 정본을 읽어 TLS STOMP frame을 만든다.
STOMP event는 at-most-once UI 갱신 신호이며 성공/영속 ACK가 아니다.

#### 2.7.2 재접속·순서·rate limit

- 순서 권위는 `roomSequence`뿐이다. event 중복은 `eventId`, 메시지 중복은
  `(roomPublicId,roomSequence)`/`messagePublicId`로 제거한다.
- 연결 순서: 방 목록 동기화 → STOMP subscribe → 각 방 `afterSequence` gap 조회. subscribe 전후 race도
  이 gap 조회로 닫는다. 재연결은 full-jitter 1·2·4·8·16초, 최대 30초 backoff.
- REST 전송 재시도는 같은 `clientMessageId`를 사용한다. 멱등 보장 기간은 메시지 보존과 같은 180일.
- rate limit 확정값: handshake IP 10/분 burst 5, STOMP CONNECT user 20/분, 메시지 IP 120/분,
  메시지 user 5/초 burst 10·60/분, 방 생성 20/시간, 신고 10/일, user 활성 socket 최대 3개.
- 서비스 Redis limiter 장애는 gateway IP 제한을 남기고 fail-open한다. REST `CHAT_009`는 `Retry-After`,
  STOMP quota 초과는 가능한 경우 같은 code body 후 close 1008.
- CONNECT 인증 실패는 기존 `COMMON_005` 401-shaped STOMP `ERROR`를 보낼 수 있으면 보낸 뒤 close 1008.
  ERROR frame 수신 자체는 보장하지 않는다.

#### 2.7.3 클라이언트 연결 생명주기와 unread 수렴

- 로그인한 브라우저 탭의 AppShell당 `ChatRealtimeClient`와 `/user/queue/chat.events` 구독은 하나다.
  `ChatWorkspace`는 이를 공유하며 mount 시 별도 연결하지 않는다. 탭 간 socket 공유는 하지 않는다.
- `MESSAGE_CREATED.payload.message.sentByMe`는 event 수신 principal 관점이다. 송신자에게는 `true`, 상대
  수신자에게는 `false`이며 client가 nickname이나 현재 route로 방향을 다시 추론하지 않는다.
- `MESSAGE_CREATED`, 본인의 `READ_UPDATED`, REST 메시지 전송 성공, 최초 연결·재연결·online/focus 복귀는
  `GET /api/v1/me/chat-rooms/unread-count`를 invalidate/refetch하는 계기다. count의 최종 권위는 이 REST
  응답이며 event payload나 로컬 `+1/-1`이 아니다. 상대의 `READ_UPDATED`는 전역 unread를 바꾸지 않는다.
- 같은 unread query의 동시 refetch는 하나로 합치고 진행 중 새 사건은 완료 후 최대 한 번 추가 조회한다.
  기존 30초 polling은 event 유실·socket 장애 fallback으로 유지한다.
- access token 교체 시 이전 socket을 종료하고 새 token으로 재연결한다. logout·세션 폐기·사용자 변경은 socket과
  채팅 cache를 즉시 제거하며 이전 session callback을 무시한다. REST unread 실패는 마지막 성공값을 유지하고
  다음 event·focus·reconnect·poll에서 복구한다.

이 절은 client lifecycle clarification이며 endpoint, request/response JSON, `ChatEventResponse` v1,
Redis/Kafka/outbox payload, DB schema를 변경하지 않는다. 상세 실패·성능 계약은 chat-domain-spec §10.1.2다.

---

## 3. 경매·고정가·입찰

공통 목록 필터(경매·고정가·아이템 검색 공유, ERD 인덱스·§7.7 정합): `mainCategory, subGroup, element, kind, minLevel/maxLevel, skill1/skill2(스킬 코드), goldforceActive(bool), minPrice/maxPrice, status`. (등급 필터 없음 — D-073) **4개 코드 축의 값·의미는 §3.3.1**이며, `kind`는 `subGroup`에 의존해 단독 사용 시 다의적이다(§4.1 경고 동일 적용). 정렬 화이트리스트: `price, endAt, createdAt, highestBidAmount`(경매), `price, endAt, createdAt`(고정가). 목록은 cursor 기본.

> **⚠ PROPOSAL — EPIC-SEARCH(FC-106), 게이트2 미승인 (2026-07-22). 승인 전까지 확정 아님.** 정본 = `search-spec.md` v0.3 §12. 방식 B(전용 검색엔진 Elasticsearch, 게이트2 승인 2026-07-22) ②단계. 아래는 공통 목록 필터에 자유문 검색 `q` + `relevance` 정렬을 **추가**하는 델타다(**`GET /auctions`·`GET /shops` 두 엔드포인트 파급**, item-templates 제외). 스키마·에러코드·기존 필드 무변경(additive).
> - **C1 — `q` 자유문 파라미터 신설**: `q`(string, optional). 매칭 대상 = item `nameSnapshot`(주) + `specSnapshot`(선택). 코드 축 필터와 **AND 결합**(q=텍스트 매칭, 코드축=정확 필터). 결과는 기존대로 **cursor 페이지**(§1.3). 공유 필터라 두 목록 엔드포인트에 일괄 적용되나 **item-templates(§4.1)에는 이번 범위 밖으로 미추가**.
> - **C2 — 정렬 화이트리스트에 `relevance` 추가**(경매·고정가 공통): `relevance`는 **`q`가 있을 때만 유효**하다. 기본 정렬 = (q 있고 sort 생략 → **`relevance`**), (q 없고 sort 생략 → 기존 **`createdAt desc`**). **q 없이 `sort=relevance` → 400(COMMON 검증)** 추천(대안=무시·기본정렬 폴백, 게이트2 택일). relevance cursor는 `search_after(_score desc, publicId asc)` 안정 타이브레이커.
> - **C3 — `q` 규약(§1.3 필터 규약 동반)**: 최소 길이 **2**(미만 400 COMMON 추천), 최대 **64**(초과 400). **이스케이프 불요** — 서버는 `match`/`multi_match`(분석 쿼리)만 쓰고 `query_string` DSL을 쓰지 않아 사용자 입력이 질의 문법으로 해석되지 않는다(인젝션 원천 차단). **빈 결과 = 200 빈 페이지**(에러 아님).
> - **정합성**: Elasticsearch = 파생 read-model(정본 아님), 정확성은 MySQL(SoT)·domain-spec §8. `price·status·highestBidAmount`는 지연 반영 파생 사본이며 입찰검증·정산·낙찰 판정은 DB를 읽는다(search-spec §12.8). **등급 부스트(sellerGrade)는 범위 밖**(EPIC-GRADE 의존).
> - 승인 시 반영: 버전 로그 "게이트2(EPIC-SEARCH) 승인 — §3 공통 목록 필터에 `q`(자유문)·정렬 `relevance` 추가(GET /auctions·/shops, item-templates 제외), q 규약(최소2·최대64·match만·빈결과 200). 스키마·에러코드 무변경. 정본 search-spec v0.2. 구현 FC-107(backend)·FC-108(frontend)." + q없는 relevance·q 길이위반의 400 vs 무시 최종 택.

### 3.1 경매 (auction)

POST /api/v1/auctions — 경매 등록
- 인증: 필요(판매자 = 등록자)
- 요청(body): `{ itemInstancePublicId, startPrice, buyNowPrice?, startAt?, endAt, softCloseWindowSec?, softCloseExtendSec?, maxEndAt }`
- 동작: 아이템을 인벤토리→출품 에스크로(location LISTED)로 CAS 이동(중복 출품 차단). SCHEDULED(startAt 있으면)/ACTIVE로 생성.
- 서버 검증(SEC-009): `endAt > now`, `startAt ≤ endAt`(startAt 있으면), `maxEndAt ≥ endAt`, `softCloseWindowSec·softCloseExtendSec`는 양수·상한 이내. 위반 시 422.
- 응답 201: `{ auctionPublicId, status, endAt }`
- 에러: `AUCTION_001` 아이템 미소유·미보유·미존재(403), `AUCTION_002` 이미 출품중(409), `AUCTION_003` buyNowPrice ≤ startPrice(422), `AUCTION_008` 시간 파라미터 위반(422)
  - 주(v1.7, EPIC-AUCTION 게이트2): `AUCTION_001`은 **403 단일**이다. 미소유(not-owner)·미보유(소유하나 인벤토리에 없음, 예: TEMP)·미존재(item-not-found)를 403으로 통일한다 — 도메인 ErrorCode enum ↔ 계약 1:1(§5) 준수 + 소유·보유 여부가 403/409 차이로 누설되지 않게(SEC-007 열거 방지). "이미 출품중"(LISTED 상태 충돌)만 `AUCTION_002` 409로 분리한다(상태 충돌 노출은 무해).

GET /api/v1/auctions — 경매 목록
- 인증: 불요
- 쿼리: 공통 목록 필터 + 페이징(cursor)/정렬
- 응답 200: cursor 페이지(`content`: 경매 요약 + item 표시 스냅샷)

GET /api/v1/auctions/{auctionPublicId} — 경매 상세
- 인증: 불요
- 응답 200: 경매 상세 + 현재 최고가·최고입찰자(마스킹)·남은 시간 + item 스냅샷
- 에러: `AUCTION_004` 없음(404)

POST /api/v1/auctions/{auctionPublicId}/bids — 입찰 (bid)
- 인증: 필요
- 요청(body): `{ amount }`
- 동작: 경매 단위 직렬화(D-008). 검증 통과 시 게임머니 홀드(에스크로), 직전 최고입찰자 홀드 즉시 해제(P-008), 소프트클로즈 연장 판단(동일 단위). 최고가 갱신.
- 입찰 하한(v1.8, F5): **첫 입찰(현재 최고가 없음)은 `amount ≥ startPrice`**, 후속 입찰은 `amount ≥ 현재 최고가 + 구간 증분`(계단식, domain-spec §4 — 서버 설정값). 미달 시 `BID_001`. 최소 증분 정책을 클라이언트가 복제하지 않도록 다음 최소 입찰가는 상세 응답 `minNextBidAmount`(§3.3)로 제공한다.
- 응답 201: `{ bidPublicId, amount, currentHighestAmount, endAt }`
  - `endAt`은 **소프트클로즈 연장이 반영된** 마감 시각이다(연장이 없으면 기존 값).
- 에러: `BID_001` 최소 증분 미달·첫 입찰 시작가 미달(422), `BID_002` buyNowPrice 이상(422), `BID_003` 자기 경매 입찰(403), `BID_004` 연속(현재 최고가 보유자) 입찰(409), `BID_005` 게임머니 잔액 부족(422), `BID_006` 마감/종료됨(409), `BID_007` 경매 미개시(409), `AUCTION_004` 경매 없음(404)
  - 주(v1.8, EPIC-BID 게이트2 F4): 예약 경매가 아직 시작 전(status=SCHEDULED이고 `startAt > now`)인 경우는 **`BID_007`(409)** 이다. `BID_006`("마감/종료됨")과 분리하는 이유는 (1) 도메인 ErrorCode enum ↔ 계약 1:1(§5) 준수, (2) "아직 시작 안 함"과 "이미 끝남"은 클라이언트 안내 문구·재시도 가능성이 정반대이기 때문이다(`ITEM_003` 신설 선례 동류). 경매 상태는 공개 상세로 이미 노출되므로 코드 분리에 따른 열거 리스크는 없다.

GET /api/v1/auctions/{auctionPublicId}/bids — 입찰 내역
- 인증: 불요(입찰자 식별은 마스킹)
- 쿼리: offset 페이징(`?page=&size=`, §1.3 "관리·소규모는 offset 예외" — 경매당 입찰 수는 소규모). 기본 정렬 `amount desc`(입찰 금액이 단조 증가하므로 최신순과 동일)
- 응답 200: offset 페이지(`content`: **`BidSummary`** — §3.3)
- 에러: `AUCTION_004` 경매 없음(404)

POST /api/v1/auctions/{auctionPublicId}/purchase — 즉시구매(buyNow)
- 인증: 필요
- 동작: 종료성 CAS 단일 승자(SOLD, resultType=BUYNOW). Order 생성·정산·소유 이전 단일 TX(D-053).
- 규칙(SEC-003): 판매자 본인 구매 금지(입찰 BID_003 대칭, wash trade 방지).
- 응답 201: `{ orderPublicId, finalPrice }`
- 에러: `AUCTION_005` 즉시구매 미설정(422), `AUCTION_006` 이미 종료(409), `AUCTION_009` 판매자 자기구매(403), `BID_005` 잔액 부족(422)

> **EPIC-PURCHASE 게이트2 승인 반영 (v1.13, 2026-07-22).** 정본 = `purchase-spec.md` v1.0. 위 즉시구매 엔드포인트·에러는 이미 등재돼 있고, 아래는 그 **동작 정밀화**다(신규 엔드포인트·필드 없음).
> - **금전 모델(A1)**: 구매자는 `buyNowPrice`를 **잔액 직접 차감**(available-gated, 홀드 미경유)한다. 요청 본문 없음(금액은 서버가 `buy_now_price`로 확정, 클라 금액 신뢰 없음). 진행 중 최고 입찰자가 있으면 그 홀드를 즉시 **해제(RELEASED)**하고 입찰을 **OUTBID**로 강등한다(낙찰 실패). 최고 입찰자 본인의 즉시구매도 허용(A2).
> - **동시성(A4)**: 입찰·마감과 **동일 auction 행 배타 락**으로 직렬화. 종료성 CAS는 `status IN(SCHEDULED,ACTIVE) AND end_at > now`(**live** — 마감 워커의 `end_at<=now`와 시간축 배타 분할)로 SOLD·`result_type=BUYNOW` 단일 승자 전이.
> - **미개시 처리(A5)**: SCHEDULED이고 startAt 미도래인 경매의 즉시구매는 구매 불가다. `AUCTION_006` 라벨을 "이미 종료" → **"구매 불가(미개시·종료)"**로 확대 적용한다(신규 코드 미추가, §5 반영).
> - `finalPrice = buyNowPrice`. `AUCTION_009`는 판매자 자기구매(SEC-003, 입찰 BID_003 대칭), `BID_005`는 가용 게임머니 부족.

POST /api/v1/auctions/{auctionPublicId}/cancel — 판매자 취소
- 인증: 필요(판매자 본인). 관리자 강제 취소는 별도 관리자 API(4절).
- 동작: 입찰 0건 & (SCHEDULED | ACTIVE)일 때만 CANCELLED. 아이템 에스크로 해제(인벤토리 복귀, 만실 시 임시보관).
  - 주(v1.7, EPIC-AUCTION 게이트2): 취소 대상 상태를 **SCHEDULED|ACTIVE**로 정밀화한다(종전 "ACTIVE만" → 예약 경매의 에스크로가 startAt 도달 전까지 묶이는 문제 해소, domain-spec §5 "SCHEDULED|ACTIVE→CANCELLED" 정합). "입찰 0건" 판정은 `highest_bidder_id IS NULL` 앵커(입찰=EPIC-BID). 종료 상태(SOLD/UNSOLD/CANCELLED)면 `AUCTION_006`.
- 응답 200: `{ status }`
- 에러: `AUCTION_007` 입찰 존재로 취소 불가(409), `AUCTION_006` 이미 종료(409)

### 3.2 고정가 (shop)

POST /api/v1/shops — 고정가 등록
- 인증: 필요(판매자)
- 요청(body): `{ itemInstancePublicId, price, endAt? }`
- 동작: 아이템 출품 에스크로(LISTED) CAS 이동. ACTIVE 생성.
- 응답 201: `{ shopPublicId, status }`
- 에러: `SHOP_001` 아이템 미소유·미보유(403/409), `SHOP_002` 이미 출품중(409)

GET /api/v1/shops — 고정가 목록
- 인증: 불요
- 쿼리: 공통 목록 필터 + 페이징(cursor)/정렬
- 응답 200: cursor 페이지

GET /api/v1/shops/{shopPublicId} — 고정가 상세
- 인증: 불요
- 응답 200: 상세 + item 스냅샷 / 에러 `SHOP_003` 없음(404)

POST /api/v1/shops/{shopPublicId}/purchase — 구매
- 인증: 필요
- 동작: 원자적 선점 CAS 단일 승자(SOLD). Order 생성·정산·소유 이전 단일 TX(D-053).
- 규칙(SEC-003): 판매자 본인 구매 금지(wash trade 방지).
- 응답 201: `{ orderPublicId, finalPrice }`
- 에러: `SHOP_004` 이미 판매/종료(409), `SHOP_005` 게임머니 잔액 부족(422), `SHOP_006` 판매자 자기구매(403)

POST /api/v1/shops/{shopPublicId}/cancel — 판매자 취소
- 인증: 필요(판매자 본인)
- 동작: ACTIVE(미판매)일 때 CANCELLED. 아이템 에스크로 해제(인벤토리 복귀, 만실 시 임시보관).
- 응답 200: `{ status }` / 에러 `SHOP_004` 이미 종료(409)

GET /api/v1/home/shop-recommendations — 홈 오늘의 추천 마켓 (EPIC-HOME-MARKET-RECOMMEND / FC-408)
- **게이트2 H1~H5 사용자 승인 확정(2026-08-31).** 상세 정본 = `shop-spec.md` §12.
- 인증: 불요(로그인과 무관한 공개·비개인화 추천)
- 요청 query/body: 없음
- 응답 200(data): `{ items: [{ reason, shop }], calculatedAt }`
  - `items`: 서버 표시 순서의 0~6건. `shop`은 기존 `ShopSummary` 형상 그대로.
  - `reason`: `NEW | ENDING_SOON | TRUSTED_SELLER | GENERAL`.
  - `calculatedAt`: ISO-8601 UTC. ACTIVE·미만료·임계를 후보군 전체에 판정한 단일 서버 기준시각.
- 공통 자격: `ACTIVE AND (endAt IS NULL OR endAt > calculatedAt)`. 쿼터는 신규 3(`createdAt desc,id desc`) + 24시간 내 마감 임박 2(`endAt asc,id asc`) + 완료 판매 5회 이상 판매자 1(`sellerCompletedSales desc,createdAt desc,id desc`). 동일 shop 중복 금지.
- 다양성: 동일 판매자 최대 1건·동일 item template 최대 2건. 부족하면 최신 미선택 ACTIVE를 `GENERAL`로 보충하면서 (1) 제한 유지 → (2) 템플릿 제한 완화 → (3) 판매자 제한 완화하며, 후보 부족은 6건 미만을 허용한다. 사실 임계 미충족 매물에 `ENDING_SOON`·`TRUSTED_SELLER`를 붙이지 않는다.
- 오류: 결과 없음은 200 + `items=[]`. 신규 도메인 에러코드 없음; 공통 서버 오류 외피만 적용.
- 성능/캐시 경계: 후보별 판매 건수 N+1 금지(기존 `sale_order(seller_id)` 배치 집계). 마감은 `ix_shop_status_end_at`, 신규/GENERAL은 성능 후속 승인 인덱스 `ix_shop_status_created_at_id(status,created_at,id)`를 사용한다. 검증 판매자 쿼리와 무캐시는 유지하며 ACTIVE 2만·10만 재측정 후 read model/cache를 별도 게이트2로 상신한다.
- gateway rate limit: 클라이언트 IP 기준 기본 `replenishRate=1`·`burstCapacity=10`·`requestedTokens=1`. `HOME_RECOMMEND_RATE_LIMIT_REPLENISH_RATE`·`HOME_RECOMMEND_RATE_LIMIT_BURST_CAPACITY`·`HOME_RECOMMEND_RATE_LIMIT_REQUESTED_TOKENS` 환경변수를 `gateway.home-recommend-rate-limit` validated properties로 바인딩한다. 세 값은 모두 양수이고 `burstCapacity >= replenishRate`여야 하며 위반 시 gateway 부팅 실패, silent clamp 없음이다. 전용 GET route는 일반 service route보다 선행하며 기존 `TrustedProxyClientIpKeyResolver`를 재사용한다.
- 한도 초과: 기존 엣지 오류 계약 429 `GATEWAY_429` + `Retry-After`. SCG 기본 `RedisRateLimiter`의 Redis 장애 응답은 `allowed=true, remaining=-1`이므로, 홈 추천 route 전용 `FailClosedRedisRateLimiter`가 이 오류 응답만 deny로 변환해 429와 하류 호출 0건을 보장한다. 정상 허용·토큰 소진 결과는 그대로 보존한다. Redis는 추천 선정이나 구매 성공의 정확성 수단이 아니며 Redis 장애가 성공 응답을 잘못된 추천으로 바꾸지는 않는다.
- 홈 `Retry-After`: `ceil(requestedTokens / replenishRate)`초를 long 안전 계산한다. 기본 requested=1/replenish=1은 1초, 비기본 3/2는 2초다. 홈 전용 fail-closed composition과 다른 route의 기존 limiter 응답은 분리한다.
- **게이트2 확정 내용**: H1 전용 공개 API, H2 reason+calculatedAt 포함, H3 24시간·5회 임계, H4 다양성 및 템플릿→판매자 순 완화. H5는 1차 무캐시·무인덱스 실측 후 **성능 후속 A안**으로 최신 후보 인덱스 1개 추가·검증 쿼리/무캐시 유지가 확정됐다. H6는 전용 gateway IP rate limit과 Redis 장애 fail-closed 처리로 확정됐으며, 구체 수단은 홈 route 전용 `FailClosedRedisRateLimiter`다.

> **⚠ PROPOSAL — EPIC-SHOP(FC-092), 게이트2 미승인 (2026-07-22). 승인 전까지 확정 아님.** 정본 = `shop-spec.md` v1.0. 위 §3.2 엔드포인트·§5 SHOP_001~006은 이미 등재돼 있고, 아래는 그 **동작 정밀화**다(신규 엔드포인트·필드·스키마 없음).
> - **등록(`POST /shops`)**: body `{ itemInstancePublicId, price }` — **기한 입력 필드 없음.** `price > 0`. 서버가 등록 시점에 `end_at = now + 설정 일수`로 **자동 계산**한다(판매자는 기한을 고르지 않는다, 게이트2 정정 2026-07-22). 설정 일수 = 단일 관리자 값 `@ConfigurationProperties` `shop.listing.default-duration-days`(기본 7일, 하드코딩 금지·향후 DB 이관 여지). **기한 범위·판매자 지정·최대값 없음.** 응답에는 계산된 `endAt`을 노출한다(ShopSummary/ShopDetail §3.3). 무기한(end_at NULL)은 스키마만 nullable로 남겨둔 향후 "무기한 노출 캐시아이템"용이며 이 에픽 등록 경로로는 만들지 않는다(shop-spec §3.1).
> - **`SHOP_001` = 403 단일**(현행 "403/409" 정밀화): 미소유·미보유(TEMP)·미존재를 403으로 통일(AUCTION_001 v1.7 선례, SEC-007 열거 방지). "이미 출품중"(LISTED 충돌)만 `SHOP_002` 409.
> - **구매(`POST /shops/{id}/purchase`)**: **요청 본문 없음**(금액은 서버가 `shop.price`로 확정 — 클라 금액 신뢰 없음). `finalPrice = shop.price`. 구매자 잔액 직접 차감(홀드 미경유, 입찰·홀드 개념 부재). shop 행 배타 락 + 종료성 CAS(`status='ACTIVE' AND (end_at IS NULL OR end_at > now)`, live)로 단일 승자 — 만료 워커(`end_at<=now`)와 시간축 배타 분할. `AUCTION_009` 대칭으로 `SHOP_006` 자기구매 403.
> - **`SHOP_004` 라벨 확대**: "이미 판매/종료" = SOLD·**EXPIRED**·CANCELLED(구매·취소 공통). 기한 만료분 포함.
> - **만료(내부 워커)**: end_at 지난 ACTIVE 리스팅을 워커가 EXPIRED로 전이하고 아이템을 판매자 **임시보관함(TEMP)으로 자동 회수**(소유자 불변, shop-spec §4.4). 외부 API 없음.
> - **거래내역(§4.3) 무변경**: 고정가 SOLD는 기존 `sale_order`로 핸드오프되어 `GET /me/orders`(`sourceType=SHOP` 필터)·`GET /orders/{id}`에 **자동 유입**한다(서버 `source_type` 제네릭). 역할별 노출(feeAmount·settleAmount 판매자 전용)·IDOR 스코프·SaleOrderResponse 스키마 그대로(purchase-spec §5). 신규 필드 없음.
> - 승인 시 반영: 버전 로그 v1.14 "게이트2(EPIC-SHOP) 승인 — §3.2 동작 정밀화, §5 SHOP_001 403 단일·SHOP_004 EXPIRED. 엔드포인트·필드·스키마 무변경. 정본 shop-spec v1.0."

GET /api/v1/me/shops — 내 판매 목록 (PROPOSAL, EPIC-SHOP-MANAGE / FC-103)
- 인증: 필요(판매자=SecurityContext 주체)
- 쿼리: `status`(ACTIVE|SOLD|EXPIRED|CANCELLED|ALL, 생략=ACTIVE), 페이징(cursor)/정렬(`createdAt|price|endAt`)
- 응답 200: cursor 페이지(content = MyShopSummary — ShopSummary + 판매자 전용 `estimatedFee`·`estimatedSettle`)

> **⚠ PROPOSAL — EPIC-SHOP-MANAGE(FC-103), 게이트2 미승인 (2026-07-22). 승인 전까지 확정 아님.** 정본 = `shop-spec.md` §10. **신규 = 조회 엔드포인트 `GET /me/shops` 1개**(취소는 기존 `POST /shops/{id}/cancel` 재사용, FC-093 완료). 스키마·에러코드·기존 엔드포인트 무변경(additive read).
> - **엔드포인트 형태 = `GET /me/shops`**(대안 `GET /shops?mine=true` 배제). `me` 접두 = 인증 주체 리소스 규약(§4 서두)에 정합 — `/me/orders`·`/me/inventory`·`/me/temp-storage`·`/me/balance`와 동형. 판매자는 **SecurityContext 주체**로 도출하며 요청 파라미터로 seller 를 받지 않는다(IDOR 원천 차단, B-009). 공개 브라우즈 `GET /shops`(인증 불요)와 인증 스코프를 엔드포인트 단위로 분리해 캐싱·보안 모델을 단순화한다.
> - **판매자 스코프**: `seller_id = me` 로 좁힌 뒤 상태 필터를 적용. 인덱스 `ix_shop_seller_status (seller_id, status)`(V15 실재) 커버.
> - **상태 필터**: `status` 생략 = **ACTIVE 기본**(진행 중 리스팅 조회가 1차 용도). 명시 시 해당 영속 상태만(SOLD·EXPIRED·CANCELLED 이력 조회 허용). **`ALL` = 전 상태**(판매 이력 전체 탭) — API 레벨 센티널이며 컨트롤러가 "상태 predicate 없음"으로 매핑한다(enum ShopStatus 는 DB 4값 그대로 유지, 오염 없음). 공개 `GET /shops`의 status 규약(null→ACTIVE)과 semantic 정합, `ALL` 만 my-shops 전용 확장.
> - **페이징·정렬 = 기존 ShopCursor/ShopSort 재사용**. 정렬 화이트리스트 `createdAt|price|endAt`, 기본 = `createdAt desc`(최근 등록 우선, `/me/orders` created_at desc 대칭). keyset cursor(정렬필드+id tiebreaker) 그대로.
> - **응답 DTO = MyShopSummary(신규, /me/shops 전용)** = ShopSummary(§3.3 `{ shopPublicId, status, item, price, endAt?, sellerNickname }`) + **판매자 전용 예상 정산 2필드**:
>   ```
>   MyShopSummary (GET /me/shops content):
>     { shopPublicId, status, item, price, endAt?, sellerNickname,
>       estimatedFee, estimatedSettle }   // 판매자 전용 예상치. estimatedFee = FeeCalculator.compute(price), estimatedSettle = price − estimatedFee
>   ```
>   본인 리스팅이라 `sellerNickname`=자기값(무해). **공개 `GET /shops`의 ShopSummary 는 무변경**(fee/settle 필드 미유입 — 별도 DTO 로 격리, 공개 브라우즈 오염 없음).
> - **예상 정산액 = 판매자 전용·추정치(게이트2 M3 정정 2026-07-22 사용자).** `/me/shops`는 인증 주체(판매자 본인)라 노출 가능. `estimatedFee`·`estimatedSettle`은 **실현값이 아니라 예상치**(ACTIVE 는 sale_order 부재) — 현재 수수료 정책으로 서버가 `FeeCalculator.compute(price)`·`price − fee` 계산. **SOLD 시점 `feePolicy.version()` 기준 실현값과 드리프트할 수 있으므로**(S-B) 필드명·설명에 "예상/estimate"를 명시하고, 실현 fee/settle 은 판매 후 `GET /me/orders?sourceType=SHOP`(판매자 전용, §4.3·purchase-spec §5.2)에 그대로 노출된다.
> - **파급 = 없음(additive read)**: 기존 `GET /shops` 공개 브라우즈·`POST /shops`·`/purchase`·`/cancel`·EPIC-SHOP(done) 무변경. backend-impl 은 `findByCursor` 에 sellerId 스코프를 additive 하게 얹을 뿐(기존 시그니처·public 목록 경로 무영향). 스키마·인덱스·에러코드 신규·변경 0.
> - 승인 시 반영: 버전 로그 "게이트2(EPIC-SHOP-MANAGE) 승인 — §3.2 `GET /me/shops`(내 판매 목록) 추가. 판매자=주체·status 필터(ACTIVE 기본/ALL)·ShopCursor 재사용·MyShopSummary(ShopSummary + 판매자 전용 estimatedFee·estimatedSettle 예상치). 공개 ShopSummary·스키마·에러코드 무변경. 정본 shop-spec §10. 구현 FC-104."

### 3.3 응답 스키마 — 목록/상세 (6절, D-073)

목록/상세 응답의 구체 필드(프론트·QA·디자인 단일 진실). erd 필드·표시 스냅샷 기준. 등급 없음(D-073). 소유자·최고입찰자는 마스킹한다. 골드포스 만료시각은 호환 원시값으로 유지하고 활성/잔여 표시는 서버 `cardInfo`가 파생한다(§3.3.2).

item 블록(공통):
```
item: { typeCode, mainCategory, subGroup, element, kind, level,
        skill1?, skill2?, skillPercent, goldforceExpireAt?,
        nameSnapshot, specSnapshot }
```

필드 타입(v1.9 — 종전 타입 미표기로 클라이언트가 `string` 추정, FC-036 발견):

| 필드 | 타입 | null | 출처 | 설명 |
|---|---|---|---|---|
| `typeCode` | `integer` | N | `item_template.type_code` | 자리값 합성 코드(= main×1000 + sub×100 + element×10 + kind). 템플릿 외부 식별자. 원게임 `itm_type`과 **1:1 동일**(§3.3.1) |
| `mainCategory` | `integer` | N | `item_template.main_category` | **상품군**(천의 자리). 아이템 카드 = `1` 고정(§3.3.1 스코프) |
| `subGroup` | `integer` | N | `item_template.sub_group` | **대분류**(백의 자리) — 1=무기·2=방어구·3=마법. **`kind`의 의미를 결정한다**(§3.3.1) |
| `element` | `integer` | N | `item_template.element` | 속성(십의 자리). 1=물·2=불·3=흙·4=바람(§3.3.1) |
| `kind` | `integer` | N | `item_template.kind` | 종류(일의 자리). **의미가 `subGroup`에 의존**(§3.3.1) |
| `level` | `integer` | N | `item_instance.level` | 인스턴스 강화 레벨 |
| `skill1` | `integer` | **Y** | `skill_definition.skill_code` | 슬롯1 스킬 코드. 슬롯이 비면 `null` |
| `skill2` | `integer` | **Y** | `skill_definition.skill_code` | 슬롯2 스킬 코드. 슬롯이 비면 `null` |
| `skillPercent` | `integer` | N | `item_instance.skill_percent` | 스킬 발동 확률(%) |
| `goldforceExpireAt` | `string` (ISO-8601 UTC) | **Y** | `item_instance.gf_expire_at` | 골드포스 만료 시각. 미적용이면 `null`. 호환·감사용 원시값이며 표시는 서버 파생 `cardInfo.frame` 사용(§3.3.2) |
| `nameSnapshot` | `string` | N | 등록 시점 auction 스냅샷 | 표시명(D-045) |
| `specSnapshot` | `string` | N | 등록 시점 auction 스냅샷 | 표시 스펙(D-045) |
| `cardInfo` | `object` | N | 서버 파생(§3.3.2) | 카드 표시에 사용하는 공통 파생 응답. 프론트 재계산 금지 |

- 5개 코드 축(`typeCode`·`mainCategory`·`subGroup`·`element`·`kind`)과 `level`·`skillPercent`는 **모두 정수**다. erd `item_template`·`item_instance` 컬럼이 전부 `INT`이며 서버 응답 record도 `int`다. 클라이언트는 문자열로 다루지 않는다(정렬·필터·비교가 사전순으로 깨진다).
- **4개 코드 축의 값 정본은 §3.3.1(아이템 코드 사전)이다.** v1.9까지 전 축이 "미확정"이었으나 v1.10에서 원게임 실데이터 전수 조회로 확정됐다.
- **폴백 의무는 유지된다.** 현재 미확정 코드는 없지만, 클라이언트는 여전히 **사전에 없는 코드를 중립 표기(예: "속성 N")로 폴백**해야 하며 코드 집합 크기를 가정한 하드코딩(배열 인덱싱·exhaustive switch)을 두지 않는다. 축이 장차 확장될 수 있고(§3.3.1 스코프 주), 서버·클라이언트 배포 시차 동안 신규 코드가 먼저 내려올 수 있다.

#### 3.3.2 공통 `cardInfo` 파생 응답 (FC-366)

`cardInfo`는 아래 기존 응답 블록에 **동일한 JSON 형상**으로 가법 추가한다.

- `AuctionItemResponse`: `GET /api/v1/auctions`, `GET /api/v1/auctions/{auctionPublicId}`의 `item` 및 이를 재사용하는 경매 응답
- `ShopItemResponse`: `GET /api/v1/shops`, `GET /api/v1/shops/{shopPublicId}`, `GET /api/v1/me/shops`의 `item`
- `ItemSummaryResponse`: `GET /api/v1/me/inventory`의 `items[].summary`, `GET /api/v1/me/temp-storage`의 `content[].summary`, 배송 응답의 `item`
- `ItemInstanceDetailResponse`: `GET /api/v1/items/{itemInstancePublicId}`의 최상위 `cardInfo`

```text
cardInfo = {
  level: integer,
  shortName: string,
  formalName: string,
  category: { code: integer, label: string },
  kind: { code: integer, label: string, abbreviation: string },
  element: { code: integer, label: string, abbreviation: string },
  channelLimit: { code: "BEGINNER"|"INTERMEDIATE"|"EXPERT", label: string },
  frame: { type: "BLACK"|"GOLD", label: string, remainingGoldforceDays: integer },
  skills: [
    { slot: 1, code: integer|null, name: string|null, percent: null },
    { slot: 2, code: integer|null, name: string|null, percent: integer|null }
  ],
  calculatedAt: string(ISO-8601 UTC),
  validUntil: string(ISO-8601 UTC)|null
}
```

- `shortName = "Lv.{level} {element.abbreviation}{kind.abbreviation}"`. 마켓·실시간 경매 등 목록과 compact card의 표시명이다. 속성은 `불/물/흙/바`, 종류는 칼=`검`, 지팡이=`지`, 도끼=`도`, 활=`활`, 신발=`신`, 펜던트=`펜`, 갑옷=`갑`, 방패=`방`, 일반 마법=`필`, 특수 마법(스페셜필)=`스필`이다. 예: `Lv.4 불필`, `Lv.9 바검`, `Lv.5 흙스필`.
- `formalName = "{level}레벨 {kind.label}"`. 카드정보 모달·inline·상세 정보영역의 `명칭`이다. 종류 label은 `칼/지팡이/도끼/활/신발/펜던트/갑옷/방패/마법/스페셜필`, category label은 `무기/방어구/마법`이다. 스페셜필의 명칭은 예외 없이 `5레벨 스페셜필`처럼 표시한다. 기존 template `displayName`과 listing `nameSnapshot`을 개명하거나 대체하지 않는다.
- `9바검`·`바검`·`불신`·`흙필` 등 붙임형·무레벨 약칭은 화면 표시명이 아니라 후속 검색 계약의 입력 alias다. 이번 `cardInfo`에 alias 필드를 추가하거나 프론트에서 alias를 재계산하지 않는다.
- 채널 제한은 Lv.1~4=`BEGINNER`/`초보채널 이상`, Lv.5~6=`INTERMEDIATE`/`중수채널 이상`, Lv.7~9=`EXPERT`/`고수채널 이상`이다.
- `gf_expire_at == null` 또는 `gf_expire_at <= calculatedAt`이면 `BLACK`/`블랙`, 잔여 0일이다. 활성이라면 `GOLD`/`골드`, 잔여는 `ceil((gf_expire_at-calculatedAt)/24h)`를 `1..999`로 clamp한다.
- `skills`는 항상 slot 1, 2 순서의 **정확히 2개 원소**다. 빈 슬롯은 `code/name/percent=null`. 스킬명은 현행 `skill_definition.name`이며 이번 변경에서 명칭을 바꾸지 않는다. 현행 `skillPercent`는 slot 2에만 귀속되어 slot 2가 있고 값이 양수일 때만 `percent`로 싣고, 그 외에는 null이다.
- `calculatedAt`은 해당 단건 요청 또는 목록 응답 조립을 시작하며 `Clock`에서 **한 번만 얻은 Instant**다. 같은 응답의 모든 `cardInfo`가 같은 값을 사용한다.
- `validUntil`은 시간 경과만으로 현재 `frame.type` 또는 `remainingGoldforceDays`가 처음 달라지는 시각(그 시각부터 재조회 필요)이다. 비활성 GF는 `null`. 활성 GF는 999 상한까지 고려한 다음 잔여 일수 경계이며, 만료 경계에서는 BLACK/0으로 바뀐다. 프론트는 자체 countdown으로 값을 고치지 않고 `now >= validUntil`이면 해당 query를 재조회한다.

이 변경은 표시용 projection 추가다. 스키마·인덱스·엔드포인트·에러코드에 변화가 없고 추가 조회나 N+1을 허용하지 않는다. `nameSnapshot`, `displayName`, `goldforceExpireAt`과 기존 코드/스킬 필드는 호환·거래 감사 용도로 그대로 유지한다. `9바검`·`바검` 등 약칭 검색, 슬롯 무관 스킬명 검색, 자동완성 및 검색 색인 변경은 본 계약 범위 밖의 후속 에픽이다.

> **⚠ PROPOSAL — EPIC-MARKET-DATA(FC-097), 게이트2 미승인 (2026-07-22). 승인 전까지 확정 아님.** 정본 = `skill-exposure-spec.md` v1.0. 아래는 공통 item 블록에 스킬명 2개를 **추가**하는 델타다(스키마·엔드포인트·에러코드 무변경, 기존 필드 무변경).
> - **item 블록(공통) 추가 필드**: `skill1Name?`(string, nullable) · `skill2Name?`(string, nullable). 출처 `skill_definition.name`(§5 효과 서술 그대로). `skill1`/`skill2`(코드)가 null이면 각각 null이다(마법 카드는 skill1 부재라 skill1Name=null — game-item-skill-format §6).
> - **목적**: 카드/목록/상세의 스킬 중립표기("스킬 #{code}")를 실제 스킬명으로 대체한다. 이름은 코드에 **부가**되지 코드를 대체하지 않는다 — 필터·아트 매핑은 `skill1`/`skill2` 코드를 그대로 쓴다. `skillPercent`는 이미 노출돼 있어 무변경(표시 형식의 `%`는 클라 조립).
> - **성능**: 경매·고정가 목록/상세 쿼리가 `skill_definition`(skill1·skill2)을 **이미 fetch join**하므로 이름 추가에 N+1·추가 조인이 없다(순비용 = 응답 문자열 2개).
> - **적용 범위**: 공통 item 블록이라 `AuctionSummary/Detail`·`ShopSummary/Detail` 양쪽에 대칭 적용된다. EPIC-AUCTION(done)에는 **비파괴 additive**(nullable 필드 추가, 상태머신·쿼리 무변경)라 티켓을 되돌리지 않는다. 거래내역(§4.3) item 블록 확장은 FC-097 범위 밖(선택·후속).
> - 승인 시 반영: 버전 로그 `v1.14 — 게이트2(EPIC-MARKET-DATA) 승인: §3.3 공통 item 블록에 skill1Name·skill2Name(string, nullable, 출처 skill_definition.name) 추가. 스킬 코드·skillPercent 무변경. 정본 skill-exposure-spec v1.0. 구현 FC-098.`

#### 3.3.1 아이템 코드 사전 (v1.10 신설 — 게이트2 FC-044 승인)

`typeCode`는 4자리 자리값 합성이며 **원게임 `gameshop.itm_type`과 1:1로 동일**하다(코드 변환 계층 없음).

```
typeCode = mainCategory×1000 + subGroup×100 + element×10 + kind
```

**스코프 — 이 사전과 산식은 `mainCategory = 1`(아이템 카드) 대역에만 적용된다.**
원게임에는 다른 상품군(2=SILVER, 3=골드포스 충전권, 4=아바타, 5=펫, 6=속성카드)이 존재하나
**경매·고정가 거래 대상이 아니며 `item_template`이 담지 않는다.** 이들 대역은 위 4축 분해를
따르지 않는 평면 SKU 채번이므로(예: 속성카드 `6000~6003`은 속성이 일의 자리에 0-based),
장차 거래 대상으로 편입하려면 **계약 변경(6절) + 게이트2**가 선행되어야 한다.

**`mainCategory` — 상품군**

| 코드 | 의미 |
|---|---|
| 1 | 아이템 카드 (현재 유일한 거래 대상) |

**`subGroup` — 대분류.** `kind`의 의미를 결정하는 축이다.

| 코드 | 원본 심볼 | 표시명 |
|---|---|---|
| 1 | `WEAPONE` | 무기 |
| 2 | `ARM` | 방어구 |
| 3 | `MAGIC` | 마법 |

**`element` — 속성.** 정확히 4값이며 그 이상은 없다.

| 코드 | 원본 심볼 | 표시명 |
|---|---|---|
| 1 | `WATER` | 물 |
| 2 | `FIRE` | 불 |
| 3 | `EARTH` | 흙 |
| 4 | `WIND` | 바람 |

**`kind` — 종류. ★ 같은 숫자가 `subGroup`마다 다른 것을 가리킨다.** 반드시 표를 나눠 읽는다.

`subGroup = 1` (무기) — element 1~4 × kind 1~4 전수 존재

| kind | 원본 심볼 | 표시명 |
|---|---|---|
| 1 | `AXE` | 도끼 |
| 2 | `WAND` | 완드 |
| 3 | `SWORD` | 검 |
| 4 | `BOW` | 활 |

`subGroup = 2` (방어구) — element 1~4 × kind 1~4 전수 존재

| kind | 원본 심볼 | 표시명 |
|---|---|---|
| 1 | `SHIELD` | 방패 |
| 2 | `PENDANT` | 펜던트 |
| 3 | `ARMOR` | 갑옷 |
| 4 | `BOOTS` | 신발 |

`subGroup = 3` (마법) — **kind가 2값뿐이다.** element 1~4 × kind 1~2 = 8건 전수

| kind | 원본 심볼 | 표시명 |
|---|---|---|
| 1 | `NOMAL` | 일반 |
| 2 | `SPECIAL` | 특수 |

- **`kind` 3·4는 마법에 존재하지 않는다.** `subGroup=3 & kind≥3`은 **성립 불가 조합**이며 서버는 그런 템플릿을 갖지 않는다.
- **원본 심볼은 원게임 표기 그대로다**(`NOMAL`·`WEAPONE`의 철자 포함). **표시명(한국어)은 우리 창작이며 원본 근거가 아니다** — 원본은 영문 코드명만 제공한다. 표시명 변경은 UX 재량이고 계약 변경 대상이 아니다.
- 실제 표시는 `item.nameSnapshot`·`specSnapshot`(등록 시점 스냅샷, D-045)이 우선한다. 이 사전은 **필터·배지·아트 매핑용 코드 해석**에 쓴다.

AuctionSummary (GET /auctions content 항목):
```
{ auctionPublicId, status, item, startPrice, buyNowPrice?,
  highestBidAmount?, bidCount, startAt?, endAt, sellerNickname }
```
AuctionDetail (GET /auctions/{id}): AuctionSummary + `{ resultType?, highestBidderMasked?, extensionCount, maxEndAt, createdAt, minNextBidAmount }`

- `minNextBidAmount`(v1.8, F3): 다음 입찰이 충족해야 할 **최소 금액**(서버 파생). 입찰이 없으면 `startPrice`, 있으면 `현재 최고가 + 구간 증분`이다(§3.1 입찰 하한). 계단식 증분은 서버 설정값이므로 클라이언트가 구간표를 복제하지 않도록 서버가 계산해 내린다. 종료 상태 경매에서는 null.

BidSummary (GET /auctions/{id}/bids content 항목) — v1.8, F2:
```
{ bidPublicId, bidderMasked, amount, status, createdAt }
```
- `status`: `ACTIVE`(현재 최고) / `OUTBID`(상위 입찰로 밀림) / `WON`(낙찰). 경매당 `ACTIVE`는 최대 1건이며 그 입찰자가 곧 `highestBidderMasked`다.
- `bidderMasked`: 입찰자 nickname 마스킹(앞 2자 + `***`) — 상세의 `highestBidderMasked`와 **동일 규약**. 인증 불요 엔드포인트이므로 `userPublicId`·`loginId`·실 nickname을 싣지 않는다(회원 열거 방지, SEC-007).
- 홀드(에스크로) 금액·잔액 등 자금 정보는 **싣지 않는다**(타인 자금 상태 노출 금지). 입찰액은 경매 진행 정보라 공개 대상이다.

> **EPIC-CLOSING 게이트2 승인 반영 (v1.12, 2026-07-21).** 정본 = `closing-domain-spec.md` v1.0 §8. **엔드포인트·필드 집합·에러코드 무변경** — 기존 필드의 값이 마감 후 채워지기 시작할 뿐이다(semantic 명확화).
> - `AuctionDetail.resultType`: 마감 낙찰 시 `BID`(종전 항상 null). 유찰·진행중은 null.
> - `AuctionDetail.status`: 마감 후 **영속 SOLD/UNSOLD**가 그대로 노출(종전 lazy 파생만). `minNextBidAmount`는 종료 상태에서 null(기존 분기 자동 처리).
> - `BidSummary.status`: 낙찰 입찰은 `WON`(계약 §3.3에 이미 정의된 값이 실제로 나타나기 시작).
> - 마감은 **내부 워커**라 외부 API가 없다. 클라 마감(now≥endAt) 후 워커 tick만큼 지연되어 서버 status가 SOLD/UNSOLD로 수렴하는 **짧은 전이 구간**이 존재한다(프론트는 "마감 처리 중" 표기 또는 재조회).
> - 거래내역 조회 `GET /me/orders`·`GET /orders/{id}`(§4.3)는 **EPIC-CLOSING 코어 범위 밖(후속)** — sale_order 데이터는 코어가 생성하나 읽기 엔드포인트는 미구현. 프론트는 낙찰 결과를 경매 상세로만 표시.

ShopSummary (GET /shops content 항목):
```
{ shopPublicId, status, item, price, endAt?, sellerNickname, sellerCompletedSales }
```
ShopDetail (GET /shops/{id}): ShopSummary + `{ createdAt }`

주: item.nameSnapshot/specSnapshot은 등록 시점 스냅샷(D-045). 실시간 값(현재 소유자 등)은 상세에서 마스킹 노출. 필드 추가는 6절 절차.

> **⚠ PROPOSAL — 판매자 완료 판매 건수(FC-148, EPIC-MARKET-QUICKBUY). 게이트2 성격(계약 필드 추가), 사용자 승인 완료(ⓐ 실데이터 표시·정의=완료 판매 건수, 2026-07-29).** 정본 = `shop-spec.md` §11. **추가 = ShopSummary 에 `sellerCompletedSales`(long) 1필드**(형상 보존 = 필드 추가만). ShopDetail·MyShopSummary(§10.3)는 ShopSummary 를 상속하므로 자동 포함된다.
> - **`sellerCompletedSales`(long, non-null, ≥0)** = 판매자(`shop.seller_id`)의 **완료(정산 성립) 판매 건수** = `SELECT COUNT(*) FROM sale_order WHERE seller_id = shop.seller_id`. `sale_order` 는 SOLD 정산 성립분만 존재(취소·유찰·만료는 행 없음, `status`는 `SETTLED` 단일값·erd §4.3)하므로 **취소·유찰·만료·미판매는 정의상 자동 제외**된다. 위조 아님 = 실제 정산원장 집계.
> - **채널 합산(AUCTION + SHOP)**: 경매 낙찰 판매 + 고정가 마켓 판매를 합산한다(판매자 신뢰 지표 = 채널 무관 총 완료 판매). `sale_order` 가 두 채널 공통 핸드오프(§4.3·erd)라 `source_type` 필터 없이 `seller_id` 단일 조건으로 합산이 자연스럽게 산출된다. 마켓 카드 모달 맥락이나 지표 자체는 판매자 전역.
> - **공개 노출 안전**: 집계 카운트(정수)일 뿐 PII·거래상대·금액이 없다 → 공개 `GET /shops` 목록/상세에 노출 가능(판매자 신뢰 지표). 목록에서 카드정보 모달이 바로 열리므로 목록(ShopSummary) 포함이 자연스럽다.
> - **성능(N+1 회피)**: 목록 N행 각각 카운트 쿼리 금지. 권장 = **목록 페이지 조회 후 등장한 seller_id 집합으로 1회 배치 집계**(`SELECT seller_id, COUNT(*) FROM sale_order WHERE seller_id IN (:sellerIds) GROUP BY seller_id`, `sale_order (seller_id)` 인덱스 커버) 후 앱에서 매핑. 페이지당 **추가 쿼리 1개**(N+1 아님). 상관 서브쿼리도 허용(키셋 쿼리 오염 대비 배치안 권장). 향후 핫스팟 시 비정규화 카운터로 이관하는 seam 은 §11.4. **스키마·인덱스·에러코드 신규·변경 0**(집계는 기존 `(seller_id)` 인덱스 재사용).
> - 승인 시 반영: 버전 로그 "6절 계약 변경 — ShopSummary 에 `sellerCompletedSales`(long, 판매자 완료 판매 건수, AUCTION+SHOP 합산, sale_order seller_id 집계) 추가. ShopDetail·MyShopSummary 자동 상속. 공개 노출 안전(집계 카운트). 스키마·인덱스·에러코드 무변경. 정본 shop-spec §11. 구현 = FC-148 하위(backend 집계·frontend 표시)."

## 4. 아이템·인벤토리·주문·화폐

`me` 접두는 인증 주체(SecurityContext) 기준 리소스다.

### 4.1 아이템·시세

GET /api/v1/item-templates — 아이템 정의 카탈로그(검색 메타)
- 인증: 불요
- 쿼리: `mainCategory, subGroup, element, kind`(필터, 등급 없음 D-073). 코드값은 §3.3.1
- 응답 200: offset 페이지(템플릿 = 상품군·대분류·속성·종류·표시명·typeCode)
- 용도: 검색 필터 UI 구성, 원게임 시드 기준(D-067)
- **스코프**: 카탈로그는 `mainCategory = 1`(아이템 카드)만 담는다(§3.3.1). 다른 상품군은 거래 대상이 아니다.
- **⚠ `kind` 단독 필터 경고(v1.10)**: `kind`는 **`subGroup`에 의존**하는 축이라 단독으로는 다의적이다 — `kind=1`은 무기의 **도끼**와 방어구의 **방패**와 마법의 **일반**을 **모두** 반환한다. 서버는 이를 400으로 막지 않고 **요청대로 처리**한다(카탈로그가 소규모라 기술적 제약을 두지 않는다). **다의성 해소는 클라이언트 책임**이다 — 필터 UI는 `kind` 선택지를 `subGroup` 선택에 **종속**시키고, `subGroup` 미선택 시 `kind` 필터를 비활성화하거나 "전 대분류 합집합"임을 명시해야 한다.
- `subGroup=3`(마법)에는 `kind` 3·4가 없다. 성립 불가 조합으로 조회하면 **빈 결과**이며 에러가 아니다.
- 비고(035 관찰): item_template 외부 식별자는 `typeCode`(고정 시드·유일 조합). public_id를 별도로 두지 않는다 — erd와 일치.

GET /api/v1/items/{itemInstancePublicId} — 아이템 인스턴스 상세
- 인증: 불요(공개 범위) / 소유자 부가정보는 인증 시 노출
- 응답 200: 템플릿·레벨·스킬1/2·발동확률·골드포스 만료·현재 위치(공개 가능한 범위) + 소유자(마스킹)
- 에러: `ITEM_001` 없음(404)

GET /api/v1/market-prices — 시세 집계 조회
- 인증: 불요
- 쿼리: `typeCode, level, skill1?, skill2?` — 시세 집계 단위(D-044 조건, §7.7). item_template 참조는 typeCode(035)
- 응답 200: `{ key:{template,level,skill1,skill2}, avgPrice, minPrice, maxPrice, recentPrice, sampleCount, windowDays }`
- 비고: 집계는 sale_order 기준. 골드포스는 집계 키에서 제외(시간제, D-066) — 필터로만.

### 4.2 인벤토리

GET /api/v1/me/inventory — 내 정규 인벤토리(96칸)
- 인증: 필요
- 쿼리: `sort=slotNo,asc`(기본)
- 응답 200: `{ capacity:96, used, items:[ {itemInstancePublicId, slotNo, 요약} ] }`

GET /api/v1/me/temp-storage — 내 임시보관(오버플로우)
- 인증: 필요
- 응답 200: cursor 페이지(`items:[ {itemInstancePublicId, storedAt, expireAt?, 요약} ]`)

- **"요약"(ItemSummaryResponse) 블록**: `{ typeCode, displayName, level, skill1Code?, skill2Code?, skill1Name?, skill2Name?, skillPercent, goldforceExpireAt?, cardInfo }`. `skill1Code`/`skill2Code`는 스킬 코드(`skill_definition.skill_code`, 슬롯 비면 null), `skill1Name`/`skill2Name`은 그 코드의 스킬명(`skill_definition.name`, 코드가 null이면 각각 null — v1.21/FC-179 가법 추가). 이름은 코드에 **부가**될 뿐 대체하지 않는다(필터·아트 매핑은 코드 유지). `cardInfo`는 §3.3.2의 서버 파생 표시 블록이며 인벤토리·임시보관과 이를 재사용하는 배송 응답에서 동형이다. §3.3 공통 item 블록의 `skill1Name`/`skill2Name`(v1.14/FC-098)과 대칭이며 스킬명 단일 원천 = 백엔드 `SkillDefinition`.

POST /api/v1/me/temp-storage/{itemInstancePublicId}/relocate — 임시보관→정규 슬롯 이동
- 인증: 필요(소유자)
- 요청(body): `{ slotNo? }`(미지정 시 빈 슬롯 자동 배정)
- 동작: 정규 슬롯 여유 필요. location TEMP→INVENTORY 이동(temp_storage 행 제거).
- 응답 200: `{ slotNo }`
- 에러: `INV_001` 인벤토리 만실(409), `INV_002` 슬롯 점유(409), `ITEM_002` 소유자 아님(403), `ITEM_003` 대상 아이템이 임시보관(TEMP) 상태 아님(409)

### 4.3 주문(거래)

GET /api/v1/me/orders — 내 거래 내역
- 인증: 필요
- 쿼리: `role=BUYER|SELLER, sourceType=AUCTION|SHOP`(필터), 페이징(cursor)/정렬(`createdAt`)
- 응답 200: cursor 페이지(주문 요약: 상대·아이템·최종가·정산액·시각)

GET /api/v1/orders/{orderPublicId} — 주문 상세
- 인증: 필요(구매자·판매자 당사자만)
- 응답 200: 주문 상세(출처·아이템·최종가·수수료·정산액·상태)
- 주(수수료 근거): 응답의 **수수료(feeAmount)·정산액(settleAmount)** 계산 근거·구간표·최소/상한 정본은 **`fee-policy-spec.md`**다(플랫폼 중계 수수료, **판매자 단독 부담**, 게이트2 확정 2026-07-20). 관계식 `settleAmount = finalPrice − feeAmount`. 필드 집합 무변경 — 신규 필드 없이 기존 fee/settle의 계산 의미만 계약에 명확화한다. 구현 소유 = EPIC-CLOSING(정산). erd `sale_order`(final_price/fee_amount/settle_amount)와 정합.
- 에러: `ORDER_001` 없음(404), `ORDER_002` 당사자 아님(403)

> **EPIC-PURCHASE 게이트2 승인 반영 (v1.13, 2026-07-22).** 정본 = `purchase-spec.md` v1.0 §5. 위 §4.3 엔드포인트는 등재돼 있으나 응답 스키마·역할별 노출 범위가 미규정이었다(BidSummary v1.8 신설 선례). 아래로 확정한다. **스키마(sale_order) 무변경 — 읽기 전용.**
> - **인가(IDOR, B1)**: `GET /me/orders`는 `buyer_id = me OR seller_id = me`로 스코프(제3자 미노출), `role`·`sourceType` 필터는 그 안에서 좁힘. `GET /orders/{id}`는 당사자만(`ORDER_002` 403, 미존재 `ORDER_001` 404 — public_id ULID라 열거 무해).
> - **역할별 노출 범위(B2, 정밀화)**: `feeAmount`·`settleAmount`은 **판매자 전용**이다(판매자 측 회계). 구매자 응답에는 두 필드를 **싣지 않는다**(필드 자체 부재) — 구매자는 자기가 지불한 `finalPrice`만 본다. 현행 위 문구(양 당사자 모두 fee/settle 노출로 읽힘)를 이렇게 정밀화한다.
> - **SaleOrderResponse 스키마(확정)**:
>   ```
>   OrderSummary (GET /me/orders content):
>     { orderPublicId, myRole, sourceType, counterpartyMasked, item, finalPrice, status, createdAt,
>       itemInstancePublicId, feeAmount?, settleAmount? }   // feeAmount·settleAmount 는 myRole==SELLER 일 때만 존재
>   OrderDetail (GET /orders/{id}): OrderSummary + { settledAt }
>   ```
>   `myRole`=`BUYER|SELLER`(요청자 대비 파생), `sourceType`=`AUCTION`(코어. BID/BUYNOW 구분은 미노출 — B3), `counterpartyMasked`=상대 nickname 마스킹(§3.3 규약, userPublicId·loginId 미노출), `item`=§3.3 item 블록 요약.
>   - **`itemInstancePublicId`(v1.x, EPIC-ITEM-DELIVERY · FC-193, additive)**: ULID char26. 주문이 인도한 아이템 인스턴스의 공개 식별자로, `OrderDetail`의 동명 필드와 **동일 의미·타입**이다(단건 전용이던 필드를 목록에도 승격). `/me/deliveries`의 `DeliverySummary.itemInstancePublicId`(§4.6)와 교차하는 **주문↔배송 교차 키** — 구매내역 목록에서 배송 배지를 잇는다. 기존 필드·순서·형상 불변(추가만).

### 4.4 화폐(잔액·충전·교환)

GET /api/v1/me/balance — 내 잔액
- 인증: 필요
- 응답 200: `{ cashBalance, gameMoneyBalance, gameMoneyHeld, gameMoneyAvailable }`

POST /api/v1/charges — 캐시 충전 시작(토스 테스트 결제)
- 인증: 필요
- 요청(body): `{ amount }`
- 응답 201: `{ chargePublicId, amount, paymentClientKey, status:"READY" }`
- 비고: 결제창 연동은 클라이언트. 실제 캐시 반영은 승인 콜백에서.

POST /api/v1/charges/confirm — 충전 승인 처리
- 인증: 필요(호출자 JWT) + charge 소유자 검증(`charge.user_id == 호출자`, SEC-002)
- 요청(body): `{ paymentKey, chargePublicId }` (클라이언트 amount는 받지 않거나 대조용일 뿐 근거 아님)
- 동작(SEC-001·002): 토스 서버-투-서버 승인 API(시크릿 키)로 승인·금액을 재조회해 확정한다(클라이언트 amount 신뢰 금지). 캐시 반영은 `pg_tx_id`(=paymentKey) 기준 멱등 — `charge.pg_tx_id` UK로 동일 승인 재반영을 DB에서 차단. 거래 TX와 분리(D-053).
- 응답 200: `{ status:"APPROVED", cashBalance }`
- 에러: `CHARGE_001` 승인 검증 실패(422), `CHARGE_002` 금액 불일치(토스 승인액과 charge 불일치, 422), `CHARGE_003` 충전 소유자 불일치(403). 중복 승인은 200(멱등 no-op)

GET /api/v1/me/charges — 충전 내역
- 인증: 필요 / 응답 200: cursor 페이지

POST /api/v1/exchanges — 캐시↔게임머니 교환
- 인증: 필요
- 요청(header): `Idempotency-Key`(필수, SEC-004) — 동일 키 재요청은 1회만 처리(재시도 안전)
- 요청(body): `{ direction:"CASH_TO_GAME", cashAmount }` (역방향 환전은 범위 밖, domain-spec §12)
- 동작: 교환 비율 파라미터 적용(비율 ON-HOLD, 확정 전 스텁). 캐시 차감은 조건부 원자 갱신(가용 이내), 게임머니 지급. 멱등키로 이중 제출·재시도 무해화.
- 응답 201: `{ gameMoneyAmount, appliedRate }`
- 에러: `EXC_001` 캐시 잔액 부족(422), `EXC_002` 역방향 미지원(422)

### 4.5 관리자

POST /api/v1/admin/auctions/{auctionPublicId}/force-cancel — 관리자 강제 취소
- 인증: 필요(관리자)
- 동작: 상태 무관 강제 CANCELLED(정책 위반 등). 입찰 홀드 전량 해제·아이템 에스크로 해제.
- 응답 200: `{ status }` / 에러 `AUTH_005` 권한 없음(403)

POST /api/v1/admin/search/reindex — 검색 인덱스 온디맨드 재색인 트리거 (search-spec v0.4 §12.5)
- ★ **미구현 — 관리자 페이지 에픽으로 이월(2026-07-24 사용자 결정)**: 계약·절차는 확정(설계 완료, search-spec v0.4 §12.5)이나 **구현은 미착수**다. 관리자 계정 프로비저닝·관리자 UI를 별도 "관리자 페이지" 에픽으로 분리 신설할 때 함께 구현한다. **현재 호출 시 매핑 없음(404)** — 프론트/외부 호출 금지. 구현 대기 티켓 [[FC-116]].
- 인증: 필요(관리자). `/api/v1/admin/**`는 `ROLE_ADMIN` 인가(비관리자 403 `AUTH_005`).
- 배경: 운영은 부팅 재색인 트리거가 없다(local만 `reindex-on-startup`) → 관리자가 온디맨드로 재색인한다. 재색인 소요는 리스팅 수에 비례해 길어 **비동기**(202+jobId)로 처리한다.
- 요청(body, 선택): `{ mode }` — `IN_PLACE`(기본, 현 인덱스에 SoT 백필·보정) \| `REBUILD`(신 인덱스 생성→백필→검증→alias 원자 스위치, 무중단 blue-green; 매핑/분석기 변경 시).
- 동작: 재색인 job을 접수하고 즉시 반환. 동시 실행은 single-flight(진행 중 재요청은 거부).
- 응답 202: `{ jobId }`(ULID, 접수 의미 — 완료 아님)
- 에러: `SEARCH_002` 재색인 이미 진행 중(409)

GET /api/v1/admin/search/reindex/{jobId} — 재색인 job 상태 조회
- 인증: 필요(관리자)
- 응답 200: `{ jobId, mode, state, startedAt, finishedAt?, targetIndex?, indexedCount, aliasSwitched, error? }`
  - `state`: `PENDING`\|`RUNNING`\|`SUCCEEDED`\|`FAILED`. `targetIndex`·`aliasSwitched`는 `REBUILD` 시 유의미(신 물리 인덱스명·스위치 성공 여부). `error`는 `FAILED` 시 사유 요약.
  - job 상태는 인메모리(단일 인스턴스)라 앱 재기동 시 유실될 수 있다(재트리거로 복구 — 재색인은 파생 read-model 재구성이라 안전).
- 에러: `SEARCH_003` 재색인 job 없음(404)

### 4.6 게임 아이템 지급·배송 (delivery) — EPIC-ITEM-DELIVERY, v1.22

장터 낙찰(SOLD)·즉시구매(BUYNOW) 아이템을 게임 캐릭터 인벤토리로 도착시키는 **웹측 우편함(다리)** 계약이다. 도메인 규칙 정본 = `delivery-domain-spec.md` v1.0. **게이트2 형상 3건(delivery-spec §13)은 사용자 승인 대상.** 우편함 정본 = DB(`item_delivery`), Redis는 best-effort 알림(하이브리드 — 순수 Redis 기각, bid §8 정신).

#### 4.6.1 구매자 배송 상태 조회 (웹 REST)

전 엔드포인트 **인증 필요**, 주체 = SecurityContext, `/me` 접두(`recipient_user_id=주체` 스코프 — IDOR 설계 차단).

GET /api/v1/me/deliveries — 내 배송 목록(커서)
- 인증: 필요. 요청(query): `?cursor=<opaque>&size=<n>`(§1.3 cursor), 필터 `status`(선택, 대문자)
- 응답 200: `CursorResponse<DeliverySummary>` — `recipient_user_id=주체` 스코프, `created_at desc`(내부 단조 키 안정 정렬).
- `DeliverySummary` = `{ deliveryPublicId, status, item, itemInstancePublicId, createdAt, appliedAt? }`. `status` ∈ `PENDING`(게임으로 배송중)·`CLAIMED`(게임 수령 중)·`APPLIED`(도착)·`DEFERRED`(게임 인벤 만실·보류)·`FAILED`(실패·관리자 확인). `item` = §3.3 item 블록 요약(typeCode·displayName·level·스킬·발동확률·골드포스). **`claimToken`·`claimedAt`은 미노출**(내부 리스 메커니즘).
- 에러: 401

GET /api/v1/me/deliveries/{deliveryPublicId} — 배송 상세
- 인증: 필요. 당사자(recipient=주체)만.
- 응답 200: `DeliverySummary` + `{ recipientNickname }`
- 에러: `DELIVERY_001` 배송 없음(404 — 미존재·비당사자 통일, public_id ULID라 열거 무해), 401

- **프론트(FC-190)**: 인벤토리·구매내역에서 아이템별 배송 상태 배지("게임으로 배송중/도착/보류")로 표기하며, `itemInstancePublicId`로 인벤/주문 항목과 교차 조회한다. **기존 `/me/inventory`·`/me/orders` 응답 스키마는 불변**(형상 보존) — 배송 상태는 이 신규 엔드포인트에서만 온다. 아이템이 게임에 도착(APPLIED)하면 `item_instance.location=IN_GAME`으로 이동해 웹 인벤토리에서 빠진다(재판매 불가).

#### 4.6.2 게임 claim = DB 직접 프로토콜 (웹 REST API 아님 — 형상 (b) 확정)

- **게임의 claim/apply/ack는 웹 REST 엔드포인트가 아니다.** 게임 서버가 finalcall MySQL에 **DB 직접 접근**해 조건부 CAS로 수행한다(통합 스키마·read 통합/write 소유자 모델, memo boundary 포맷터=게임 서버 소속 선례). 이 계약은 api-contract의 요청/응답 envelope(§1.4)·에러코드 체계에 편입하지 않는다 — **비-API 프로토콜**로 문서화만 한다. 절차·SQL 규격 정본 = `delivery-domain-spec.md` §5.2.
  - claim: `UPDATE item_delivery SET status='CLAIMED', claim_token=?, claimed_at=NOW(6) WHERE id=? AND status IN ('PENDING','DEFERRED')` — 영향행 1=단일 승자.
  - apply: 게임이 자족 스냅샷 + boundary 번역(itm_skill 재패킹·level−1·usr_id 매핑)으로 `user_item` INSERT(itm_uuid = delivery.item_uuid). `user_item.itm_uuid` UK가 중복 apply를 no-op화(exactly-once 효과).
  - ack: `UPDATE item_delivery SET status='APPLIED', applied_at=NOW(6) WHERE id=? AND status='CLAIMED' AND claim_token=?` — 만료 토큰 ack 무시.
  - defer(만실): `status='DEFERRED'`로 되돌림(우편함 안전 보관).
- **boundary 번역(itm_skill 패킹·level−1·usr_id 매핑)은 전적으로 게임 서버 소속**(delivery-spec §6.2, memo §8 선례)이며 웹 계약이 아니다. **게임 서버 claim 실이식은 후속 별건**(delivery-spec §12.2) — 이번 계약은 게임이 맞출 DB 규격만 확정한다.
- 웹이 게임에 제공하는 계약면 = (1) `item_delivery` 스키마·상태 머신, (2) 자족 스냅샷 컬럼 집합, (3) `item_uuid` 멱등키 규약, (4) Redis 신호 채널 `delivery:{recipientUserId}`(best-effort).

---

## 5. 에러코드 표

`{DOMAIN}_{NNN}` 코드 ↔ HTTP status. 응답 envelope의 `code`에 실린다(1.4). 백엔드 도메인 ErrorCode enum과 1:1. 단 게이트웨이 엣지 코드(`GATEWAY_*`, 1.6)는 엣지에서 발생하므로 이 1:1 규칙의 예외다(도메인 enum 미등재).

| 코드 | 의미 | HTTP |
|---|---|---|
| COMMON_004 | 분산락 획득 실패(LOCK_ACQUISITION_FAILED) | 409 |
| COMMON_005 | 세션 무효(탈퇴 주체 등, §2.5) | 401 |
| AUTH_001 | 중복 loginId | 409 |
| AUTH_002 | 중복 nickname | 409 |
| AUTH_003 | 로그인 자격 불일치 | 401 |
| AUTH_004 | refresh 토큰 만료·무효 | 401 |
| AUTH_005 | 권한 없음(관리자 등) | 403 |
| AUTH_006 | 미지원 소셜 provider(경로 provider 오류, §2 OAuth) | 400 |
| AUTH_007 | 소셜 인가 코드 교환 실패(무효·만료·재사용, §2 OAuth) | 401 |
| AUTH_008 | 소셜 provider 통신 실패(토큰·userinfo 조회·타임아웃, §2 OAuth) | 502 |
| MEMBER_001 | 닉네임 중복(프로필 수정, §2.5) | 409 |
| MEMBER_002 | 진행 중 거래 보유로 탈퇴 불가(§2.5) | 409 |
| MEMBER_003 | 기본 캐릭터 ID 허용 집합 위반(`{1..12,25..28}`, 13..24 포함, §2.5) | 400 |
| MEMO_001 | 수신자(닉네임) 없음 — 활성 회원 아님(§2.6 발신) | 404 |
| MEMO_002 | 메모 없음(존재하지 않는 public_id, §2.6) | 404 |
| MEMO_003 | 당사자 아님(남의 메모 열람·삭제, IDOR, §2.6) | 403 |
| MEMO_004 | 자기 자신에게 발신 불가(§2.6) | 422 |
| CHAT_001 | 채팅방/메시지 없음 또는 요청자가 당사자가 아님(열거 방지 통일, §2.7) | 404 |
| CHAT_002 | 대화 상대 없음·비활성(§2.7 direct room) | 404 |
| CHAT_003 | 자기 자신과 direct room 생성 불가 | 422 |
| CHAT_004 | 같은 clientMessageId를 다른 정규화 본문에 재사용 | 409 |
| CHAT_005 | 차단 등으로 현재 대화할 수 없는 상태(차단 방향 비노출) | 409 |
| CHAT_006 | 읽음 throughSequence가 room 범위를 벗어남 | 422 |
| CHAT_007 | 신고 대상이 같은 방 상대방 발신 메시지가 아님 | 422 |
| CHAT_008 | 같은 메시지 중복 신고 | 409 |
| CHAT_009 | 서비스 사용자 채팅 rate limit·socket quota 초과 | 429 |
| EMAIL_001 | 인증 코드 불일치(§2 이메일 인증) | 422 |
| EMAIL_002 | 코드 만료·미발송(존재 여부 비노출 통일) | 422 |
| EMAIL_003 | 시도 횟수 초과(코드 폐기) | 429 |
| EMAIL_004 | 재전송 쿨다운 | 429 |
| EMAIL_005 | 이미 인증된 이메일 | 409 |
| EMAIL_006 | 이메일 미설정(이메일 없는 상태에서 인증요청) | 409 |
| EMAIL_007 | 이메일 이미 사용 중(유니크 위반, signup·set-email) | 409 |
| AUCTION_001 | 아이템 미소유·미보유·미존재(출품 불가) | 403 |
| AUCTION_002 | 이미 출품중 | 409 |
| AUCTION_003 | buyNowPrice ≤ startPrice | 422 |
| AUCTION_004 | 경매 없음 | 404 |
| AUCTION_005 | 즉시구매 미설정 | 422 |
| AUCTION_006 | 처리 불가 상태(이미 종료 / 즉시구매 시 미개시 포함) | 409 |
| AUCTION_007 | 입찰 존재로 취소 불가 | 409 |
| AUCTION_008 | 경매 시간 파라미터 위반(SEC-009) | 422 |
| AUCTION_009 | 판매자 자기구매(즉시구매, SEC-003) | 403 |
| BID_001 | 최소 증분 미달 | 422 |
| BID_002 | buyNowPrice 이상 | 422 |
| BID_003 | 자기 경매 입찰 | 403 |
| BID_004 | 연속(최고가 보유자) 입찰 | 409 |
| BID_005 | 게임머니 잔액 부족 | 422 |
| BID_006 | 마감/종료됨 | 409 |
| BID_007 | 경매 미개시(SCHEDULED·startAt 미도래, §3.1) | 409 |
| SHOP_001 | 아이템 미소유·미보유 | 403/409 |
| SHOP_002 | 이미 출품중 | 409 |
| SHOP_003 | 고정가 없음 | 404 |
| SHOP_004 | 이미 판매/종료 | 409 |
| SHOP_005 | 게임머니 잔액 부족 | 422 |
| SHOP_006 | 판매자 자기구매(SEC-003) | 403 |
| ITEM_001 | 아이템 없음 | 404 |
| ITEM_002 | 소유자 아님 | 403 |
| ITEM_003 | relocate 대상 아이템이 임시보관(TEMP) 상태가 아님(§4.2) | 409 |
| INV_001 | 인벤토리 만실 | 409 |
| INV_002 | 슬롯 점유 | 409 |
| ORDER_001 | 주문 없음 | 404 |
| ORDER_002 | 당사자 아님 | 403 |
| DELIVERY_001 | 배송 없음(미존재·비당사자 통일, §4.6) | 404 |
| BOARD_001 | 게시판 없음(slug 미존재 또는 비활성, §6) | 404 |
| BOARD_002 | 게시판 쓰기 권한 없음(write_policy 위반 — ADMIN_ONLY 게시판 비관리자 작성·수정·삭제, §6) | 403 |
| BOARD_003 | 댓글 비허용 게시판(allow_comments=false, §6) | 422 |
| POST_001 | 게시글 없음(미존재·삭제됨, §6) | 404 |
| POST_002 | 게시글 작성자 아님(수정·삭제 IDOR, non-admin, §6) | 403 |
| COMMENT_001 | 댓글 없음(미존재·삭제됨, §6) | 404 |
| COMMENT_002 | 댓글 작성자 아님(수정·삭제 IDOR, non-admin, §6) | 403 |
| COMMENT_003 | 자기 댓글 공감/비공감 불가(반응 토글, §6.3) | 422 |
| IMAGE_001 | 지원하지 않는 이미지 형식(jpeg·png·webp·gif 외, §6) | 422 |
| IMAGE_002 | 이미지 용량 초과(>5MB, §6) | 422 |
| CHARGE_001 | 승인 검증 실패 | 422 |
| CHARGE_002 | 금액 불일치(토스 승인액 대조) | 422 |
| CHARGE_003 | 충전 소유자 불일치(SEC-002) | 403 |
| EXC_001 | 캐시 잔액 부족 | 422 |
| EXC_002 | 역방향 교환 미지원 | 422 |
| SEARCH_001 | 검색엔진 일시 불가(ES 미가용·타임아웃, 파생 read-model) | 503 |
| SEARCH_002 | 재색인 이미 진행 중(single-flight, §4.5) | 409 |
| SEARCH_003 | 재색인 job 없음(존재하지 않는 jobId, §4.5) | 404 |
| GATEWAY_429 | rate limit 초과(엣지, SEC-005·D-068) | 429 |
| GATEWAY_403 | 게이트웨이 미경유 직접접근 차단(엣지) | 403 |

주: 검증 실패(형식) 400 + `errors[]`(1.4). 코드 목록은 엔드포인트 추가 시 확장.

---

## 6. 게시판 (board · post · comment · image) — EPIC-BOARD, v1.23(게이트2 승인 확정 2026-08-06)

> **가법 신설**: §5(에러코드 표) 뒤에 두어 기존 §1~§5 번호를 보존한다(파괴적 재번호 회피). 이 절은 커스텀 게시판 시스템 계약이며, 도메인 규칙 정본 = `board-domain-spec.md` v1.0, 스키마 = `erd.md` §4.5. **게이트2 3건(board-spec §11) 사용자 승인 완료** — 이미지 저장=오브젝트 스토리지(MinIO/S3)·presigned GET 서빙.

게시판을 하드코딩 enum(구 `NoticeType`)이 아니라 **DB 레코드(Board 레지스트리)**로 정의한다. 게시판마다 쓰기 정책·댓글 허용·유형을 옵션으로 갖고, 시드로 공지·커뮤니티·이벤트 3개를 심는다(관리자 CRUD UI는 다음 에픽). 기존 `notice`(V1 참조 구현)는 **공지 게시판으로 흡수**되며 `/notices/**` API·notice 도메인은 폐지된다 — **board 도메인이 새 참조 구현**(컨벤션 쇼케이스)을 승계한다(board-spec §8·§11(b)).

공통: 외부 식별자는 게시판=`slug`(사람이 읽는 well-known 키·`^[a-z0-9-]{2,50}$`), 게시글·댓글·이미지=`publicId`(ULID). 목록·상세·이미지 조회는 **공개**(인증 불요), 쓰기(작성·수정·삭제·업로드)는 **인증 필요**. 인가 주체·작성자는 요청 바디가 아니라 SecurityContext(userId)로만 취한다(B-009·IDOR 차단). 관리자 판정 = JWT `admin` 클레임 → `ROLE_ADMIN`.

### 6.1 게시판 (board)

#### GET /api/v1/boards — 게시판 목록
- 인증: 불요
- 응답 200: `{ boards: [ BoardResponse... ] }` — `is_active=true`만, `sort_order asc` 정렬.
- `BoardResponse` = `{ slug, name, description, boardType, writePolicy, allowComments, sortOrder }`. `boardType` ∈ `GENERAL`\|`NOTICE`\|`EVENT`, `writePolicy` ∈ `ADMIN_ONLY`\|`AUTHENTICATED`.

#### GET /api/v1/boards/{slug} — 게시판 단건
- 인증: 불요
- 응답 200: `BoardResponse`
- 에러: `BOARD_001` 게시판 없음(slug 미존재·비활성, 404)

### 6.2 게시글 (post)

#### GET /api/v1/boards/{slug}/posts — 게시글 목록(커서)
- 인증: 불요. 요청(query): `?cursor=<opaque>&size=<n>`(§1.3 cursor)
- 응답 200: `CursorResponse<PostSummary>` — `board_id=slug게시판 AND is_deleted=false`, 정렬 **`is_pinned DESC, id DESC`**(고정 우선·최신순). 커서 키=`id`.
- `PostSummary` = `{ postPublicId, title, authorNickname, authorPrimaryCharacterId?, isPinned, viewCount, commentCount, thumbnailUrl?, createdAt }`. `thumbnailUrl`=첫 첨부 이미지 url(없으면 null). `authorNickname`=작성 시점 스냅샷(흡수 공지·시스템 글은 시드 표시명). `authorPrimaryCharacterId`는 활성 작성자의 현재값이며 시스템 글·탈퇴 회원은 null이다.
- 에러: `BOARD_001`(404), 401 없음(공개)

#### POST /api/v1/boards/{slug}/posts — 게시글 작성
- 인증: **필요** + 게시판 `write_policy` 충족(`ADMIN_ONLY`→`ROLE_ADMIN`·`AUTHENTICATED`→임의 인증) + `board.is_active`
- 요청(body): `{ title, content, imagePublicIds?: [ ULID... ] }` — `title`(`@NotBlank`·≤200), `content`(`@NotBlank`·≤10000, TEXT), `imagePublicIds`(선택·≤10, §6.4 업로드로 받은 이미지 귀속). 작성자·조회수·댓글수 필드는 요청에 없다(서버 세팅).
- 동작: 작성자=주체(`author_id`·`author_nickname` 스냅샷), `imagePublicIds`의 각 이미지를 **업로더==주체 검증 후** `post_id` 바인딩(재귀속 금지). `view_count`·`comment_count`=0.
- 응답 201: `{ postPublicId }`
- 에러: `BOARD_001` 게시판 없음·비활성(404), `BOARD_002` 쓰기 권한 없음(write_policy 위반, 403), 검증 400, 401

#### GET /api/v1/boards/{slug}/posts/{postPublicId} — 게시글 상세
- 인증: 불요
- 동작: 조회수 원자 증가(`UPDATE post SET view_count=view_count+1`, 디둡 없음 — board-spec §6.2).
- 응답 200: `PostDetailResponse` = `{ postPublicId, boardSlug, title, content, authorNickname, authorPrimaryCharacterId?, isPinned, viewCount, commentCount, images: [ { imagePublicId, url, sortOrder } ], createdAt, updatedAt, editable }`. character ID는 목록과 동일한 현재값 규칙이다. `editable`=요청 주체가 작성자이거나 관리자면 true(비로그인·타인 false — 프론트 수정/삭제 버튼 노출 제어, 인가 권위는 서버 §1.2).
- 에러: `POST_001` 게시글 없음·삭제됨(404), `BOARD_001`(404)

#### PUT /api/v1/boards/{slug}/posts/{postPublicId} — 게시글 수정
- 인증: **필요** + (작성자 본인 `author_id==주체`) **OR** `ROLE_ADMIN`. ADMIN_ONLY 게시판은 관리자만(작성자라도 비관리자 불가, board-spec I-3).
- 요청(body): `{ title, content, imagePublicIds? }`(작성과 동일 스키마·검증). `imagePublicIds`는 최종 이미지 집합(누락분 언바인딩·신규분 바인딩).
- 응답 204(본문 없음)
- 에러: `POST_001`(404), `POST_002` 작성자 아님(403), `BOARD_002`(ADMIN_ONLY 위반, 403), 검증 400, 401

#### DELETE /api/v1/boards/{slug}/posts/{postPublicId} — 게시글 삭제(soft)
- 인증: **필요** + (작성자 본인) OR `ROLE_ADMIN`
- 동작: soft delete(`is_deleted=true`·`deleted_at=now`). 댓글은 글 필터로 자연 배제(개별 정리 없음).
- 응답 204
- 에러: `POST_001`(404), `POST_002`(403), `BOARD_002`(403), 401

### 6.3 댓글 (comment) — v1.24 네이버식 확장(대댓글·공감/비공감·정렬)

댓글 경로는 게시글 `public_id`(전역 유일)에 직접 건다. 목록은 글당 소규모라 offset(§1.3 예외). **v1.24**: 목록은 **루트 댓글만** 반환하고(답글은 별도 API), 각 댓글에 답글 수·공감/비공감·내 반응을 싣는다. 정본 = board-spec §13·§14(게이트2 3건 상신). 스키마 = erd §4.5(`comment` 확장·`comment_reaction`).

> **형상 교체(게이트2 (c) 확정)**: v1.0 `CommentResponse{ commentPublicId, authorNickname, content, createdAt, updatedAt, editable }` → v1.24로 **하위호환 없이 교체**한다(FC-199/203 방금 배포·외부 소비자 없음·형상보존 예외 사용자 승인 2026-08-06). 아래가 신 계약이다.

`CommentResponse`(루트 목록·답글 공통 코어) = `{ commentPublicId, authorNickname, authorPrimaryCharacterId?, content, createdAt, updatedAt, editable, ownedByMe, likeCount, dislikeCount, myReaction, deleted }`
- `likeCount`·`dislikeCount`(int) = 비정규화 카운트. `myReaction` ∈ `LIKE`|`DISLIKE`|`null`(뷰어 종속 — 인증 시 뷰어의 반응, 비인증·미반응 `null`). `editable`·`ownedByMe`·`myReaction`은 optional-auth(토큰 있으면 부여, `getItemInstance` 선례).
- `editable`(bool) = 요청 주체가 작성자이거나 `ROLE_ADMIN`이면 `true`(수정·삭제 UI 제어; 인가 권위는 서버). `ownedByMe`(bool) = **인증 주체의 회원 ID와 저장된 `comment.authorId`가 같을 때만** `true`; 비로그인·관리자가 작성하지 않은 타인 댓글은 `false`. 닉네임 표시 스냅샷을 비교하지 않으므로 닉네임 변경·재사용과 무관하며, 판정 근거인 `authorId` 자체는 응답에 노출하지 않는다. 따라서 관리자의 타인 댓글은 `editable=true`, `ownedByMe=false`일 수 있다.
- `authorPrimaryCharacterId`는 활성 작성자의 현재값 `{1..12,25..28}`, 탈퇴 회원·시스템 작성자·tombstone은 null이다. 목록은 작성자 ID 배치 조회로 조립하며 항목별 회원 조회를 금지한다.
- `deleted`(bool) = tombstone 여부(board-spec §13.4). `true`면 `content`·`authorNickname`·`authorPrimaryCharacterId`=`null`, `likeCount/dislikeCount`=0, `editable=false`, `ownedByMe=false`, `myReaction`=null(마스킹).

#### GET /api/v1/posts/{postPublicId}/comments — 루트 댓글 목록(offset)
- 인증: 불요(인증 시 `myReaction`·`editable`·`ownedByMe` 부여). 요청(query): `?page=<n>&size=<n>`(기본 size 20·상한 100), `?sort=<LATEST|OLDEST|LIKES>`(기본 `LATEST`)
- `sort`: `LATEST` 최신순(`id DESC`·**기본**, 게이트2 확정) · `OLDEST` 과거순(`id ASC`) · `LIKES` 순공감순(`like_count DESC, id DESC`). 화이트리스트 외 400. `LATEST`/`OLDEST`는 `(post_id, parent_comment_id, id)` 인덱스가 정·역방향 커버, `LIKES`는 `(post_id, parent_comment_id, like_count)` 커버(erd §5).
- 응답 200: offset 페이지 `{ content: [ CommentResponse + { replyCount } ... ], page, size, totalElements, totalPages }` — `post_id=글 AND parent_comment_id IS NULL AND (is_deleted=false OR reply_count>0)`(tombstone 포함, board-spec §13.4). `replyCount`(int)=이 루트의 활성 답글 수(네이버 "답글 N개").
- 에러: `POST_001` 글 없음(404)

#### GET /api/v1/posts/{postPublicId}/comments/{commentPublicId}/replies — 답글 목록(offset)
- 인증: 불요(인증 시 `myReaction`·`editable`·`ownedByMe` 부여). 요청(query): `?page=<n>&size=<n>`(기본 20·상한 100). 정렬은 `id asc` 고정(시간순, param 없음).
- 응답 200: offset 페이지 `{ content: [ ReplyResponse... ], page, size, totalElements, totalPages }` — `parent_comment_id=대상댓글 AND is_deleted=false`.
- `ReplyResponse` = `CommentResponse` + `{ mentionedNickname }`(string|null — 답글의 답글이면 @멘션 대상 닉 스냅샷, 직접 답글이면 null). 답글은 `replyCount` 없음(1단계).
- 에러: `COMMENT_001` 대상 댓글 없음·삭제(404), `POST_001` 글 없음(404)

#### POST /api/v1/posts/{postPublicId}/comments — 루트 댓글 작성
- 인증: **필요** + 게시판 `allow_comments==true` + 글 존재(미삭제)
- 요청(body): `{ content }`(`@NotBlank`·≤1000). 작성자=주체. `parent_comment_id`=NULL(루트).
- 동작: 댓글 저장 + `post.comment_count` **동일 TX +1**(board-spec §6.1).
- 응답 201: `{ commentPublicId, createdAt }`
- 에러: `POST_001` 글 없음(404), `BOARD_003` 댓글 비허용(422), 검증 400, 401

#### POST /api/v1/posts/{postPublicId}/comments/{commentPublicId}/replies — 답글 작성
- 인증: **필요** + 게시판 `allow_comments==true` + 대상 댓글 존재(미삭제)
- 요청(body): `{ content }`(`@NotBlank`·≤1000). 작성자=주체. 대상 = 경로 `commentPublicId`.
- 동작(board-spec §13.1): 서버가 대상 댓글의 루트를 해석한다 — 대상이 루트면 `parentCommentId=대상.id`·`mentionedNickname=null`; 대상이 답글이면 `parentCommentId=대상.parentCommentId`(루트로 평탄화)·`mentionedNickname=대상.authorNickname`(@멘션). 저장 + 루트 `comment.reply_count` **동일 TX +1** + `post.comment_count` **동일 TX +1**(답글도 총계 포함).
- 응답 201: `{ commentPublicId, createdAt }`
- 에러: `COMMENT_001` 대상 댓글 없음·삭제(404), `POST_001` 글 없음(404), `BOARD_003` 댓글 비허용(422), 검증 400, 401

#### PUT /api/v1/posts/{postPublicId}/comments/{commentPublicId} — 댓글·답글 수정
- 인증: **필요** + (작성자 본인) OR `ROLE_ADMIN`. 루트·답글 공통(commentPublicId로 대상).
- 요청(body): `{ content }`. 응답 204
- 에러: `COMMENT_001`(404), `COMMENT_002` 작성자 아님(403), 검증 400, 401

#### DELETE /api/v1/posts/{postPublicId}/comments/{commentPublicId} — 댓글·답글 삭제(soft)
- 인증: **필요** + (작성자 본인) OR `ROLE_ADMIN`
- 동작(board-spec §13.4): soft delete + `post.comment_count` 동일 TX −1. 답글 삭제면 루트 `reply_count` 동일 TX −1. 루트 삭제 시 활성 답글이 있으면 tombstone으로 목록 잔류(마스킹), 없으면 완전 배제.
- 응답 204
- 에러: `COMMENT_001`(404), `COMMENT_002`(403), 401

#### PUT /api/v1/posts/{postPublicId}/comments/{commentPublicId}/reaction — 공감/비공감 토글
- 인증: **필요** + 대상 댓글 존재(미삭제) + **본인 댓글 아님**
- 요청(body): `{ type: <LIKE|DISLIKE> }`(화이트리스트 외 400)
- 동작(board-spec §13.2): 유저당 댓글당 1행(UK). 현재 반응이 요청 type과 같으면 취소(DELETE), 다르면 등록/전환(INSERT/UPDATE). `comment.like_count`/`dislike_count`를 **동일 TX 원자 UPDATE**로 동기화.
- 응답 200: `{ likeCount, dislikeCount, myReaction }` — 반영 후 최종 상태(`myReaction`=null이면 취소됨). 프론트 낙관적 업데이트의 권위 응답.
- 에러: `COMMENT_001` 댓글 없음·삭제(404), `COMMENT_003` 자기 댓글 반응 불가(422), 검증 400, 401

### 6.4 이미지 (board image) — 2단계 업로드 + 오브젝트 스토리지(게이트2 (a) 확정)

이미지는 **오브젝트 스토리지**(로컬=MinIO·운영=S3, 비공개 버킷)에 저장한다. 먼저 업로드해 `imagePublicId`·`url`을 받고, 게시글 작성/수정 시 `imagePublicIds[]`로 귀속한다(board-spec §7). **응답·목록·상세의 `url`은 서버가 읽기 시점에 생성한 presigned GET URL(단기 TTL, 기본 1시간)**이다 — 클라는 이 `url`을 저장·재사용하지 않고 응답마다 갱신값을 쓴다. 이미지는 **첨부 갤러리(`images[]`) 모델**로 렌더하며(본문 이미지·이벤트 배너 = 첨부, `sortOrder` 배치), `content` 본문 TEXT에는 storage URL을 저장하지 않는다(presigned 만료 URL 박힘 방지). 서빙 전략 근거(백엔드 프록시·공개-read 버킷 기각) = board-spec §7.4.

#### POST /api/v1/board-images — 이미지 업로드
- 인증: **필요**. 요청: `multipart/form-data`, 파트 `file`(단일 이미지)
- 제약: 허용 MIME `image/jpeg`·`image/png`·`image/webp`·`image/gif`(실제 콘텐츠 sniff), 최대 5MB.
- 동작: 서버가 검증 → 오브젝트 스토리지에 PUT(object key `board/{yyyy}/{MM}/{imagePublicId}.{ext}`, board-spec §7.3) → `post_image` 생성(`post_id=NULL` 고아·`uploader_id=주체`). 게시글 저장 시 바인딩(§6.2, 업로더==주체 검증).
- 응답 201: `{ imagePublicId, url }` — `url` = presigned GET(즉시 미리보기용, TTL).
- 에러: `IMAGE_001` 지원하지 않는 형식(422), `IMAGE_002` 용량 초과(422), 401

주: 별도 이미지 서빙 엔드포인트(백엔드 프록시 `/raw`)는 **두지 않는다** — 스토리지가 presigned URL로 바이트를 직접 서빙한다(board-spec §7.4). S3/MinIO 동일 코드(endpoint 설정만 상이). 삭제·고아 정리는 `StoragePort.delete(key)`.

### 6.5 인가·배선 요약(구현 참조)

- SecurityConfig: 공개 GET(`/api/v1/boards/**` GET·`/api/v1/posts/*/comments` GET·`/api/v1/posts/*/comments/*/replies` GET) permitAll, 그 외 board 쓰기 경로(게시글·댓글·답글·반응·이미지 업로드)는 `anyRequest().authenticated()`. **반응 토글(`PUT …/reaction`)·답글 작성(`POST …/replies`)은 인증 필요**(공개 GET 패턴이 이들을 삼키지 않도록 HTTP 메서드로 분리 — GET만 permitAll). **이미지 서빙은 앱 경로가 아니라 스토리지 presigned URL이라 별도 permitAll 불요**(백엔드 프록시 없음). **기존 `/notices/**` permitAll 라인은 제거**(notice 폐지, board-spec §8.2). write_policy(ADMIN_ONLY) 세부 게이팅·자기 반응 금지(`COMMENT_003`)는 서비스 계층 판정(URL 패턴만으로 표현 못 함).
- 게이트웨이(D-068): 신규 permitAll GET 경로는 인증 계열이 아니라 auth-rate-limited predicate 등재 대상 아님(닉네임 가용성 선례와 무관). 일반 라우팅으로 충분.

