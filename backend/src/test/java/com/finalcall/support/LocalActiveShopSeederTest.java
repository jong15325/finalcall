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
}
