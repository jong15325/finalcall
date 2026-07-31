package com.finalcall.domain.memo.repository;

import static com.finalcall.domain.memo.entity.QMemo.memo;

import java.util.List;

import com.finalcall.domain.memo.entity.Memo;
import com.finalcall.domain.memo.entity.MemoCursor;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 메모 커서 목록 QueryDSL 구현(memo). 관례상 {@code <Repository>Impl} 네이밍으로 Spring Data 가 자동 결합한다.
 *
 * <p>정렬 키 = {@code id DESC}(단조 AI = 발신 시각 역순, erd §7.2). 커서 경계는 {@code id.lt(cursor)}로 keyset
 * 페이지네이션을 구성한다(offset 미사용 — 대규모 목록 안정성). 받은함/보낸함은 스코프 컬럼만 다르다(receiver/sender).
 */
@RequiredArgsConstructor
public class MemoRepositoryImpl implements MemoRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Memo> findReceivedByCursor(Long receiverId, MemoCursor cursor, int size) {
        return queryFactory.selectFrom(memo)
            .where(memo.receiverId.eq(receiverId), memo.isDeleted.isFalse(), cursorLt(cursor))
            .orderBy(memo.id.desc())
            .limit(size + 1L) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    @Override
    public List<Memo> findSentByCursor(Long senderId, MemoCursor cursor, int size) {
        return queryFactory.selectFrom(memo)
            .where(memo.senderId.eq(senderId), memo.isDeleted.isFalse(), cursorLt(cursor))
            .orderBy(memo.id.desc())
            .limit(size + 1L)
            .fetch();
    }

    /** 첫 페이지면 조건 제외, 아니면 경계 id 미만(id DESC keyset). */
    private BooleanExpression cursorLt(MemoCursor cursor) {
        return cursor.isFirstPage() ? null : memo.id.lt(cursor.id());
    }
}
