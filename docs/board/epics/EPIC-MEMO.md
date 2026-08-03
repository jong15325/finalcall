---
id: EPIC-MEMO
type: epic
jira_key: KAN-191
title: 메모/쪽지 (게임 호환 네이티브 도메인)
state: done
children: [FC-170, FC-171, FC-172, FC-173]
gate: null
---

> **게이트1 승인(2026-08-01)**: 4티켓 분해·의존 구조 사용자 승인. architect(FC-170) 착수는 **게임 DB 전수 조사(`docs/spec/proposals/game-db-survey.md`) 완료 후** 시작(레벨/성별·인벤토리 정합을 조사가 확정).

## 목표
회원 간 메모/쪽지(메시지)를 finalcall 안에 **네이티브 도메인**으로 구축한다. 게임 원본 `new_sp.user_memo` 형상을 계승하되 finalcall 컨벤션(feature-first §5)으로 재구성하고, 게임 클라이언트 고정 계약(28바이트 고정폭 렌더링·`레벨×100+성별` 패킹)은 **boundary 포맷터**로 흡수한다. 양방향(발신+열람). 우편함 클레임 패턴의 본보기 정립(향후 아이템 지급 연동으로 확장). 실시간 채팅은 범위 밖(추후).

## 분해 (병렬)
FC-170 계약(architect) → 백엔드 **FC-171** ∥ 프론트 **FC-172**(계약 확정 후 동시, 백/프론트 파일 무교차) → **FC-173** 리뷰.
FC-172는 새 화면이라 **디자인 게이트 선행**.

## 핵심 결정 (FC-170에서 게이트2 상신 후보)
1. **레벨·성별 소스** — 게임 `memo_level_gender = usr_level×100 + usr_gender` 요구. finalcall `user`엔 레벨·성별 없음 → 추가 vs 스냅샷 vs 기본값(0). 전수 조사 결과 반영.
2. **바이트 포맷 저장 방식** — 안 A(깔끔 저장 + 전송 시 boundary 패딩, 웹UI 친화·추천) vs 안 B(레거시식 사전 패딩 저장, 서버 변경 최소).
3. **신규 테이블 스키마** — `user_memo` finalcall 재구성(컬럼 정리·`memo_msg` 용량 보존·수신자=nickname), Flyway V20.

## 제약·참조
- **게임 연동 원칙**([[game-db-integration-model]]): 통합 스키마(단일 정본)·읽기 통합/쓰기 소유자 규칙·서버 재컴파일 가능/클라 고정. 메모 쓰기 주인=웹, 게임은 읽기/상태.
- **바이트 포맷**([[game-memo-byte-format]]): 28바이트 고정폭(숫자·영문=1, 그외=2), `레벨×100+성별` 패킹. `GetStringByteManager` 이식(레거시 `D:\Java\JAVA_210228\웹 소스\201213\KSPWEB-master`).
- **수신자 검증**: nickname=게임계정명(char16 vs finalcall nickname VARCHAR30 길이 정합). 게임 user 존재 검사.
- **보안**: IDOR(주체=SecurityContext·남의 메모 열람/삭제 차단)는 reviewer(FC-173) 최종 판정.
