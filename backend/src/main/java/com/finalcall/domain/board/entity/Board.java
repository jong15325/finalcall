package com.finalcall.domain.board.entity;

import com.finalcall.common.entity.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 게시판 레지스트리 엔티티(EPIC-BOARD) — 하드코딩 enum(구 {@code NoticeType}) 대신 DB 레코드로 게시판을 정의한다.
 * 코드 수정 없이 게시판을 추가·변경할 수 있고, 게시판마다 쓰기 정책·댓글 허용·유형을 옵션으로 갖는다.
 *
 * <p>{@code slug}가 URL 키·외부 식별자(사람이 읽는 well-known 키, category 성격)라 {@code public_id}(ULID)를 두지 않는다.
 * soft delete 를 도입하지 않고 {@code isActive} 토글로 "삭제"하므로 slug 재사용 충돌이 없다(D-081 패턴 불요).
 *
 * <p>@NoArgsConstructor(PROTECTED), 생성자에 @Builder(private), @Setter 금지 — 이번 에픽은 시드로만 생성하며 런타임
 * 변경(관리자 CRUD)은 다음 에픽이라 상태 변경 도메인 메서드를 아직 두지 않는다(컬럼·제약은 향후 INSERT/UPDATE 를 견딘다).
 * 시각 필드는 {@link BaseTimeEntity}가 관리한다.
 */
@Entity
@Getter
@Table(name = "board")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Board extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50, unique = true)
    private String slug;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 200)
    private String description;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "is_active", nullable = false)
    private boolean isActive;

    @Enumerated(EnumType.STRING)
    @Column(name = "write_policy", nullable = false, length = 20)
    private WritePolicy writePolicy;

    @Column(name = "allow_comments", nullable = false)
    private boolean allowComments;

    @Enumerated(EnumType.STRING)
    @Column(name = "board_type", nullable = false, length = 20)
    private BoardType boardType;

    @Builder
    private Board(String slug, String name, String description, int sortOrder, boolean isActive,
        WritePolicy writePolicy, boolean allowComments, BoardType boardType) {
        this.slug = slug;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
        this.isActive = isActive;
        this.writePolicy = writePolicy;
        this.allowComments = allowComments;
        this.boardType = boardType;
    }
}
