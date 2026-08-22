---
id: EPIC-CHAT-UNREAD
type: epic
jira_key: KAN-392
title: 채팅 미읽음 배지 실시간 동기화
state: done
children: [FC-347, FC-348, FC-349, FC-350, FC-351]
gate: null
---

## 목표
- 송신자의 상단 채팅 배지가 증가하지 않고 수신자의 배지가 실시간으로 증가하도록 서버 권위 unread와 전역 실시간 이벤트를 동기화한다.
- 로그인 세션당 채팅 실시간 연결을 하나로 공유하고 재연결·polling으로 최종 수렴한다.

## 하위 티켓과 의존
- FC-347: 전역 실시간 연결·unread 동기화 계약 확정.
- FC-348: AppShell 범위 단일 채팅 실시간 coordinator 구현.
- FC-349: 상단·사이드바 채팅 배지 서버 권위 동기화.
- FC-350: ChatWorkspace 중복 연결 제거와 회귀 테스트.
- FC-351: 보안·재연결·접근성·QA 통합 리뷰.

## 게이트
- 게이트1: 2026-08-22 사용자 승인 완료.
- 게이트2: 2026-08-22 사용자 승인 완료. 기존 REST·이벤트·DB 스키마 유지, AppShell 단일 연결 토폴로지 확정.
- 게이트3: reviewer 통과 후 사용자 Done·커밋 승인 필요.
- FC-351 reviewer 최종 판정 PASSED. 사용자 Done·커밋 승인 대기.
- 게이트3: 2026-08-22 사용자 Done·통합 atomic commit 승인 완료.
