package com.finalcall.domain.item;

import com.finalcall.common.entity.BaseTimeEntity;

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
 * 아이템 정의 마스터 엔티티(item, FC-020) — 타입코드 정규화(대분류·중분류·속성·종류) + 표시명(erd §4.3).
 *
 * <p>고정 시드(Flyway) 마스터라 등급 축이 없고(D-073) soft delete 도 없다(spec §2.1). 외부 식별자는
 * {@code type_code}(자리값 합성, 035)이며 {@code public_id}를 두지 않는다. 컨벤션(CLAUDE.md §5):
 * {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}·{@code @Setter} 금지.
 */
@Entity
@Getter
@Table(name = "item_template")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ItemTemplate extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "main_category", nullable = false)
    private int mainCategory;

    @Column(name = "sub_group", nullable = false)
    private int subGroup;

    @Column(nullable = false)
    private int element;

    @Column(nullable = false)
    private int kind;

    // 자리값 합성 외부 식별자(035). (main,sub,element,kind) 조합과 함께 UK.
    @Column(name = "type_code", nullable = false, unique = true)
    private int typeCode;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Builder
    private ItemTemplate(int mainCategory, int subGroup, int element, int kind, int typeCode, String displayName) {
        this.mainCategory = mainCategory;
        this.subGroup = subGroup;
        this.element = element;
        this.kind = kind;
        this.typeCode = typeCode;
        this.displayName = displayName;
    }
}
