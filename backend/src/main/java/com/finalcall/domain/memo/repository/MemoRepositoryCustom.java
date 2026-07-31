package com.finalcall.domain.memo.repository;

import java.util.List;

import com.finalcall.domain.memo.entity.Memo;
import com.finalcall.domain.memo.entity.MemoCursor;

/**
 * 메모 커서 목록 계약(memo, QueryDSL 구현은 {@link MemoRepositoryImpl}). 삭제(is_deleted=true)는 제외하고 {@code id DESC}로
 * 안정 정렬한다. hasNext 판단을 위해 {@code size+1} 건을 조회한다(over-fetch, 서비스가 슬라이싱).
 */
public interface MemoRepositoryCustom {

    /** 받은함(receiver=me AND 미삭제, id DESC). */
    List<Memo> findReceivedByCursor(Long receiverId, MemoCursor cursor, int size);

    /** 보낸함(sender=me AND 미삭제, id DESC). */
    List<Memo> findSentByCursor(Long senderId, MemoCursor cursor, int size);
}
