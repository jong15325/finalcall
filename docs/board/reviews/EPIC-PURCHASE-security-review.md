# EPIC-PURCHASE 온دي맨드 보안 리뷰 (에픽 완료 직전)

검토: 2026-07-22 · 대상 = 즉시구매·거래내역(FC-089 backend + FC-090 frontend) · single-shot LLM 보안 패스(§13)

## 판정: **고신뢰(≥8) 취약점 0건**

사용자 트리거 엔드포인트(POST purchase·GET orders) 신규 표면을 검토 — 전부 방어됨.

## 검토 영역·제외 사유
- **IDOR/인가**: 요청자를 `SecurityContextHolder`에서 도출(경로/파라미터 신뢰 안 함) — 구매자 위조 불가. 거래내역 목록 `buyer_id=me OR seller_id=me` 스코프, 상세 당사자 검증(ORDER_002 403). SecurityConfig: purchase·orders 전부 인증 강제(permitAll GET은 `/auctions/*` 단일세그먼트라 2세그먼트 purchase POST와 무교차).
- **SQL injection**: SaleOrderRepositoryImpl QueryDSL 타입세이프 바인딩(문자열 연결·동적 정렬 없음). SaleOrderCursor.decode = Base64 + Instant.parse/Long.valueOf(Java 역직렬화 없음)·손상 시 400·keyset 경계로만 바인딩(스코프 우회 불가).
- **민감정보**: fee/settle = seller일 때만 값·`@JsonInclude(NON_NULL)`로 구매자 응답 필드 부재. 상대 마스킹·public_id ULID·loginId 미노출.
- **입력 검증**: role/sourceType enum 화이트리스트(비화이트리스트 400). 즉시구매 금액 서버 buyNowPrice 확정(클라 금액 미신뢰). 자기구매 AUCTION_009 차단.
- **시크릿·역직렬화·XSS**: 시크릿 0. React 텍스트 렌더(unsafe 싱크 없음). 프론트 showsSellerAccounting은 방어적 이중방어.

## 결론
에픽 완료 보안 게이트 통과. 원격 CI는 push 후 GitHub Actions 이중화.
