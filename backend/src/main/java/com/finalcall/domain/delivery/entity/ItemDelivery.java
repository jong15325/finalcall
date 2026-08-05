package com.finalcall.domain.delivery.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseCreatedEntity;
import com.finalcall.common.util.Ulid;

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
 * 게임 아이템 지급 우편함 엔티티(delivery, EPIC-ITEM-DELIVERY) — 장터 낙찰(SOLD)·즉시구매(BUYNOW) 아이템을 게임
 * 캐릭터 인벤토리({@code new_sp.user_item})로 도착시키는 finalcall-native 내구 우편함(다리, erd §4.4·delivery-domain-spec §7).
 *
 * <p><b>append-only 원장</b> — enqueue(PENDING)로 생성되고 상태 시각은 {@code claimedAt}/{@code appliedAt} 이 담으므로
 * updated_at 을 두지 않는다({@link BaseCreatedEntity} 상속, item_ownership_history·platform_revenue_ledger 선례).
 * soft delete 없음(배송은 소멸이 아니라 상태 전이). {@code @Setter} 금지 → 상태는 도메인 메서드로만 전이한다.
 *
 * <p><b>★ 자족 스냅샷(D-C·§6.2)</b> — 게임 boundary 가 claim 시 이 행의 값만으로 {@code user_item} 을 완전 재패킹할
 * 수 있도록 {@code typeCode}·{@code level}·{@code skill1Code}·{@code skill2Code}·{@code skillPercent}·{@code gfExpireAt}·
 * {@code itemUuid}·{@code recipientUserId}·{@code recipientNickname} 를 자체 보유한다(item_instance 참조에 의존하지 않는다 —
 * 이후 item_instance 가 변해도 배송은 불변·내구). 그래서 FK(sale_order·item_instance·recipient)는 관계 매핑 대신 원시
 * 식별자로만 보유한다(item_ownership_history 선례). 게임 boundary 번역(itm_skill 재패킹·level−1·usr_id 매핑)은 전적으로
 * 게임 서버 소속이며 웹은 좌측 정본 값을 실을 뿐이다(§6.2·§12.2).
 *
 * <p><b>쓰기 소유자(§5.4)</b> — enqueue(웹)·claim/apply/defer(게임 DB-direct CAS §5.2)·리스 재청구/하드 실패(웹)로
 * 나뉜다. 게임 소유 전이(claim/apply/defer)의 <b>정본 경로는 게임 서버의 조건부 CAS SQL</b>(단일 승자, §5.2·후속 별건
 * §12.2)이고, 아래 동명 메서드는 상태 머신을 엔티티로 모델링한 최소 구현이다(현재상태 가드 = CAS WHERE 절 대응). 웹이
 * 소유하는 재청구(sweeper)·하드 실패는 FC-188 이 조건부 CAS(@Modifying)로 구현한다(erd §5).
 */
@Entity
@Getter
@Table(name = "item_delivery")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ItemDelivery extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Column(name = "sale_order_id", nullable = false, unique = true, updatable = false)
    private Long saleOrderId;

    @Column(name = "item_instance_id", nullable = false, updatable = false)
    private Long itemInstanceId;

    @Column(name = "recipient_user_id", nullable = false, updatable = false)
    private Long recipientUserId;

    @Column(name = "recipient_nickname", nullable = false, updatable = false, length = 16)
    private String recipientNickname;

    // erd 정합: item_uuid 는 CHAR(40) 멱등키. 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "item_uuid", nullable = false, unique = true, updatable = false, length = 40)
    private String itemUuid;

    @Column(name = "type_code", nullable = false, updatable = false)
    private int typeCode;

    @Column(name = "level", nullable = false, updatable = false)
    private int level;

    @Column(name = "skill1_code", updatable = false)
    private Integer skill1Code;

    @Column(name = "skill2_code", updatable = false)
    private Integer skill2Code;

    @Column(name = "skill_percent", nullable = false, updatable = false)
    private int skillPercent;

    @Column(name = "gf_expire_at", updatable = false)
    private Instant gfExpireAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private DeliveryStatus status;

    @Column(name = "claim_token", length = 40)
    private String claimToken;

    @Column(name = "claimed_at")
    private Instant claimedAt;

    @Column(name = "applied_at")
    private Instant appliedAt;

    @Builder
    private ItemDelivery(String publicId, Long saleOrderId, Long itemInstanceId, Long recipientUserId,
        String recipientNickname, String itemUuid, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.saleOrderId = saleOrderId;
        this.itemInstanceId = itemInstanceId;
        this.recipientUserId = recipientUserId;
        this.recipientNickname = recipientNickname;
        this.itemUuid = itemUuid;
        this.typeCode = typeCode;
        this.level = level;
        this.skill1Code = skill1Code;
        this.skill2Code = skill2Code;
        this.skillPercent = skillPercent;
        this.gfExpireAt = gfExpireAt;
        // enqueue = 정산 TX 꼬리에서 PENDING 으로 태어난다(§7.3·D-A). 다른 상태로 태어나는 경로가 없다.
        this.status = DeliveryStatus.PENDING;
    }

    /**
     * 게임 claim(PENDING/DEFERRED → CLAIMED, 리스 획득) — CAS 단일 승자 모델링(§5.2 (2)). 정본 경로는 게임 서버의
     * 조건부 CAS SQL 이며 이 메서드는 상태 머신 대응.
     *
     * @return 청구 성립이면 true, 이미 다른 상태(경합 패자·종착)면 false(무부작용 skip)
     */
    public boolean claim(String claimToken, Instant now) {
        if (status != DeliveryStatus.PENDING && status != DeliveryStatus.DEFERRED) {
            return false;
        }
        this.status = DeliveryStatus.CLAIMED;
        this.claimToken = claimToken;
        this.claimedAt = now;
        return true;
    }

    /**
     * 게임 apply 성공 ack(CLAIMED → APPLIED, 종착) — 토큰 대조 CAS(§5.2 (4)). 만료 토큰의 뒤늦은 ack 는 여기서 무시된다.
     *
     * @return 적용 성립이면 true, 상태 불일치·토큰 불일치면 false
     */
    public boolean apply(String claimToken, Instant now) {
        if (status != DeliveryStatus.CLAIMED || !matchesClaimToken(claimToken)) {
            return false;
        }
        this.status = DeliveryStatus.APPLIED;
        this.appliedAt = now;
        return true;
    }

    /**
     * 게임 만실 defer(CLAIMED → DEFERRED, 안전 보관) — 토큰 대조 CAS(§5.2 (5)). 슬롯 확보·재접속 시 재청구된다(유실 없음).
     *
     * @return 보류 성립이면 true, 상태·토큰 불일치면 false
     */
    public boolean defer(String claimToken) {
        if (status != DeliveryStatus.CLAIMED || !matchesClaimToken(claimToken)) {
            return false;
        }
        this.status = DeliveryStatus.DEFERRED;
        return true;
    }

    /**
     * 리스 만료 재청구(CLAIMED → PENDING, 웹 sweeper §5.4·§9.1) — 게임 크래시로 CLAIM~APPLY 사이 중단된 리스를 회수한다.
     * 리스 만료 판정(claimed_at &lt; now−lease)은 sweeper 조회(FC-188)가 담당하고, 이 메서드는 전이만 수행한다. 재청구가
     * at-least-once 의 원천이며 이중 지급은 item_uuid UK 로 무해화된다(D-D·D-E).
     *
     * @return 회수 성립이면 true, CLAIMED 가 아니면 false
     */
    public boolean reclaim() {
        if (status != DeliveryStatus.CLAIMED) {
            return false;
        }
        this.status = DeliveryStatus.PENDING;
        this.claimToken = null;
        this.claimedAt = null;
        return true;
    }

    /**
     * 하드 실패 격리(→ FAILED, 웹/관리자 §7.1·§9.1) — 스펙 불량·계정 밴·매핑 불가 usr_id. <b>금전 미역전</b>(D-G):
     * 판매는 이미 완결됐고 아이템은 우편함/커스터디에 안전 보관되므로 역전하지 않는다. 종착 상태(APPLIED·FAILED)는 격리 불가.
     *
     * @return 격리 성립이면 true, 이미 종착이면 false
     */
    public boolean fail() {
        if (status.isTerminal()) {
            return false;
        }
        this.status = DeliveryStatus.FAILED;
        return true;
    }

    private boolean matchesClaimToken(String claimToken) {
        return this.claimToken != null && this.claimToken.equals(claimToken);
    }
}
