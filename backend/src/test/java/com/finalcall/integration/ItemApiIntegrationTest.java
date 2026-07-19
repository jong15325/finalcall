package com.finalcall.integration;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * 아이템 카탈로그·상세·시드 인벤토리 API 통합 검증(item, FC-020·021·023) — 실제 MySQL(Testcontainers) + Security 필터.
 *
 * <p>계약 §4.1(카탈로그·상세)·§4.2(인벤토리). 상세는 소유자 마스킹 + 소유자 전용 slotNo 이원화(spec §5.2)를,
 * 시드는 GET /item-templates 40건·seed user 인벤토리 42건을 확인한다(FC-023 DoD, V12 재작성 반영).
 * 읽기·롤백이라 {@code @Transactional}.
 */
@Transactional
class ItemApiIntegrationTest extends IntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Test
    void 카탈로그는_시드_템플릿_40건을_노출한다() throws Exception {
        // V12(FC-052) 재작성 후 시드는 상품군 1 대역 전수 40종(무기 16 + 방어구 16 + 마법 8)이다.
        mockMvc.perform(get("/api/v1/item-templates").param("size", "100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 1111)]").exists()) // 무기·물·도끼
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 1222)]").exists()) // 방어구·불·펜던트
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 1342)]").exists()) // 마법·바람·특수
            // 2xxx 는 원본 SILVER 대역 — D2 자리 의미 교정으로 소멸했다.
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 2122)]").doesNotExist());
    }

    @Test
    void 카탈로그_대분류_필터는_해당_축만_반환한다() throws Exception {
        mockMvc.perform(get("/api/v1/item-templates").param("mainCategory", "1").param("size", "100"))
            .andExpect(status().isOk())
            // 시드는 전건 main=1(상품군 = 아이템 카드). 다른 상품군은 item_template 이 담지 않는다(계약 §3.3.1).
            .andExpect(jsonPath("$.data.content[?(@.mainCategory != 1)]").doesNotExist())
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 1111)]").exists());
    }

    @Test
    void 상세_비인증조회는_소유자마스킹_하고_slotNo를_숨긴다() throws Exception {
        ItemInstance instance = seedInstance("detail_owner1", "홍길동", 4);

        mockMvc.perform(get("/api/v1/items/{id}", instance.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.itemInstancePublicId").value(instance.getPublicId()))
            .andExpect(jsonPath("$.data.location").value("INVENTORY"))
            .andExpect(jsonPath("$.data.ownerMasked").value("홍길***"))
            .andExpect(jsonPath("$.data.slotNo").doesNotExist());
    }

    @Test
    void 상세_소유자조회는_slotNo를_노출한다() throws Exception {
        User owner = userRepository.save(newUser("detail_owner2", "소유자닉"));
        ItemInstance instance = itemInstanceRepository.save(inventoryInstance(owner, 4, template(9701)));

        mockMvc.perform(get("/api/v1/items/{id}", instance.getPublicId()).with(user(String.valueOf(owner.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.slotNo").value(4));
    }

    @Test
    void 상세_없는_인스턴스는_404_ITEM_001() throws Exception {
        mockMvc.perform(get("/api/v1/items/{id}", "NONEXISTENTPUBLICID0000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("ITEM_001"));
    }

    @Test
    void 시드_소유자의_인벤토리는_42건이다() throws Exception {
        // V9 10건(slot 0~9) + V12 확장 32건(slot 10~41). 정원 96 이내.
        Long seedSellerId = userRepository.findByLoginIdAndIsDeletedFalse("seed_seller").orElseThrow().getId();

        mockMvc.perform(get("/api/v1/me/inventory").with(user(String.valueOf(seedSellerId))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.capacity").value(96))
            .andExpect(jsonPath("$.data.used").value(42))
            .andExpect(jsonPath("$.data.items.length()").value(42));
    }

    @Test
    void 인벤토리_미인증은_401이다() throws Exception {
        mockMvc.perform(get("/api/v1/me/inventory"))
            .andExpect(status().isUnauthorized());
    }

    private ItemInstance seedInstance(String loginId, String nickname, int slotNo) {
        User owner = userRepository.save(newUser(loginId, nickname));
        return itemInstanceRepository.save(inventoryInstance(owner, slotNo, template(9700)));
    }

    private ItemInstance inventoryInstance(User owner, int slotNo, ItemTemplate template) {
        return ItemInstance.builder()
            .template(template).owner(owner).level(3).skillPercent(10)
            .location(ItemLocation.INVENTORY).slotNo(slotNo).build();
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.save(ItemTemplate.builder()
            .mainCategory(9).subGroup(1).element(1).kind(1).typeCode(typeCode).displayName("상세템플릿").build());
    }

    private User newUser(String loginId, String nickname) {
        return User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
    }
}
