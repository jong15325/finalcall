package com.finalcall.domain.notice;

import com.finalcall.domain.common.BaseEntity;
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
 * 공지사항 엔티티(Stage D) — 도메인 코드 컨벤션 참조 구현.
 *
 * <p>@NoArgsConstructor(PROTECTED), 생성자에 @Builder(private), @Setter 금지 → 도메인 메서드로만 상태 변경.
 * soft delete({@code isDeleted}). 시각/작성자 필드는 {@link BaseEntity} 가 자동 관리(F1: createdBy/modifiedBy).
 */
@Entity
@Getter
@Table(name = "notice")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notice extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 2000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NoticeType type;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted;

    @Builder
    private Notice(String title, String content, NoticeType type) {
        this.title = title;
        this.content = content;
        this.type = type;
        this.isDeleted = false;
    }

    /** 내용 수정(도메인 메서드). @Setter 대신 사용. */
    public void update(String title, String content, NoticeType type) {
        this.title = title;
        this.content = content;
        this.type = type;
    }

    /** soft delete. */
    public void delete() {
        this.isDeleted = true;
    }
}
