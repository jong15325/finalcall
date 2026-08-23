package com.finalcall.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.LocalDemoDataService.ListedSeed;

@ExtendWith(MockitoExtension.class)
class LocalActiveShopSeederTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private ItemTemplateRepository itemTemplateRepository;
    @Mock
    private LocalDemoDataService data;
    @Mock
    private JdbcTemplate jdbcTemplate;

    private LocalActiveShopSeeder seeder;

    @BeforeEach
    void setUp() {
        TransactionSynchronizationManager.initSynchronization();
        seeder = new LocalActiveShopSeeder(userRepository, itemTemplateRepository, data, jdbcTemplate);
        ReflectionTestUtils.setField(seeder, "targetPerSeller", 5);
        lenient().when(jdbcTemplate.queryForObject(eq("SELECT GET_LOCK(?, 0)"), eq(Integer.class), any()))
            .thenReturn(1);
        lenient().when(jdbcTemplate.queryForObject(eq("SELECT RELEASE_LOCK(?)"), eq(Integer.class), any()))
            .thenReturn(1);
        lenient().when(jdbcTemplate.queryForList(any(String.class), any(java.time.Instant.class)))
            .thenReturn(List.of());
        ItemTemplate template = mock(ItemTemplate.class);
        lenient().when(template.getTypeCode()).thenReturn(1111);
        lenient().when(itemTemplateRepository.findAll()).thenReturn(List.of(template));
        for (int index = 1; index <= 4; index++) {
            User user = mock(User.class);
            lenient().when(user.getId()).thenReturn((long)index);
            lenient().when(userRepository.findByLoginIdAndIsDeletedFalse("demo" + index))
                .thenReturn(Optional.of(user));
        }
    }

    @AfterEach
    void completeTransactionSynchronization() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.getSynchronizations()
            .forEach(synchronization -> synchronization.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        TransactionSynchronizationManager.clearSynchronization();
    }

    @Test
    void active가_없으면_판매자별_5개씩_보충한다() {
        mockActiveCounts(0L, 0L, 0L, 0L);
        mockMaxSuffix(0L);

        seeder.seedActiveShops();

        ArgumentCaptor<List<ListedSeed>> captor = listedSeeds();
        assertThat(captor.getValue()).hasSize(20);
        for (long sellerId = 1; sellerId <= 4; sellerId++) {
            long expected = sellerId;
            assertThat(captor.getValue()).filteredOn(seed -> seed.sellerId().equals(expected)).hasSize(5);
        }
        verify(data).bulkCreateListedShopItems(anyList(), eq(1));
    }

    @Test
    void 일부_존재하면_부족분만_보충한다() {
        mockActiveCounts(2L, 4L, 1L, 5L);
        mockMaxSuffix(40L);

        seeder.seedActiveShops();

        ArgumentCaptor<List<ListedSeed>> captor = listedSeeds();
        assertThat(captor.getValue()).hasSize(8);
        assertThat(captor.getValue()).filteredOn(seed -> seed.sellerId().equals(1L)).hasSize(3);
        assertThat(captor.getValue()).filteredOn(seed -> seed.sellerId().equals(2L)).hasSize(1);
        assertThat(captor.getValue()).filteredOn(seed -> seed.sellerId().equals(3L)).hasSize(4);
        verify(data).bulkCreateListedShopItems(anyList(), eq(41));
    }

    @Test
    void 이미_목표_이상이면_아무것도_생성하지_않는다() {
        mockActiveCounts(5L, 6L, 7L, 8L);

        seeder.seedActiveShops();

        verify(data, never()).bulkCreateListedShopItems(anyList(), any(Integer.class));
    }

    @Test
    void 데모_사용자가_없으면_해당_사용자만_안전하게_건너뛴다() {
        when(userRepository.findByLoginIdAndIsDeletedFalse("demo2")).thenReturn(Optional.empty());
        mockActiveCounts(5L, 5L, 5L);

        seeder.seedActiveShops();

        verify(data, never()).bulkCreateListedShopItems(anyList(), any(Integer.class));
    }

    @Test
    void public_id는_shop과_item의_가장_큰_suffix_다음부터_사용한다() {
        mockActiveCounts(4L, 5L, 5L, 5L);
        mockMaxSuffix(9_999L);

        seeder.seedActiveShops();

        verify(data).bulkCreateListedShopItems(anyList(), eq(10_000));
    }

    @Test
    void 만료된_active는_활성_개수에서_제외한다() {
        mockActiveCounts(5L, 5L, 5L, 5L);

        seeder.seedActiveShops();

        verify(jdbcTemplate, times(4)).queryForObject(
            argThat(sql -> sql.contains("status = 'ACTIVE'")
                && sql.contains("end_at IS NULL OR end_at > ?")),
            eq(Long.class), any(), any());
    }

    @Test
    void lock을_획득하지_못하면_보충하지_않는다() {
        when(jdbcTemplate.queryForObject(eq("SELECT GET_LOCK(?, 0)"), eq(Integer.class), any()))
            .thenReturn(0);

        seeder.seedActiveShops();

        verify(data, never()).bulkCreateListedShopItems(anyList(), any(Integer.class));
        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
    }

    @Test
    void lock_해제_실패는_완료된_트랜잭션_결과를_가리지_않는다() {
        mockActiveCounts(5L, 5L, 5L, 5L);
        when(jdbcTemplate.queryForObject(eq("SELECT RELEASE_LOCK(?)"), eq(Integer.class), any()))
            .thenThrow(new IllegalStateException("release failed"));
        seeder.seedActiveShops();

        List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
        TransactionSynchronizationManager.clearSynchronization();

        assertThatCode(() -> synchronizations.forEach(
            synchronization -> synchronization.afterCompletion(TransactionSynchronization.STATUS_COMMITTED)))
            .doesNotThrowAnyException();
    }

    @Test
    void 신규_매물은_레벨_스킬_골드포스가_결정론적으로_다양하다() {
        mockActiveCounts(0L, 0L, 0L, 0L);
        mockMaxSuffix(0L);

        seeder.seedActiveShops();

        List<ListedSeed> seeds = listedSeeds().getValue();
        assertThat(seeds).extracting(ListedSeed::level).contains(1, 9);
        assertThat(seeds).anyMatch(seed -> seed.skill1Code() != null);
        assertThat(seeds).anyMatch(seed -> seed.skill2Code() != null);
        assertThat(seeds).anyMatch(seed -> seed.gfExpireAt() != null);
        assertThat(seeds).allSatisfy(seed -> {
            assertThat(seed.level()).isBetween(1, 9);
            if (seed.skill1Code() == null && seed.skill2Code() == null) {
                assertThat(seed.skillPercent()).isZero();
            } else {
                assertThat(seed.skillPercent()).isBetween(1, levelMaxPercent(seed.level()));
            }
        });
    }

    @Test
    void 마법_매물에는_스킬1을_부여하지_않는다() {
        ItemTemplate magicTemplate = mock(ItemTemplate.class);
        when(magicTemplate.getTypeCode()).thenReturn(1331);
        when(magicTemplate.getSubGroup()).thenReturn(3);
        when(itemTemplateRepository.findAll()).thenReturn(List.of(magicTemplate));
        mockActiveCounts(0L, 0L, 0L, 0L);
        mockMaxSuffix(0L);

        seeder.seedActiveShops();

        assertThat(listedSeeds().getValue()).allSatisfy(seed -> assertThat(seed.skill1Code()).isNull());
    }

    @Test
    void 비어_있는_활성_SEEDLIST_매물만_조건부로_보정한다() {
        when(jdbcTemplate.queryForList(any(String.class), any(java.time.Instant.class)))
            .thenReturn(List.of(Map.of("itemId", 17L, "level", 7, "subGroup", 3)));
        when(jdbcTemplate.update(any(String.class), any(Object[].class))).thenReturn(2);

        Integer enriched = ReflectionTestUtils.invokeMethod(seeder, "enrichBlankSeedListings");

        assertThat(enriched).isEqualTo(1);
        verify(jdbcTemplate).queryForList(argThat(sql -> sql.contains("ii.public_id LIKE 'SEEDLIST%'")
            && sql.contains("ii.location = 'LISTED'")
            && sql.contains("ii.skill1_id IS NULL AND ii.skill2_id IS NULL")
            && sql.contains("ii.skill_percent = 0 AND ii.gf_expire_at IS NULL")
            && sql.contains("s.status = 'ACTIVE'")), any(java.time.Instant.class));
        verify(jdbcTemplate).update(argThat(sql -> sql.contains("JOIN shop s ON s.item_instance_id = ii.id")
            && sql.contains("s.item_spec_snapshot = ?")
            && sql.contains("WHERE ii.id = ?")
            && !sql.contains("ii.level = ?")
            && sql.contains("ii.public_id LIKE 'SEEDLIST%'")
            && sql.contains("ii.skill1_id IS NULL AND ii.skill2_id IS NULL")
            && sql.contains("s.status = 'ACTIVE'")), org.mockito.ArgumentMatchers.isNull(), any(Integer.class),
            any(Integer.class), any(java.time.Instant.class), any(java.time.Instant.class),
            argThat((String snapshot) -> snapshot.startsWith("Lv.7 / skill1=-/skill2=")
                && snapshot.contains(" / GF=")),
            any(java.time.Instant.class), eq(17L), any(java.time.Instant.class));
    }

    private void mockActiveCounts(Long... counts) {
        when(jdbcTemplate.queryForObject(any(String.class), eq(Long.class), any(), any()))
            .thenReturn(counts[0], java.util.Arrays.copyOfRange(counts, 1, counts.length));
    }

    private void mockMaxSuffix(long suffix) {
        when(jdbcTemplate.queryForObject(any(String.class), eq(Long.class))).thenReturn(suffix);
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<List<ListedSeed>> listedSeeds() {
        ArgumentCaptor<List<ListedSeed>> captor = ArgumentCaptor.forClass(List.class);
        verify(data).bulkCreateListedShopItems(captor.capture(), any(Integer.class));
        return captor;
    }

    private int levelMaxPercent(int level) {
        return switch (level) {
            case 1 -> 9;
            case 2 -> 15;
            case 3 -> 19;
            case 4 -> 23;
            case 5 -> 25;
            case 6 -> 27;
            case 7 -> 31;
            case 8 -> 33;
            default -> 36;
        };
    }
}
