package com.finalcall.domain.chat.repository;

import static com.finalcall.domain.chat.entity.QChatRoom.chatRoom;

import java.time.Instant;
import java.util.List;

import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.entity.QChatRoomMemberState;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/** 방 목록의 안정 keyset과 참여자별 unread 합계를 계산하는 QueryDSL 구현. */
@RequiredArgsConstructor
public class ChatRoomRepositoryImpl implements ChatRoomRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<ChatRoom> findParticipantRoomsByCursor(Long userId, Instant cursorActivityAt, Long cursorId,
        int size) {
        QChatRoomMemberState memberState = new QChatRoomMemberState("listMemberState");
        return queryFactory.selectFrom(chatRoom)
            .join(memberState).on(memberState.roomId.eq(chatRoom.id))
            .where(isParticipant(userId), memberState.userId.eq(userId), memberState.archivedAt.isNull(),
                cursorLt(cursorActivityAt, cursorId))
            .orderBy(chatRoom.lastActivityAt.desc(), chatRoom.id.desc())
            .limit(size + 1L)
            .fetch();
    }

    @Override
    public long sumUnreadByUserId(Long userId) {
        QChatRoomMemberState memberState = new QChatRoomMemberState("unreadMemberState");
        Long count = queryFactory
            .select(chatRoom.lastSequence.subtract(memberState.lastReadSequence).sum())
            .from(chatRoom)
            .join(memberState).on(memberState.roomId.eq(chatRoom.id))
            .where(isParticipant(userId), memberState.userId.eq(userId))
            .fetchOne();
        return count != null ? count : 0L;
    }

    private BooleanExpression isParticipant(Long userId) {
        return chatRoom.memberLowId.eq(userId).or(chatRoom.memberHighId.eq(userId));
    }

    private BooleanExpression cursorLt(Instant activityAt, Long id) {
        if (activityAt == null || id == null) {
            return null;
        }
        return chatRoom.lastActivityAt.lt(activityAt)
            .or(chatRoom.lastActivityAt.eq(activityAt).and(chatRoom.id.lt(id)));
    }
}
