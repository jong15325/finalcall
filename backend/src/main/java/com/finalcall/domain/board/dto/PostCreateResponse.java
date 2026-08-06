package com.finalcall.domain.board.dto;

import com.finalcall.domain.board.entity.Post;

/**
 * 게시글 작성 응답(EPIC-BOARD, api §6.2 {@code POST /boards/{slug}/posts} 201). 계약 형상 {@code { postPublicId }}.
 * 생성된 글의 외부 식별자만 반환한다(상세는 별도 GET).
 */
public record PostCreateResponse(String postPublicId) {

    public static PostCreateResponse from(Post post) {
        return new PostCreateResponse(post.getPublicId());
    }
}
