package com.finalcall.domain.delivery.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 배송 best-effort 알림 발행기(delivery, FC-189 · delivery-domain-spec §3.3 하이브리드) — 게임이 빈 폴을 돌리지
 * 않도록 정산 커밋 후 {@code delivery:{recipientUserId}} 채널에 경량 신호를 PUBLISH 한다.
 *
 * <p><b>커밋 후 발행(왜 {@code AFTER_COMMIT}인가)</b> — {@link DeliveryEnqueuedEvent} 는 정산 TX 안에서 발행되지만
 * 이 리스너는 {@link TransactionPhase#AFTER_COMMIT} 라 <b>정산이 실제 커밋된 뒤에만</b> 신호를 쏜다. TX 안에서
 * 발행하면 롤백 시에도 신호가 나가 "판매 없는데 배송 신호"(유령 신호)가 생긴다 — 그걸 원천 차단한다(§3.3). 기본
 * {@code fallbackExecution=false} 라 활성 TX 가 없으면 리스너가 아예 실행되지 않아, 커밋 없는 발행 경로가 구조적으로
 * 없다. {@code @EventListener} 계열이라 프록시 self-invocation 함정과 무관하다(외부 빈 경유, CLAUDE.md §4).
 *
 * <p><b>실패 무해(정확성 무영향)</b> — 정본은 DB 우편함이고 Redis 는 알림 전용이다(bid-spec §8: DB=정확성,
 * Redis=처리량). 발행 실패(Redis 다운 등)는 <b>로깅만</b> 하고 삼킨다 — 정산·배송 정확성에 전파되지 않는다. 최악은
 * "다음 안전망 폴/다음 접속까지 지연"이며 아이템 유실은 없다(§3.3). 커밋 후 동기 콜백에서 예외를 던지면 이미 커밋된
 * 트랜잭션 위로 예외가 relay 되므로, 여기서 잡지 않으면 정산 호출자에게 무의미한 예외가 새어 나간다 — 반드시 잡는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryNotifier {

    /** Redis pub/sub 신호 채널 접두(delivery-spec §10.2 (4)). 게임이 {@code delivery:{recipientUserId}} 를 구독한다. */
    private static final String CHANNEL_PREFIX = "delivery:";

    private final StringRedisTemplate redisTemplate;

    /**
     * 정산 커밋 후 배송 신호를 best-effort 로 발행한다. 발행 실패는 정확성에 무관하므로 로깅만 하고 삼킨다(§3.3).
     *
     * @param event enqueue 된 배송의 수령자 식별자를 실은 도메인 이벤트
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDeliveryEnqueued(DeliveryEnqueuedEvent event) {
        String channel = CHANNEL_PREFIX + event.recipientUserId();
        try {
            redisTemplate.convertAndSend(channel, String.valueOf(event.recipientUserId()));
        } catch (RuntimeException ex) {
            // best-effort: 정본=DB, Redis=알림. 발행 실패는 안전망 폴/접속 시 claim 이 덮으므로 정확성 무영향(§3.3).
            log.warn("배송 알림 발행 실패(무해·정확성 무영향) — 채널 {}. 안전망 폴/접속 claim 이 배송을 보증한다", channel, ex);
        }
    }
}
