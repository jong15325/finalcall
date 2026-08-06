package com.finalcall.domain.board.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseCreatedEntity;
import com.finalcall.common.util.Ulid;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 게시글 이미지 첨부 엔티티(EPIC-BOARD, FC-200) — 2단계 업로드(업로드=고아 → 게시글 저장 시 바인딩). erd §4.5 · board-spec §2.4·§7.
 *
 * <p>파일 실체는 오브젝트 스토리지(MinIO 로컬·S3 운영)에 있고 이 엔티티는 메타·object key({@code storageKey})만 보유한다.
 * append 원장이라 {@code updated_at} 이 없다({@link BaseCreatedEntity} 상속, item_ownership_history 선례) — 바인딩은 논리
 * 상태 변경이나 별도 갱신 시각을 두지 않는다(스키마 정본, erd §4.5 주). soft delete 없음(게시글 삭제 시 함께 정리·고아는 sweeper).
 *
 * <p>컨벤션(CLAUDE.md §5): {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}(private)·{@code @Setter} 금지 →
 * 상태 변경은 도메인 메서드({@link #assignToPost}·{@link #unbind})로만. {@code postId} 는 nullable(업로드 시점 NULL=고아,
 * 게시글 저장 시 바인딩·재귀속 금지). {@code uploaderId} 는 NOT NULL(고아 정리·바인딩 인가 주체). {@code storageKey}·
 * {@code contentType}·{@code fileSize}·{@code uploaderId}·{@code publicId} 는 불변({@code updatable=false}) — 바인딩이
 * 바꾸는 건 {@code postId}·{@code sortOrder} 뿐이다.
 */
@Entity
@Getter
@Table(name = "post_image")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PostImage extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    // 업로드 시점 NULL(고아), 게시글 저장 시 바인딩(재귀속 금지) — 언바인딩(수정 시 누락분)으로 다시 NULL 될 수 있어 updatable.
    @Column(name = "post_id")
    private Long postId;

    @Column(name = "uploader_id", nullable = false, updatable = false)
    private Long uploaderId;

    @Column(name = "storage_key", nullable = false, updatable = false, length = 255)
    private String storageKey;

    @Column(name = "original_filename", updatable = false, length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, updatable = false, length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false, updatable = false)
    private long fileSize;

    // 게시글 내 표시 순서 — 바인딩 시 배열 순서로 세팅, 수정 시 재정렬되므로 updatable.
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Builder
    private PostImage(String publicId, Long postId, Long uploaderId, String storageKey, String originalFilename,
        String contentType, long fileSize, int sortOrder) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.postId = postId;
        this.uploaderId = uploaderId;
        this.storageKey = storageKey;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.sortOrder = sortOrder;
    }

    /** 아직 어떤 게시글에도 귀속되지 않은 고아인지(바인딩 대상 판정). */
    public boolean isOrphan() {
        return postId == null;
    }

    /** 이 이미지가 주어진 게시글에 이미 바인딩돼 있는지(수정 시 유지·재정렬 판정). */
    public boolean isBoundTo(Long targetPostId) {
        return targetPostId != null && targetPostId.equals(postId);
    }

    /** 주어진 사용자가 이 이미지를 업로드했는지(바인딩 인가 — 업로더만 자기 이미지 귀속, board-spec I-1). */
    public boolean isUploadedBy(Long userId) {
        return userId != null && userId.equals(uploaderId);
    }

    /**
     * 게시글에 바인딩하고 표시 순서를 세팅한다(도메인 메서드). 고아→바인딩(생성) 또는 같은 글 내 재정렬(수정)에 쓴다.
     * 재귀속 금지(다른 글에 바인딩된 이미지 이동)는 서비스 계층 인가에서 차단한다(board-spec I-1).
     */
    public void assignToPost(Long targetPostId, int order) {
        this.postId = targetPostId;
        this.sortOrder = order;
    }

    /** 게시글에서 언바인딩한다(수정 시 최종 집합에서 누락된 이미지 → 다시 고아, 물리 정리는 sweeper). */
    public void unbind() {
        this.postId = null;
        this.sortOrder = 0;
    }
}
