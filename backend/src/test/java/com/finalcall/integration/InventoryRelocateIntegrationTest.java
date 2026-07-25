package com.finalcall.integration;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.entity.TempStorage;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.item.repository.TempStorageRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * relocate(TEMP→INVENTORY) API 통합 검증(item, FC-022) — 계약 §4.2. 실제 MySQL(Testcontainers) + Security 필터.
 *
 * <p>happy(자동/명시 배정) + 경계·오류(ITEM_002 소유자 아님·ITEM_003 TEMP 아님·INV_002 슬롯 점유·INV_001 만실)를
 * 검증한다. 주체는 SecurityContext(.with(user)) 기준. 읽기·쓰기 모두 {@code @Transactional} 롤백으로 정리한다.
 */
@Transactional
class InventoryRelocateIntegrationTest extends IntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Autowired
    private TempStorageRepository tempStorageRepository;

    @Test
    void 자동배정은_최소_빈_슬롯0으로_이동한다() throws Exception {
        User owner = newUser("reloc_auto");
        ItemInstance temp = tempItem(owner, 9800);

        relocate(temp.getPublicId(), owner.getId(), "{}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.slotNo").value(0));
    }

    @Test
    void 명시_슬롯으로_이동한다() throws Exception {
        User owner = newUser("reloc_explicit");
        ItemInstance temp = tempItem(owner, 9801);

        relocate(temp.getPublicId(), owner.getId(), "{\"slotNo\":5}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.slotNo").value(5));
    }

    @Test
    void 소유자가_아니면_403_ITEM_002() throws Exception {
        User owner = newUser("reloc_owner");
        User other = newUser("reloc_other");
        ItemInstance temp = tempItem(owner, 9802);

        relocate(temp.getPublicId(), other.getId(), "{}")
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ITEM_002"));
    }

    @Test
    void 대상이_TEMP가_아니면_409_ITEM_003() throws Exception {
        User owner = newUser("reloc_nottemp");
        ItemInstance inv = itemInstanceRepository.save(instance(owner, template(9803), ItemLocation.INVENTORY, 0));

        relocate(inv.getPublicId(), owner.getId(), "{}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ITEM_003"));
    }

    @Test
    void 명시_슬롯이_점유중이면_409_INV_002() throws Exception {
        User owner = newUser("reloc_occupied");
        ItemTemplate template = template(9804);
        itemInstanceRepository.save(instance(owner, template, ItemLocation.INVENTORY, 0)); // slot 0 점유
        ItemInstance temp = tempItem(owner, template);

        relocate(temp.getPublicId(), owner.getId(), "{\"slotNo\":0}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INV_002"));
    }

    @Test
    void 인벤토리가_만실이면_409_INV_001() throws Exception {
        User owner = newUser("reloc_full");
        ItemTemplate template = template(9805);
        for (int slot = 0; slot < 96; slot++) {
            itemInstanceRepository.save(instance(owner, template, ItemLocation.INVENTORY, slot));
        }
        ItemInstance temp = tempItem(owner, template);

        relocate(temp.getPublicId(), owner.getId(), "{}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INV_001"));
    }

    private org.springframework.test.web.servlet.ResultActions relocate(
        String publicId, Long userId, String body) throws Exception {
        return mockMvc.perform(
            post("/api/v1/me/temp-storage/{id}/relocate", publicId)
                .with(user(String.valueOf(userId)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ItemInstance tempItem(User owner, int typeCode) {
        return tempItem(owner, template(typeCode));
    }

    private ItemInstance tempItem(User owner, ItemTemplate template) {
        ItemInstance instance = itemInstanceRepository.save(instance(owner, template, ItemLocation.TEMP, null));
        tempStorageRepository.save(TempStorage.builder()
            .instance(instance).ownerId(owner.getId()).storedAt(Instant.now()).build());
        return instance;
    }

    private ItemInstance instance(User owner, ItemTemplate template, ItemLocation location, Integer slotNo) {
        return ItemInstance.builder()
            .template(template).owner(owner).level(1).skillPercent(0).location(location).slotNo(slotNo).build();
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.save(ItemTemplate.builder()
            .mainCategory(9).subGroup(1).element(1).kind(1).typeCode(typeCode).displayName("relocate템플릿").build());
    }

    private User newUser(String loginId) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(loginId).build());
    }
}
