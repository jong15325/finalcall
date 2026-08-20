package com.finalcall.domain.chat.repository;

import static com.finalcall.domain.chat.entity.QChatUserBlock.chatUserBlock;

import java.util.Collection;
import java.util.List;

import com.finalcall.domain.chat.entity.ChatUserBlock;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/** 현재 사용자와 방 상대들 사이의 방향성 차단 행을 한 번에 읽는 QueryDSL 구현. */
@RequiredArgsConstructor
public class ChatUserBlockRepositoryImpl implements ChatUserBlockRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<ChatUserBlock> findBetweenUserAndCounterparts(Long userId, Collection<Long> counterpartIds) {
        if (counterpartIds.isEmpty()) {
            return List.of();
        }
        return queryFactory.selectFrom(chatUserBlock)
            .where(chatUserBlock.blockerId.eq(userId).and(chatUserBlock.blockedId.in(counterpartIds))
                .or(chatUserBlock.blockedId.eq(userId).and(chatUserBlock.blockerId.in(counterpartIds))))
            .fetch();
    }
}
