package com.finalcall.domain.item.entity;

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
 * 특수스킬 정의 마스터 엔티티(item, FC-020) — 인스턴스 스킬 슬롯1/2가 참조(erd §4.3).
 *
 * <p>고정 시드(Flyway) 마스터. 외부 식별자는 원게임 스킬 ID {@code skill_code}(100~435)이며
 * {@code public_id}를 두지 않는다(spec §2.2). soft delete 없음. 컨벤션(CLAUDE.md §5) 준수.
 */
@Entity
@Getter
@Table(name = "skill_definition")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SkillDefinition extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "skill_code", nullable = false, unique = true)
    private int skillCode;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 255)
    private String description;

    @Builder
    private SkillDefinition(int skillCode, String name, String description) {
        this.skillCode = skillCode;
        this.name = name;
        this.description = description;
    }
}
