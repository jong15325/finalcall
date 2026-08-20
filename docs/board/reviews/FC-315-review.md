# FC-315 리뷰

- 판정: PASS
- 심각도: critical 0 / major 0 / minor 0
- 검토자: reviewer
- 검토일: 2026-08-18

## 확인
- Pretendard Variable 2.06MB 단일 파일을 제거하고 공식 동적 서브셋 CSS를 앱 엔트리에서 사용한다.
- production 산출물은 `unicode-range`와 `font-display: swap`이 지정된 self-hosted WOFF2 조각 92개를 생성하며 외부 CDN을 요청하지 않는다.
- 전역 sans 스택과 의도적인 `.font-mono`, 경매 시간 monospace가 유지된다.
- 계약 테스트가 전역 import, Pretendard 우선순위, swap, unicode-range, 비-CDN, monospace 보존을 검증한다.
- typecheck, 대상 테스트 4건, 직접 Vite production build가 통과했다.

## 비차단 기준선
- 표준 `npm run build`는 FC-315과 무관한 기존 WalletBalance 워크벤치 guard 위반으로 Vite 실행 전에 중단된다. 직접 Vite build로 FC-315 production 변환을 검증했으므로 본 티켓 승인 차단 사유로 보지 않는다.
