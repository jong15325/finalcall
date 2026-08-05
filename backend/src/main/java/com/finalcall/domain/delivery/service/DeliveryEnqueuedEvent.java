package com.finalcall.domain.delivery.service;

/**
 * 배송 우편함 enqueue(PENDING) 도메인 이벤트(delivery, FC-189) — 정산 TX 내에서 배송 1행이 태어난 직후
 * {@link SettlementRecorder 정산 공통 꼬리}가 발행한다. 실제 소비(Redis best-effort 알림)는
 * <b>정산 TX 커밋 후</b>({@link DeliveryNotifier} · {@code AFTER_COMMIT})에만 일어난다 — 롤백 시 유령 신호를
 * 원천 차단하려는 배선이다(delivery-domain-spec §3.3).
 *
 * <p>이벤트는 프로세스 내부 신호일 뿐 영속·직렬화 계약이 아니다(그래서 dto 가 아니라 service 에 둔다). 채널은
 * {@code delivery:{recipientUserId}} 라 수령자 식별자만 실으면 충분하다 — 게임 서버가 이 채널을 구독해 빈 폴을
 * 제거하고, 신호가 유실돼도(Redis 다운) 저빈도 안전망 폴 + 접속 시 claim 이 정확성을 보증한다(§3.3·bid-spec §8).
 *
 * @param recipientUserId 수령 구매자 PK(= item_delivery.recipient_user_id = 신호 채널 키)
 */
public record DeliveryEnqueuedEvent(Long recipientUserId) {
}
