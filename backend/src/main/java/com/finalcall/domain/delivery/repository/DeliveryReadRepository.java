package com.finalcall.domain.delivery.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import org.springframework.stereotype.Repository;

import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.delivery.entity.QItemDelivery;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.QItemInstance;
import com.finalcall.domain.item.entity.QItemTemplate;
import com.finalcall.domain.item.entity.QSkillDefinition;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;

import lombok.RequiredArgsConstructor;

/**
 * 구매자 배송 상태 조회 전용 QueryDSL 리포지토리(delivery, FC-192 — 읽기 전용). FC-186 {@link ItemDeliveryRepository}
 * (쓰기·enqueue·claim/sweeper 소비면)의 시그니처를 건드리지 않도록 조회 전용 쿼리를 <b>독립 리포지토리</b>로 분리한다.
 *
 * <p>배송 행은 게임 boundary 용 자족 스냅샷만 보유하고(type_code·level·skill 코드 등, delivery-domain-spec §6.2)
 * 웹 표시용 표시명·스킬명·item_instance public_id 는 담지 않는다. 그래서 목록 매핑을 위해 (1) 수령자 스코프 커서
 * 페이지로 배송을 뽑고, (2) 그 배송들의 대상 item_instance 를 template·skill fetch join 으로 배치 로드한다(2쿼리, N+1
 * 없음). item_instance 조회는 read-only cross-feature(settlement→item 선례, delivery→item 비순환)이다.
 */
@Repository
@RequiredArgsConstructor
public class DeliveryReadRepository {

    private static final QItemDelivery DELIVERY = QItemDelivery.itemDelivery;
    private static final QItemInstance INSTANCE = QItemInstance.itemInstance;
    private static final QItemTemplate TEMPLATE = QItemTemplate.itemTemplate;
    private static final QSkillDefinition SKILL1 = new QSkillDefinition("deliverySkill1");
    private static final QSkillDefinition SKILL2 = new QSkillDefinition("deliverySkill2");

    private final JPAQueryFactory queryFactory;

    /**
     * 내 배송 목록 커서 페이지(계약 §4.6.1) — {@code recipient_user_id=주체} 스코프(IDOR 설계 차단) + status 선택
     * 필터 + keyset 커서. {@code (created_at desc, id desc)} 로 정렬하고 hasNext 판단을 위해 {@code size+1} 건을
     * over-fetch 한다. {@code (recipient_user_id, status)} 인덱스를 커버한다(erd §5).
     *
     * @param recipientUserId 수령 구매자 PK(=주체). 이 스코프 밖 배송은 애초에 조회되지 않는다
     * @param statusFilter    상태 필터(null=전체)
     * @param cursorCreatedAt 커서 경계 created_at(null=첫 페이지)
     * @param cursorId        커서 경계 id(null=첫 페이지)
     * @param size            페이지 크기(호출 측이 경계로 정규화)
     * @return size+1 로 over-fetch 한 배송 목록(매핑·슬라이싱은 호출 측 CursorResponse 가 담당)
     */
    public List<ItemDelivery> findPageByRecipient(
        Long recipientUserId, DeliveryStatus statusFilter, Instant cursorCreatedAt, Long cursorId, int size) {
        return queryFactory.selectFrom(DELIVERY)
            .where(
                DELIVERY.recipientUserId.eq(recipientUserId),
                statusEq(statusFilter),
                keyset(cursorCreatedAt, cursorId))
            .orderBy(DELIVERY.createdAt.desc(), DELIVERY.id.desc())
            .limit((long)size + 1) // hasNext 판단을 위해 한 건 더
            .fetch();
    }

    /**
     * 배송 대상 item_instance 를 id 집합으로 배치 로드한다 — template·skill1·skill2 를 to-one fetch join 해
     * 표시 블록({@link com.finalcall.domain.item.dto.ItemSummaryResponse}) 구성 시 lazy 접근·N+1 을 없앤다
     * (OSIV off). 빈 입력이면 {@code IN ()} 렌더를 피해 쿼리 자체를 생략한다.
     */
    public List<ItemInstance> findItemInstancesByIds(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return queryFactory.selectFrom(INSTANCE)
            .join(INSTANCE.template, TEMPLATE).fetchJoin()
            .leftJoin(INSTANCE.skill1, SKILL1).fetchJoin()
            .leftJoin(INSTANCE.skill2, SKILL2).fetchJoin()
            .where(INSTANCE.id.in(ids))
            .fetch();
    }

    private BooleanExpression statusEq(DeliveryStatus statusFilter) {
        return statusFilter == null ? null : DELIVERY.status.eq(statusFilter);
    }

    /** keyset cursor 경계 — {@code created_at desc, id desc} 정렬과 정확히 일치한다(어긋나면 페이징 버그). */
    private BooleanExpression keyset(Instant cursorCreatedAt, Long cursorId) {
        if (cursorId == null) {
            return null;
        }
        return DELIVERY.createdAt.lt(cursorCreatedAt)
            .or(DELIVERY.createdAt.eq(cursorCreatedAt).and(DELIVERY.id.lt(cursorId)));
    }
}
