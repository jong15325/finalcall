# 리서치 — 웹 애플리케이션 ↔ 라이브 게임 서버 인벤토리 통합

- 작성: 2026-08-06 (deep-research 워크플로우, 22소스·85주장→25검증·23확정·2기각)
- 목적: EPIC-ITEM-DELIVERY phase-2 방향(통합 A vs 다리 B vs 하이브리드) 결정을 위한 업계 레퍼런스 조사.
- 결론 요약: **업계 표준 = 단일 writer 권위(게임 서버가 인벤 유일 writer) + 우편함/claim 비동기 배송.** 우리가 만든 배송(B)이 정답, 통합(A)은 업계가 피하는 안티패턴. **→ B 채택(사용자 확정 2026-08-06).**

## TL;DR
공유 인벤 테이블에 웹·게임이 **직접 같이 쓰는 방식(통합 A)은 업계 표준이 아니다.** 표준은 (i) 게임 서버가 인벤을 유일하게 쓰고(웹은 권한 채널로 위임), (ii) exactly-once는 호출자 idempotency key로, (iii) 온라인 플레이어 충돌은 낙관적 동시성(ETag→412→재시도) **또는 더 강하게 플레이어ID 키 우편함으로 라이브 세션을 아예 안 건드림**, (iv) 프로세스 간 배송은 게임 코어가 drain하는 우편함/아웃박스로.

## 검증된 핵심 패턴 (전부 3-0 만장일치)
1. **단일 writer 권위** — 게임 서버가 인벤 유일 writer, 웹/외부는 직접 쓰지 않고 위임.
   - Steam: 인벤 쓰기는 publisher 키·"보안 서버에서만, 클라 직접 불가". (partner.steamgames.com/doc/webapi/iinventoryservice)
   - TrinityCore(C++ WoW 에뮬): 공식 웹 도구가 캐릭터 DB에 직접 안 쓰고 서버에 위임 → 서버가 mail 지급. (github.com/TrinityCore/minimanager mail.php, cs_send.cpp)
2. **멱등 지급** — idempotency key로 재시도 중복 방지(Steam·PlayFab IdempotencyId·Hiro claimed_at). 우리 item_uuid UK가 이것.
3. **온라인 충돌 해법** — (약) 낙관적 동시성 ETag/412/재시도(PlayFab Economy v2); (강·권장) **우편함을 플레이어 GUID로 키잉해 라이브 세션 인벤을 안 건드림 → 경쟁 제거**(TrinityCore cs_send.cpp: MailReceiver, 인벤이 아니라 mail row로 INSERT).
4. **멱등 ≠ 동시성 제어** — 별개 메커니즘, 한 요청에 혼용 금지(재시도 의미 충돌, PlayFab 명시).
5. **우편함/아웃박스 claim-later** — 게임 밖에서 플레이어 도달 표준(Hiro Reward Mailbox·TrinityCore .send). 아이템은 mail 테이블에 착지, 접속 시 drain.

## 가장 닮은 사례 — TrinityCore (우리 구성과 동일)
C++ MMO 서버 + 공유 MySQL + 외부 웹 도구. 웹은 우편함 위임만, **서버가 유일 writer로 mail 지급**. 인벤 직접 쓰기는 3개 테이블(mail·mail_item·item_instance)+GUID 할당 수동관리라 일부러 회피. → 우리 배송(B) 설계와 정확히 일치. 단, 명령 채널(SOAP/telnet)은 멱등/ack이 없어 앱 레벨 ack 필요.

## 큰 사례
- **WoW 컴패니언 앱 / EVE ESI**: 웹이 권위 경제 거래를 시작할 수 있으나 **좁힌 쓰기 부분집합(읽기+구매)만** 출시. 낙찰품은 인게임 우편함 배송. (WoW RAH는 2011→2018 폐지→2022 재도입 이력 — "가능 패턴"으로만 취급.)
- **RuneScape 그랜드 익스체인지**: 비동기 체결, 결과는 인벤 직접 삽입 아니라 **수거함(collect)**에서 회수(secondary 위키).
- **⚠️ Diablo 3 RMAH**: 기술 아니라 **경제 설계로 실패**. 디렉터 "게임을 해쳤다, 끌 수 있으면 끄겠다"(GDC 2013). **함정: 배관만이 아니라 경제 설계도 검증.**

## 기각(제외)
- "Steam이 인벤 유일 권위자라 게임이 자체 아이템 서버를 안 돎"(0-3, 서버-권위 모델도 있음).
- "TrinityCore가 온·오프라인 구분을 전혀 안 함"(1-2, 온라인 수신자는 인메모리 mail 캐시 갱신 차이).

## 우리 상황 적용 함의 (A/B/하이브리드 재판정)
| 안 | 판정 |
|---|---|
| (A) 완전 통합 — 웹·게임이 같은 라이브 인벤 행 쓰기 | ❌ 업계가 피하는 안티패턴(온라인 충돌·게임 대공사) |
| (B) 우편함 + 게임 claim (우리가 만든 것) | ✅ 업계 표준(TrinityCore 동일구성·Steam·PlayFab·Hiro·WoW·RuneScape) |
| 하이브리드 — 읽기만 공유 | ⭕ 허용(단일 writer 원칙 정합: 읽기 뷰 공유, 쓰기·배송은 우편함) |

**채택 = B + phase-2(게임 서버가 우편함을 유일 writer로서 drain).** 배송 에픽 자산 그대로. 통합 A는 접음.

## 열린 질문(phase-2에서 답할 것)
1. 공유 MySQL에서 게임 인메모리 캐시가 웹이 쓴 우편함 행을 언제 집어가나(접속 drain vs 폴 vs 알림 — 우리 Redis 알림 자리).
2. 결제/정산 웹훅 재전달 대비 멱등키 저장 위치.
3. 경매 정산 양면 원자성(구매자 차감+판매자 지급+배송).
4. 웹이 라이브 경제에 아이템 주입 시 안티사기(값 상한·감사).

## 소스 (quality)
- primary: Steamworks Inventory Service/Inventory, PlayFab Economy v2 ETag/concurrency(Microsoft Learn), Heroic Labs Hiro Mailbox, TrinityCore cs_send.cpp·minimanager mail.php·trinitycore.info SOAP, EVE ESI intro, WoW Companion AH(Blizzard news).
- secondary/blog: RuneScape 위키 GE, Diablo3 RMAH 사후분석(PureDiablo·Engadget·TheGamer·GameDeveloper), microservices.io/event-driven.io 아웃박스 패턴, hackernoon authoritative MMO data models.

## 주의(caveats)
강한 발견(단일 writer·멱등·ETag 동시성·우편함 배송)은 1차 문서 기반 3-0 만장일치. 약한 것: RuneScape는 커뮤니티 위키(secondary)·"아웃박스" 라벨은 아키텍처 유추, Diablo3 평결은 언론(secondary·다수 tier-1). PlayFab ETag 지침은 구현 특정. **조사된 어떤 시스템도 "C++ MMO가 공유 관계형 DB를 웹 스택과 동시 쓰기"는 아님 — TrinityCore(공유 MySQL·웹 도구가 서버 위임)가 최근접·최중요 유사물.**
