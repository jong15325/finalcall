package com.finalcall.domain.item;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

import com.finalcall.domain.member.entity.User;
import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 아이템 인스턴스 리포지토리 슬라이스 테스트(item, FC-021·FC-022).
 *
 * <p>★ 실제 MySQL(Testcontainers, H2 대체 금지)로 fetch join 상세·인벤토리 조회, slot_key 생성 컬럼 UK(V8)의
 * 이중 배정 차단을 검증한다. 소유자로 격리된 자체 데이터를 만들어 시드와 섞이지 않게 한다(@DataJpaTest 롤백).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class ItemInstanceRepositorySliceTest {

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Autowired
    private ItemOwnershipHistoryRepository ownershipHistoryRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 상세조회는_템플릿과_스킬을_fetch_join_한다() {
        User owner = persistUser("slice_owner1", "슬라이스소유자1");
        ItemTemplate template = persistTemplate(9111);
        SkillDefinition skill = persistSkill(9100);
        ItemInstance instance = itemInstanceRepository.save(ItemInstance.builder()
            .template(template).owner(owner).level(3).skill1(skill).skillPercent(20)
            .location(ItemLocation.INVENTORY).slotNo(0).build());
        em.flush();
        em.clear();

        ItemInstance found = itemInstanceRepository.findDetailByPublicId(instance.getPublicId()).orElseThrow();

        assertThat(found.getTemplate().getTypeCode()).isEqualTo(9111);
        assertThat(found.getSkill1().getSkillCode()).isEqualTo(9100);
        assertThat(found.getSkill2()).isNull();
        assertThat(found.getOwner().getNickname()).isEqualTo("슬라이스소유자1");
    }

    @Test
    void 인벤토리조회는_소유자의_INVENTORY만_slotNo_asc로_준다() {
        User owner = persistUser("slice_owner2", "슬라이스소유자2");
        ItemTemplate template = persistTemplate(9112);
        itemInstanceRepository.save(instance(template, owner, ItemLocation.INVENTORY, 2, "P2"));
        itemInstanceRepository.save(instance(template, owner, ItemLocation.INVENTORY, 0, "P0"));
        itemInstanceRepository.save(instance(template, owner, ItemLocation.TEMP, null, "PT"));
        em.flush();
        em.clear();

        List<ItemInstance> inventory = itemInstanceRepository.findInventory(owner.getId());

        assertThat(inventory).extracting(ItemInstance::getSlotNo).containsExactly(0, 2); // TEMP 제외·slotNo asc
        assertThat(itemInstanceRepository.countByOwnerIdAndLocation(owner.getId(), ItemLocation.INVENTORY))
            .isEqualTo(2);
    }

    @Test
    void 동일소유자_동일슬롯_이중배정은_slot_key_UK로_차단된다() {
        User owner = persistUser("slice_owner3", "슬라이스소유자3");
        ItemTemplate template = persistTemplate(9113);
        itemInstanceRepository.save(instance(template, owner, ItemLocation.INVENTORY, 5, "PA"));

        // IDENTITY 전략이라 두 번째 save 가 즉시 INSERT → slot_key UK 위반이 그 시점(또는 flush)에 터진다.
        assertThatThrownBy(() -> {
            itemInstanceRepository.save(instance(template, owner, ItemLocation.INVENTORY, 5, "PB"));
            em.flush();
        }).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 소유이력_첫행은_from_owner_null로_기록된다() {
        User owner = persistUser("slice_owner4", "슬라이스소유자4");
        ItemTemplate template = persistTemplate(9114);
        ItemInstance instance = itemInstanceRepository.save(
            instance(template, owner, ItemLocation.INVENTORY, 0, "PH"));
        em.flush();
        ownershipHistoryRepository.save(ItemOwnershipHistory.builder()
            .instanceId(instance.getId()).fromOwnerId(null).toOwnerId(owner.getId())
            .transferType(TransferType.SEED).transferredAt(java.time.Instant.now()).build());
        em.flush();
        em.clear();

        List<ItemOwnershipHistory> chain = ownershipHistoryRepository
            .findByInstanceIdOrderByTransferredAtAsc(instance.getId());

        assertThat(chain).hasSize(1);
        assertThat(chain.get(0).getFromOwnerId()).isNull();
        assertThat(chain.get(0).getTransferType()).isEqualTo(TransferType.SEED);
        assertThat(chain.get(0).getCreatedAt()).isNotNull();
    }

    private ItemInstance instance(ItemTemplate template, User owner, ItemLocation location, Integer slotNo,
        String publicId) {
        return ItemInstance.builder()
            .publicId(pad(publicId)).template(template).owner(owner).level(1).skillPercent(0)
            .location(location).slotNo(slotNo).build();
    }

    /** public_id 는 CHAR(26) — 테스트 식별자를 26자로 우측 0패딩한다. */
    private String pad(String seed) {
        return (seed + "0".repeat(26)).substring(0, 26);
    }

    private User persistUser(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        return user;
    }

    private ItemTemplate persistTemplate(int typeCode) {
        ItemTemplate template = ItemTemplate.builder()
            .mainCategory(9).subGroup(1).element(1).kind(1).typeCode(typeCode).displayName("테스트템플릿").build();
        em.persist(template);
        return template;
    }

    private SkillDefinition persistSkill(int skillCode) {
        SkillDefinition skill = SkillDefinition.builder().skillCode(skillCode).name("테스트스킬").build();
        em.persist(skill);
        return skill;
    }
}
