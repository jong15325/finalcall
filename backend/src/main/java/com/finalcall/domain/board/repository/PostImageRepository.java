package com.finalcall.domain.board.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.domain.board.entity.PostImage;

/**
 * 게시글 이미지 리포지토리(EPIC-BOARD, FC-200). erd §5 인덱스 정합 — 갤러리 순서 조회는 {@code (post_id, sort_order)},
 * 바인딩 단건은 {@code public_id} UK.
 *
 * <p>바인딩 인가·고아 판정은 서비스가 로드한 엔티티로 수행한다(업로더==주체·고아만·재귀속 금지, board-spec §7.1·I-1).
 */
public interface PostImageRepository extends JpaRepository<PostImage, Long> {

    /** public_id 단건(바인딩 대상 로드). 인가·고아·재귀속 판정은 서비스가 엔티티로 한다. */
    Optional<PostImage> findByPublicId(String publicId);

    /** 게시글 갤러리 순서 조회(상세 images·수정 시 현재 바인딩 집합). {@code (post_id, sort_order)} 인덱스 커버. */
    List<PostImage> findByPostIdOrderBySortOrderAsc(Long postId);

    /** 여러 게시글의 이미지를 순서대로(목록 썸네일 배치 — 글당 첫 이미지 선택). postId asc·sortOrder asc 안정 정렬. */
    List<PostImage> findByPostIdInOrderByPostIdAscSortOrderAsc(Collection<Long> postIds);
}
