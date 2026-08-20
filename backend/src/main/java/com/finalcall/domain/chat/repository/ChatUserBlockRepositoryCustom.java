package com.finalcall.domain.chat.repository;

import java.util.Collection;
import java.util.List;

import com.finalcall.domain.chat.entity.ChatUserBlock;

/** 방 목록·상세의 양방향 차단 상태를 일괄 조회하는 QueryDSL 계약. */
public interface ChatUserBlockRepositoryCustom {

    List<ChatUserBlock> findBetweenUserAndCounterparts(Long userId, Collection<Long> counterpartIds);
}
