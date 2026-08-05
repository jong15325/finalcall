package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.entity.SkillDefinition;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.item.repository.SkillDefinitionRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 구매자 배송 상태 조회 API 통합 검증(delivery, FC-192) — 실제 MySQL(Testcontainers) + Security 필터.
 * delivery-domain-spec §10.1·계약 §4.6.1 을 응답 본문으로 고정한다.
 *
 * <p><b>본인 격리(IDOR)</b> — 목록은 recipient=주체 스코프라 타인 배송이 새지 않고, 상세는 비당사자·미존재를 모두
 * {@code DELIVERY_001}(404)로 통일한다. <b>커서 페이지네이션</b> 은 중복·누락 없이 전건을 넘긴다. <b>내부 리스
 * 메커니즘</b>({@code claimToken}·{@code claimedAt})은 응답 본문에 어떤 형태로도 새지 않는다. 다른 테스트 템플릿과
 * 충돌하지 않도록 <b>93xx 대역</b>을 쓴다.
 */
@Transactional
class DeliveryQueryApiIntegrationTest extends IntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EntityManager em;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private SkillDefinitionRepository skillDefinitionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private int saleOrderSeq = 930_000;

    @Test
    void 목록은_본인_배송만_노출한다() throws Exception {
        User me = persistUser("dlq_iso_me", "수령자");
        User other = persistUser("dlq_iso_other", "타인");
        persistDelivery(me, persistItem(me, 9301), me, DeliveryStatus.PENDING);
        persistDelivery(other, persistItem(other, 9302), other, DeliveryStatus.PENDING);
        flushClear();

        mockMvc.perform(get("/api/v1/me/deliveries").with(user(String.valueOf(me.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].status").value("PENDING"));
    }

    @Test
    void 상세와_목록은_아이템_요약과_배송_필드를_계약대로_노출한다() throws Exception {
        User me = persistUser("dlq_shape_me", "형상수령");
        SkillDefinition skill1 = skill(9311, "치명타");
        SkillDefinition skill2 = skill(9312, "흡혈");
        ItemInstance item = persistItem(me, 9303, 5, skill1, skill2, 30, null);
        ItemDelivery delivery = persistDelivery(me, item, me, DeliveryStatus.APPLIED);
        // 표시명·스킬명은 typeCode/skillCode find-or-create 결과라 전체 suite 에서 앞선 커밋 테스트가 심은 값을 재사용할
        // 수 있다(예: ClosingTestBase 의 "마감템플릿"). 하드코딩 리터럴 대신 실제 심긴 값을 기대치로 캡처해 표시명이
        // 어느 쪽이든 join 매핑 정확성만 단언한다(커밋 오염에 무영향 — 결정값 typeCode·level·코드는 그대로 정밀 단언).
        String expectedDisplayName = item.getTemplate().getDisplayName();
        String expectedSkill1Name = item.getSkill1().getName();
        String expectedSkill2Name = item.getSkill2().getName();
        String itemPublicId = item.getPublicId();
        String deliveryPublicId = delivery.getPublicId();
        flushClear();

        // 목록: 위치(content[0]) 가정 대신 내 deliveryPublicId 로 항목을 찾아 단언한다(전체 suite 커밋 오염 견고성).
        String listBody = mockMvc.perform(get("/api/v1/me/deliveries").with(user(String.valueOf(me.getId()))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode row = findByDeliveryPublicId(listBody, deliveryPublicId);
        assertThat(row.path("status").asText()).isEqualTo("APPLIED");
        assertThat(row.path("itemInstancePublicId").asText()).isEqualTo(itemPublicId);
        assertThat(row.path("appliedAt").isMissingNode()).isFalse();
        JsonNode listItem = row.path("item");
        assertThat(listItem.path("typeCode").asInt()).isEqualTo(9303);
        assertThat(listItem.path("displayName").asText()).isEqualTo(expectedDisplayName);
        assertThat(listItem.path("level").asInt()).isEqualTo(5);
        assertThat(listItem.path("skill1Code").asInt()).isEqualTo(9311);
        assertThat(listItem.path("skill1Name").asText()).isEqualTo(expectedSkill1Name);
        assertThat(listItem.path("skill2Code").asInt()).isEqualTo(9312);
        assertThat(listItem.path("skill2Name").asText()).isEqualTo(expectedSkill2Name);
        assertThat(listItem.path("skillPercent").asInt()).isEqualTo(30);
        // 내부 리스 메커니즘은 미노출(§10.1) — 어떤 형태로도 새지 않는다.
        assertThat(listBody).doesNotContain("claimToken").doesNotContain("claimedAt");

        // 상세: public_id 직접 조회라 오염 불가. 요약 + recipientNickname(당사자 조회라 마스킹 없음).
        String detailBody = mockMvc.perform(
            get("/api/v1/me/deliveries/{id}", deliveryPublicId).with(user(String.valueOf(me.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.deliveryPublicId").value(deliveryPublicId))
            .andExpect(jsonPath("$.data.status").value("APPLIED"))
            .andExpect(jsonPath("$.data.itemInstancePublicId").value(itemPublicId))
            .andExpect(jsonPath("$.data.recipientNickname").value("형상수령"))
            .andExpect(jsonPath("$.data.item.displayName").value(expectedDisplayName))
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(detailBody).doesNotContain("claimToken").doesNotContain("claimedAt");
    }

    @Test
    void 스킬_없는_배송은_스킬_코드와_이름이_null이다() throws Exception {
        User me = persistUser("dlq_noskill_me", "무스킬");
        ItemInstance item = persistItem(me, 9304); // level 1·skill 없음.
        persistDelivery(me, item, me, DeliveryStatus.PENDING);
        flushClear();

        mockMvc.perform(get("/api/v1/me/deliveries").with(user(String.valueOf(me.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].item.skill1Code").doesNotExist())
            .andExpect(jsonPath("$.data.content[0].item.skill1Name").doesNotExist())
            .andExpect(jsonPath("$.data.content[0].item.skill2Code").doesNotExist())
            // 미도착이면 appliedAt 필드 자체가 부재(NON_NULL).
            .andExpect(jsonPath("$.data.content[0].appliedAt").doesNotExist());
    }

    @Test
    void status_필터는_해당_상태만_남긴다() throws Exception {
        User me = persistUser("dlq_filter_me", "필터수령");
        persistDelivery(me, persistItem(me, 9305), me, DeliveryStatus.PENDING);
        persistDelivery(me, persistItem(me, 9306), me, DeliveryStatus.APPLIED);
        persistDelivery(me, persistItem(me, 9307), me, DeliveryStatus.APPLIED);
        flushClear();

        mockMvc.perform(get("/api/v1/me/deliveries").param("status", "APPLIED")
            .with(user(String.valueOf(me.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(2))
            .andExpect(jsonPath("$.data.content[0].status").value("APPLIED"))
            .andExpect(jsonPath("$.data.content[1].status").value("APPLIED"));
    }

    @Test
    void 커서_페이지네이션은_중복_누락없이_전건을_최신순으로_넘긴다() throws Exception {
        User me = persistUser("dlq_page_me", "페이지수령");
        List<String> insertedNewestFirst = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            ItemDelivery saved = persistDelivery(me, persistItem(me, 9310 + i), me, DeliveryStatus.PENDING);
            insertedNewestFirst.add(0, saved.getPublicId()); // 나중 삽입일수록 최신(created desc, id desc) → 앞에 쌓는다.
        }
        flushClear();

        List<String> collected = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 10; page++) { // 안전 상한(무한 루프 방지).
            String url = "/api/v1/me/deliveries?size=2" + (cursor == null ? "" : "&cursor=" + cursor);
            String body = mockMvc.perform(get(url).with(user(String.valueOf(me.getId()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
            JsonNode data = objectMapper.readTree(body).get("data");
            for (JsonNode item : data.get("content")) {
                collected.add(item.get("deliveryPublicId").asText());
            }
            if (!data.get("hasNext").asBoolean()) {
                break;
            }
            cursor = data.get("nextCursor").asText();
        }

        // 전건이 중복·누락 없이, 최신순(reverse-insertion — created desc, id desc)으로 정확히 나온다.
        assertThat(collected).containsExactlyElementsOf(insertedNewestFirst);
    }

    @Test
    void 상세는_타인_배송을_404_DELIVERY_001로_숨긴다() throws Exception {
        User me = persistUser("dlq_403_me", "요청자");
        User other = persistUser("dlq_403_other", "소유자");
        ItemDelivery delivery = persistDelivery(other, persistItem(other, 9320), other, DeliveryStatus.PENDING);
        flushClear();

        mockMvc.perform(
            get("/api/v1/me/deliveries/{id}", delivery.getPublicId()).with(user(String.valueOf(me.getId()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("DELIVERY_001"));
    }

    @Test
    void 없는_배송의_상세는_404_DELIVERY_001() throws Exception {
        User me = persistUser("dlq_nf_me", "조회자");
        flushClear();

        mockMvc.perform(get("/api/v1/me/deliveries/{id}", "NONEXISTENTDELIVERY0000001")
            .with(user(String.valueOf(me.getId()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("DELIVERY_001"));
    }

    // ---------------- helpers ----------------

    /** 응답 목록에서 내 deliveryPublicId 항목을 찾는다(위치 가정 배제 — 전체 suite 커밋 오염 견고성). */
    private JsonNode findByDeliveryPublicId(String body, String deliveryPublicId) throws Exception {
        for (JsonNode node : objectMapper.readTree(body).path("data").path("content")) {
            if (deliveryPublicId.equals(node.path("deliveryPublicId").asText())) {
                return node;
            }
        }
        throw new AssertionError("배송이 목록에 없다: " + deliveryPublicId);
    }

    private ItemDelivery persistDelivery(User recipient, ItemInstance item, User seller, DeliveryStatus target) {
        SaleOrder order = persistSaleOrder(recipient, seller, item);
        ItemDelivery delivery = ItemDelivery.builder()
            .saleOrderId(order.getId())
            .itemInstanceId(item.getId())
            .recipientUserId(recipient.getId())
            .recipientNickname(recipient.getNickname())
            .itemUuid(UUID.randomUUID().toString())
            .typeCode(item.getTemplate().getTypeCode())
            .level(item.getLevel())
            .skill1Code(item.getSkill1() == null ? null : item.getSkill1().getSkillCode())
            .skill2Code(item.getSkill2() == null ? null : item.getSkill2().getSkillCode())
            .skillPercent(item.getSkillPercent())
            .gfExpireAt(item.getGfExpireAt())
            .build();
        transitionTo(delivery, target);
        em.persist(delivery);
        em.flush(); // 개별 flush 로 created_at 을 순차 확보(최신순 정렬 결정성 — id tiebreaker 가 최종 보증).
        return delivery;
    }

    /** PENDING 이 아닌 목표 상태로 엔티티 상태 머신을 전이시킨다(claim/apply/defer/fail — 게임 소유 전이 모델링). */
    private void transitionTo(ItemDelivery delivery, DeliveryStatus target) {
        String token = "tok-" + UUID.randomUUID();
        Instant now = Instant.now();
        switch (target) {
            case PENDING -> { /* builder 기본 상태 */ }
            case CLAIMED -> delivery.claim(token, now);
            case APPLIED -> {
                delivery.claim(token, now);
                delivery.apply(token, now);
            }
            case DEFERRED -> {
                delivery.claim(token, now);
                delivery.defer(token);
            }
            case FAILED -> delivery.fail();
            default -> throw new IllegalArgumentException("미지원 상태: " + target);
        }
    }

    private SaleOrder persistSaleOrder(User buyer, User seller, ItemInstance item) {
        SaleOrder order = SaleOrder.builder()
            .sourceType(SaleOrderSourceType.AUCTION)
            .sourceId((long)saleOrderSeq++)
            .buyer(buyer)
            .seller(seller)
            .itemInstance(item)
            .finalPrice(500_000L)
            .feeAmount(25_000L)
            .settleAmount(475_000L)
            .feePolicyVersion("v1.0")
            .settledAt(Instant.now())
            .build();
        em.persist(order);
        return order;
    }

    private ItemInstance persistItem(User owner, int typeCode) {
        return persistItem(owner, typeCode, 1, null, null, 0, null);
    }

    private ItemInstance persistItem(User owner, int typeCode, int level, SkillDefinition skill1,
        SkillDefinition skill2, int skillPercent, Instant gfExpireAt) {
        ItemInstance item = ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(level)
            .skill1(skill1).skill2(skill2).skillPercent(skillPercent).gfExpireAt(gfExpireAt)
            .location(ItemLocation.INVENTORY).slotNo(null).build();
        em.persist(item);
        return item;
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("배송템플릿").build()));
    }

    /** skill_code 로 find-or-create(마스터는 정리에서 보존되므로 재실행 UK 충돌을 피한다, template() 선례). */
    private SkillDefinition skill(int skillCode, String name) {
        return skillDefinitionRepository.findAll().stream()
            .filter(definition -> definition.getSkillCode() == skillCode)
            .findFirst()
            .orElseGet(() -> skillDefinitionRepository.save(
                SkillDefinition.builder().skillCode(skillCode).name(name).build()));
    }

    private User persistUser(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        UserBalance balance = UserBalance.builder().user(user).build();
        em.persist(balance);
        return user;
    }

    private void flushClear() {
        em.flush();
        em.clear();
    }
}
