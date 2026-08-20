package com.finalcall.domain.chat.realtime;

import org.springframework.stereotype.Component;

/** 커밋된 outbox의 허용 metadata만 Redis로 복사해 CDC 지연과 독립된 fast-path를 제공한다. */
@Component
public class ChatOutboxFastPathPublisher {

    private final ChatRedisFanoutPublisher fanoutPublisher;

    public ChatOutboxFastPathPublisher(ChatRedisFanoutPublisher fanoutPublisher) {
        this.fanoutPublisher = fanoutPublisher;
    }

    public boolean publish(ChatOutboxFastPathEvent event) {
        return fanoutPublisher.publish(event.metadataJson());
    }
}
