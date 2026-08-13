# EPIC-DESIGN-WORKBENCH 보안 리뷰

- 일자: 2026-08-13
- 판정: PASS
- 심각도: critical 0 / major 0 / minor 2

## 통과 근거

- `import.meta.env.DEV` 조건과 lazy import 경계가 유지되며 production route는 기존 not-found로 귀결된다.
- production build에서 route·scenario·fixture·dummy token·사용자 marker 잔존 0건을 확인했다.
- scenario와 variant는 정적 registry·allowlist로만 결정되어 pathname/query로 임의 모듈이나 권한 주체를 주입할 수 없다.
- fixture는 실제 사용자 토큰을 제거하고 auth·balance·unread 상태를 이탈 시 복원한다.
- 서버 인가 우회, IDOR, JWT 검증 약화, 실제 운영 데이터 쓰기, 시크릿 노출은 발견되지 않았다.

## 비차단 후속 항목

1. 실제 AppShell 상호작용 중 로그아웃·창 focus 재조회가 개발 서버 네트워크 요청을 만들 수 있다. fixture token은 고정 dummy이고 production에는 잔존하지 않아 현재 위험은 낮다.
2. production 역의존 guard가 template literal 기반 dynamic import를 추출하지 못한다. 현재 production graph에는 해당 import가 없고 artifact 잔존도 없지만 향후 방어 심화가 필요하다.

두 항목은 dev-only 방어 심화 수준이며 에픽 완료를 차단하지 않는다.
