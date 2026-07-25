package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.item.InventoryService;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.item.TempStorage;
import com.finalcall.domain.item.TempStorageRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;
import com.finalcall.support.SeedTestSupport;

/**
 * relocate 슬롯 이중 배정 동시성 검증(item, FC-022) — 실제 MySQL(Testcontainers).
 *
 * <p>서로 다른 임시보관 아이템 여럿을 <b>같은 명시 슬롯(0)</b>으로 동시에 이동하면, 앱 선검사를 함께 통과하더라도
 * slot_key UK(spec §3.2)가 커밋 시 하나만 성공시키고 나머지는 INV_002 로 매핑됨을 단언한다(이중 배정 DB 차단).
 *
 * <p>★ 실제 커밋·독립 트랜잭션이 필요해 {@code @Transactional} 을 걸지 않고, 시드 보존 정리를 수동으로 한다.
 */
class InventoryRelocateConcurrencyIntegrationTest extends IntegrationTest {

    private static final int THREADS = 6;

    @Autowired
    private InventoryService inventoryService;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Autowired
    private TempStorageRepository tempStorageRepository;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @BeforeEach
    @AfterEach
    void clean() {
        SeedTestSupport.deleteNonSeedItemData(
            itemInstanceRepository, tempStorageRepository, userRepository, userBalanceRepository);
    }

    @Test
    void 서로다른_아이템의_동일슬롯_동시이동은_하나만_성공하고_나머지는_INV_002() throws Exception {
        // 시드 템플릿(마스터)을 재사용해 소유자·임시보관 아이템만 만든다(템플릿 정리 불요).
        ItemTemplate template = itemTemplateRepository.findByTypeCode(1111).orElseThrow();
        User owner = userRepository.save(
            User.builder().loginId("reloc_racer").passwordHash("hash").nickname("이동경합").build());
        List<String> publicIds = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            ItemInstance temp = itemInstanceRepository.save(ItemInstance.builder()
                .template(template).owner(owner).level(1).skillPercent(0)
                .location(ItemLocation.TEMP).slotNo(null).build());
            tempStorageRepository.save(TempStorage.builder()
                .instance(temp).ownerId(owner.getId()).storedAt(Instant.now()).build());
            publicIds.add(temp.getPublicId());
        }

        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(THREADS);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger slotConflict = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        try {
            for (int i = 0; i < THREADS; i++) {
                String publicId = publicIds.get(i);
                pool.submit(() -> {
                    authenticateAs(owner.getId());
                    try {
                        ready.await();
                        inventoryService.relocate(publicId, 0); // 전부 같은 슬롯 0 을 노린다
                        success.incrementAndGet();
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } catch (BusinessException ex) {
                        if ("INV_002".equals(ex.getErrorCode().getCode())) {
                            slotConflict.incrementAndGet();
                        } else {
                            unexpected.add(ex.getErrorCode().getCode());
                        }
                    } catch (RuntimeException ex) {
                        unexpected.add(ex.getClass().getSimpleName());
                    } finally {
                        SecurityContextHolder.clearContext();
                        done.countDown();
                    }
                });
            }
            ready.countDown();
            assertThat(done.await(20, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        assertThat(success.get()).isEqualTo(1); // 정확히 하나만 슬롯 0 을 차지
        assertThat(slotConflict.get()).isEqualTo(THREADS - 1); // 나머지는 INV_002(500 아님)
        assertThat(unexpected).isEmpty();
        // DB 최종 상태: 슬롯 0 에 INVENTORY 아이템 정확히 1건.
        List<ItemInstance> inventory = itemInstanceRepository.findInventory(owner.getId());
        assertThat(inventory).hasSize(1);
        assertThat(inventory.get(0).getSlotNo()).isZero();
    }

    private void authenticateAs(Long userId) {
        SecurityContextHolder.setContext(new SecurityContextImpl(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of())));
    }
}
