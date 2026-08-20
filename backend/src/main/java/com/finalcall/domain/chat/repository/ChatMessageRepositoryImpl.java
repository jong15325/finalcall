package com.finalcall.domain.chat.repository;

import static com.finalcall.domain.chat.entity.QChatMessage.chatMessage;

import java.util.Collection;
import java.util.List;

import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.QChatMessage;
import com.querydsl.jpa.JPAExpressions;
import com.querydsl.jpa.impl.JPAQuery;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/** 방별 sequence 인덱스를 정·역방향으로 사용하는 메시지 replay QueryDSL 구현. */
@RequiredArgsConstructor
public class ChatMessageRepositoryImpl implements ChatMessageRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<ChatMessage> findPage(Long roomId, Long beforeSequence, Long afterSequence, int size) {
        JPAQuery<ChatMessage> query = queryFactory.selectFrom(chatMessage)
            .where(chatMessage.roomId.eq(roomId));
        if (afterSequence != null) {
            return query.where(chatMessage.roomSequence.gt(afterSequence))
                .orderBy(chatMessage.roomSequence.asc())
                .limit(size + 1L)
                .fetch();
        }
        if (beforeSequence != null) {
            query.where(chatMessage.roomSequence.lt(beforeSequence));
        }
        return query.orderBy(chatMessage.roomSequence.desc())
            .limit(size + 1L)
            .fetch();
    }

    @Override
    public List<ChatMessage> findLatestRetainedByRoomIds(Collection<Long> roomIds) {
        if (roomIds.isEmpty()) {
            return List.of();
        }
        QChatMessage latest = new QChatMessage("latestRetainedMessage");
        return queryFactory.selectFrom(chatMessage)
            .where(chatMessage.roomId.in(roomIds),
                chatMessage.roomSequence.eq(JPAExpressions.select(latest.roomSequence.max())
                    .from(latest)
                    .where(latest.roomId.eq(chatMessage.roomId))))
            .fetch();
    }
}
