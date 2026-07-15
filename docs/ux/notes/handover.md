# 디자인 handover (2026-07-14)

진행 중
- 게임 외 웹 페이지 레이아웃 와이어프레임(색 없이 구조) 단계. auth(로그인·회원가입)·지갑 완료.
- 다음: 판매등록(/sell), 상거래 카드(게임 이미지 슬롯 + 웹 정보) 구조. 순서 = 구조 확정 → 토큰·색.

대기 중 (내 SENT, 회신·블로커)
- outbox/008 (auth 폼 미확정 2건: 비밀번호 확인 필드 포함 여부·인증 성공 후 이동) → 기획(P) 회신 대기. 수신처 PF→P 정정됨(D-079).
- outbox/004 (비주얼 방향 A/B/C 재제시) → 사용자 직접 논의 예정(047), 미확정. 추천 A(Dark Arena) 유지, 최종은 총괄+사용자.
- 게임 카드·인벤토리 이미지 = 사용자 제공 대기(U-012). 도착 전엔 웹 래퍼 구조만 설계 가능.

휘발성 맥락 (파일에 없는 판단)
- 범위 분담(U-012): 게임 자산(카드·인벤토리·데이터 비주얼)=사용자 차용·이미지 제공. 웹 레이어(상거래 카드 래퍼·게임 외 페이지·공통 요소)=디자인.
- 경계(U-013): 기능 정의(요소·필드·플로우)=기획(P), 레이아웃부터=디자인.
- 작업 원칙(사용자 지시): 계약·명세 밖/모르는 것은 임의 판단 금지 → 기획(P)로 결정 요청 격상. 채팅 보고는 상세 나열 대신 요지+4줄 브리핑.
- 등급(grade) 제거 완료(D-073, U-004 SUPERSEDED→U-010). 상류 조율=기획(P)(D-079, U-011 SUPERSEDED).

재개 필독 (순서대로)
1. docs/ux/notes/handover.md (이 파일)
2. docs/ux/decision-log.md (U-001~013 상태) · inbox-log.md (처리 이력)
3. docs/api-contract.md v1.2 (§2 auth · §3.3 응답 스키마)
4. docs/frontend-planning/screen-spec.md (기능 명세, 현 기획 P 소유)
5. docs/ux/design-system.md · ux-flows.md · mockups/ (wireframe-auth·wireframe-wallet·visual-directions)

재개 방법: 킥오프 부트스트랩 + "handover 읽고 재개" → 첫 응답은 이해 확인 브리핑.
