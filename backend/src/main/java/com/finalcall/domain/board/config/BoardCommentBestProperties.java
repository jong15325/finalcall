package com.finalcall.domain.board.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Positive;

/**
 * BEST 댓글 선정 임계·개수 정책(EPIC-COMMENT-V2, FC-209 · board-spec §13.3 · api §6.3).
 *
 * <p>BEST 댓글은 루트 댓글 중 {@code like_count >= minLikes} 인 것을 {@code (like_count − dislike_count) DESC, id DESC}
 * 로 정렬해 상위 {@code maxCount} 건 노출한다. 이 두 값은 컴파일 상수가 아니라 <b>관리자 조정 설정</b>이라
 * ({@code ShopListingProperties}·{@code FeePolicyProperties} 선례) {@code @ConfigurationProperties} + {@code @Validated}
 * 로 바인딩한다(CLAUDE.md §4 — 하드코딩 금지). 데모 트래픽에 맞춰 낮출 수 있다(board-spec §13.3). 권장 기본 min-likes=3·
 * max-count=3. 값이 비었거나 0 이하면 <b>부팅이 실패</b>한다(조용한 기본값 대체 금지).
 */
@Validated
@ConfigurationProperties(prefix = "board.comment.best")
public record BoardCommentBestProperties(

    /** BEST 선정 최소 공감 수(임계). 루트 댓글의 {@code like_count} 가 이 값 이상이어야 BEST 후보다. 권장 기본 3. */
    @Positive int minLikes,

    /** BEST 노출 최대 개수(상위 N). 랭킹 상위 이 개수까지만 반환한다. 권장 기본 3. */
    @Positive int maxCount) {
}
