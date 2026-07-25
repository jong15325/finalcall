package com.finalcall.domain.shop.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseTimeEntity;
import com.finalcall.common.util.Ulid;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.member.entity.User;

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
 * 고정가 애그리거트(shop, EPIC-SHOP) — 판매자·출품 아이템(에스크로) + 고정 판매가·상태·기한(erd §4.2, shop-spec §2).
 *
 * <p>상태 전이는 CAS UPDATE(리포지토리 {@code @Modifying})가 단일 진실원이다(domain-spec §8 "정합성은 DB").
 * 구매(SOLD)·취소(CANCELLED)·만료(EXPIRED)는 모두 조건부 CAS({@code WHERE status='ACTIVE' ...})로만 수행하므로
 * 엔티티에 dirty-checking 전이 메서드를 두지 않는다({@code @Setter} 금지, CLAUDE.md §5). soft delete 없음(종료
 * 상태로 보존) → {@link BaseTimeEntity}(created_at/updated_at)만 상속한다.
 *
 * <p>{@code endAt} 은 nullable 이다 — 등록 시 서버가 {@code now + 설정 일수} 로 자동 계산해 항상 채운다(shop-spec
 * §3.1). NULL(무기한)은 향후 "무기한 노출 캐시아이템" 전용이며 만료 워커가 {@code end_at IS NOT NULL} 로 스캔에서
 * 제외한다(§4.4). {@code result_type} 개념은 없다(입찰 없는 즉시 SOLD 라 경매의 BID/BUYNOW 구분이 불요).
 */
@Entity
@Getter
@Table(name = "shop")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Shop extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id", nullable = false, updatable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_instance_id", nullable = false, updatable = false)
    private ItemInstance itemInstance;

    @Column(name = "price", nullable = false, updatable = false)
    private long price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ShopStatus status;

    @Column(name = "end_at")
    private Instant endAt;

    @Column(name = "item_name_snapshot", nullable = false, length = 100)
    private String itemNameSnapshot;

    @Column(name = "item_spec_snapshot", nullable = false, length = 255)
    private String itemSpecSnapshot;

    @Builder
    private Shop(String publicId, User seller, ItemInstance itemInstance, long price, ShopStatus status,
        Instant endAt, String itemNameSnapshot, String itemSpecSnapshot) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.seller = seller;
        this.itemInstance = itemInstance;
        this.price = price;
        this.status = status;
        this.endAt = endAt;
        this.itemNameSnapshot = itemNameSnapshot;
        this.itemSpecSnapshot = itemSpecSnapshot;
    }
}
