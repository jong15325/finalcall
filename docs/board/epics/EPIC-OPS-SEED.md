---
id: EPIC-OPS-SEED
type: epic
jira_key: KAN-419
title: 운영형 20인 시나리오 데이터 구축
state: review
children: [FC-370, FC-371, FC-372, FC-373, FC-374, FC-375, FC-376, FC-377, FC-378, FC-379, FC-380]
gate: null
---
## 목표
- 배포 환경에서 실제 거래·소셜 흐름을 검증할 수 있는 20인 운영형 데이터를 안전하고 멱등하게 주입한다.

## 분해안 (게이트1 승인 2026-08-24)
- FC-370: 운영형 시드 계약 확정 — architect
- FC-371: 안전 실행기 구현 — backend-impl
- FC-372: 페르소나·아이템 fixture 구현 — backend-impl
- FC-373: 상거래 fixture 구현 — backend-impl
- FC-374: 소셜 fixture 구현 — backend-impl
- FC-375: 검증·정리기 구현 — backend-impl
- FC-376: 통합 리뷰와 배포 DB 적용 검증 — reviewer/main

## 완료 기준
- `docs/spec/operations-seed-spec.md`의 건수와 불변식을 충족한다.
- dry-run, 멱등 no-op, 외부 참조 cleanup 거부가 검증된다.
- reviewer 통과 후 현재 Docker DB에 단발 주입하고 API/UI smoke를 통과한다.

## v2 파생 작업
- FC-377: 단순 계정·전체 타입 노출 계약 확정 — architect
- FC-378: v2 사용자·아이템·listing fixture 구현 — backend-impl
- FC-379: v1→v2 안전 전환·검증 구현 — backend-impl
- FC-380: v2 통합 리뷰와 배포 재적용 — reviewer/main
