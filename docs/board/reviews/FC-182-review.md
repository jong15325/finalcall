# FC-182 (EPIC-CARD-SYSTEM T4) 리뷰 — CardInfoDialog 정본 셸

- **대상**: 카드정보 모달 셸 정본화(`CardInfoDialog`) + Shop/Inventory 포크 리팩터 + CSS·channelLimit shop→item 승격
- **리뷰어**: reviewer(읽기 전용) · **일자**: 2026-08-04
- **판정**: **PASS** (critical 0 / major 0 / minor 1) → `review_status: passed`
- **특이**: 하네스 "killed" 오보 후 에이전트 계속 실행·완료. 총괄 실행중 되돌리기(git restore/rm)를 에이전트가 감지·재적용 → **디스크 최종본 완결·정합, 되돌리기 잔재 0**(reviewer 중점 확인).

## 근거
1. **완결성·잔재** — stale import 0(삭제된 shop CSS/channelLimit 실임포트 없음, 잔존은 주석뿐). 삭제 2파일 물리 제거. **승격=이동**: `item/lib/channelLimit.ts`=HEAD shop diff 완전 동일, `CardInfoDialog.css`=규칙 전량 동일(헤더 주석만 추가, `.shop-cardinfo*` 클래스 픽셀 보존 위해 유지). 반쪽 적용 없음.
2. **마켓 시각·a11y 무회귀** — DOM 바이트 동일(ci-title→ci-scroll[속성표 5행·스킬·belowScroll=판매자]→ci-foot[footer=판매가+CTA]→overlay=구매확인). 모달 배선(focus trap·scroll lock·Esc·backdrop·언마운트 포커스 복원·[inert]/disabled 스킵) 셸 계승 라인 일치. **슬롯 seam(§2.4)**: 구매 뮤테이션·잔액·isOwn·step·confirmRef는 shop 소비자 잔류(셸 미결합), confirmRef는 overlay 슬롯 경유로 dialogRef 내부 렌더→focus trap 포착, backgroundInert로 배경 초점 누출 차단.
3. **크로스 임포트 → item 단방향(§9.2)** — member→shop·shop 자체 카드정보 CSS/channelLimit 임포트 제거, 셸이 유일 임포트처.
4. **aria-labelledby** — `cardInfoTitle` 통일(구 shop/inventory id 잔존 0, 동시 마운트 1개).
5. **테스트** — vitest item/shop/member 34파일 291 green(ShopCardInfoDialog 8·InventoryCardInfoDialog 5, 구매확인→성공/SHOP_005 실패·판매등록→onSell 포함), tsc·eslint clean.
6. **과설계 없음** — 슬롯 최소(belowScroll?·footer·overlay?·backgroundInert?), 소비자=얇은 어댑터.

## Minor (비차단·위생)
- **M1**: `CardInfoDialog.tsx:156` prettier 줄바꿈 권고(81자). eslint max-len off라 미강제·선존 베이스라인 드리프트(20+ 기존 파일 동일). → **커밋 전 prettier 적용함**(해당 1파일만).

## 변경/신설/삭제
- 신설: `item/components/CardInfoDialog.tsx`·`CardInfoDialog.css`, `item/lib/channelLimit.ts`.
- 변경: `shop/components/ShopCardInfoDialog.tsx`(505→~300), `member/components/InventoryCardInfoDialog.tsx`(287→~80).
- 삭제: `shop/components/ShopCardInfoDialog.css`, `shop/lib/channelLimit.ts`.
