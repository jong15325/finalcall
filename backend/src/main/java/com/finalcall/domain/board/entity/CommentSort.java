package com.finalcall.domain.board.entity;

import java.util.Locale;

import org.springframework.data.domain.Sort;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 루트 댓글 목록 정렬 화이트리스트(EPIC-COMMENT-V2, api §6.3 · board-spec §13.3). 임의 컬럼·SQL 표면적을 차단하기 위해
 * enum 으로만 허용한다(B-006, ShopSort·AuctionSort 선례). 화이트리스트 외 값은 {@code COMMON_001}(400).
 *
 * <p>기본은 {@link #LATEST}(최신순, 게이트2 사용자 확정 2026-08-06 — 초안 LIKES 에서 변경). 정렬 키 ↔ 인덱스 1:1(erd §5):
 * {@code LATEST}/{@code OLDEST} 는 {@code (post_id, parent_comment_id, id)} 가 정·역방향 커버, {@code LIKES} 는
 * {@code (post_id, parent_comment_id, like_count)} 가 커버한다. 답글 목록은 이 정렬을 쓰지 않는다(항상 id asc 고정).
 *
 * <p>{@code LIKES}(순공감 정렬)와 BEST 고정 랭킹은 FC-209 에서 완성됐다({@code CommentService.getBestComments}).
 */
public enum CommentSort {

    /** 최신순(기본) — id DESC. */
    LATEST(Sort.by(Sort.Order.desc("id"))),
    /** 과거순(작성순) — id ASC. */
    OLDEST(Sort.by(Sort.Order.asc("id"))),
    /** 순공감순 — like_count DESC, id DESC(동점 최신 우선). */
    LIKES(Sort.by(Sort.Order.desc("likeCount"), Sort.Order.desc("id")));

    /** 기본 정렬(최신순, 게이트2 확정). */
    public static final CommentSort DEFAULT = LATEST;

    private final Sort sort;

    CommentSort(Sort sort) {
        this.sort = sort;
    }

    /** 이 정렬의 Spring Data {@link Sort}(엔티티 속성 기준). Pageable 에 실어 JPQL ORDER BY 로 반영된다. */
    public Sort toSort() {
        return sort;
    }

    /**
     * 정렬 파라미터를 해석한다. null·공백은 기본값({@link #LATEST}), 화이트리스트 외 값은 {@code COMMON_001}(400)로 거부한다
     * (api §6.3 "화이트리스트 외 400"). 대소문자 무시.
     */
    public static CommentSort from(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT;
        }
        try {
            return CommentSort.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }
}
