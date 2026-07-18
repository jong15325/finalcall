package com.finalcall.domain.item;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.util.Ulid;
import com.finalcall.domain.common.BaseTimeEntity;
import com.finalcall.domain.member.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 개별 아이템 엔티티(item, FC-021) — 템플릿 FK + 레벨·스킬 2슬롯·발동확률·골드포스 + 소유자 + 위치(erd §4.3).
 *
 * <p>위치 디스크리미네이터(플래그 B)는 {@link ItemLocation} 단일 진실원이며, 위치 전이는 전용 도메인 메서드로만
 * 수행한다(spec §3.1, {@code @Setter} 금지). soft delete 없음(소유 이전·이력 보존 모델, G10) → 시각만 감사하는
 * {@link BaseTimeEntity} 상속. slot 유일성은 DB 생성 컬럼 UK({@code slot_key}, V8)가 최종 강제하며 엔티티에는
 * 매핑하지 않는다(읽기·쓰기 대상 아님, spec §3.2).
 */
@Entity
@Getter
@Table(name = "item_instance")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ItemInstance extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private ItemTemplate template;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    private int level;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill1_id")
    private SkillDefinition skill1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skill2_id")
    private SkillDefinition skill2;

    @Column(name = "skill_percent", nullable = false)
    private int skillPercent;

    @Column(name = "gf_expire_at")
    private Instant gfExpireAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ItemLocation location;

    @Column(name = "slot_no")
    private Integer slotNo;

    @Builder
    private ItemInstance(String publicId, ItemTemplate template, User owner, int level, SkillDefinition skill1,
        SkillDefinition skill2, int skillPercent, Instant gfExpireAt, ItemLocation location, Integer slotNo) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.template = template;
        this.owner = owner;
        this.level = level;
        this.skill1 = skill1;
        this.skill2 = skill2;
        this.skillPercent = skillPercent;
        this.gfExpireAt = gfExpireAt;
        this.location = location;
        this.slotNo = slotNo;
    }

    /** 요청 주체가 현재 소유자인지(주체=SecurityContext 로 얻은 내부 PK, IDOR 방지). */
    public boolean isOwnedBy(Long userId) {
        return owner.getId().equals(userId);
    }

    /**
     * 정규 인벤토리 슬롯에 배치(FC-022, relocate·복귀). location INVENTORY + slot_no 세팅을 원자적으로 수행한다.
     * slot 유일성의 최종 방어선은 DB slot_key UK(spec §3.2)다.
     */
    public void placeInInventory(int slotNo) {
        this.location = ItemLocation.INVENTORY;
        this.slotNo = slotNo;
    }

    /** 임시보관으로 이동(FC-022). location TEMP + slot_no 해제(연계 temp_storage 행은 서비스가 동일 TX 로 관리). */
    public void moveToTemp() {
        this.location = ItemLocation.TEMP;
        this.slotNo = null;
    }

    /** 출품(에스크로)으로 이동. location LISTED + slot_no 해제. 실제 LISTED 전이는 auction/shop 에픽 소유. */
    public void markListed() {
        this.location = ItemLocation.LISTED;
        this.slotNo = null;
    }
}
