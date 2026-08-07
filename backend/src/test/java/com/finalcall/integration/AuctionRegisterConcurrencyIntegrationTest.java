package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import com.finalcall.domain.auction.dto.AuctionRegisterRequest;
import com.finalcall.domain.auction.repository.AuctionRepository;
import com.finalcall.domain.auction.service.AuctionService;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.item.repository.TempStorageRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;
import com.finalcall.support.SeedTestSupport;

/**
 * 경매 등록 출품 CAS 단일 승자 동시성 검증(auction, FC-026) — 실제 MySQL(Testcontainers).
 *
 * <p>같은 INVENTORY 아이템을 여러 스레드가 동시에 출품하면, INVENTORY→LISTED 조건부 CAS 가 커밋 시 하나만
 * 승자로 만들고 나머지는 AUCTION_002(이미 출품중)로 매핑됨을 단언한다(중복 출품 DB 차단, erd §5).
 *
 * <p>★ 실제 커밋·독립 트랜잭션이 필요해 {@code @Transactional} 을 걸지 않고, 시드 보존 정리를 수동으로 한다.
 */
class AuctionRegisterConcurrencyIntegrationTest extends IntegrationTest {

    private static final int THREADS = 6;

    @Autowired
    private AuctionService auctionService;

    @Autowired
    private AuctionRepository auctionRepository;

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
        // Flyway 시드 경매는 bid·money_hold 가 참조하므로 보존하고, 이 테스트가 만든 경매만 지운다.
        auctionRepository.deleteAllInBatch(auctionRepository.findAll().stream()
            .filter(auction -> !auction.getPublicId().startsWith("SEEDAUCT"))
            .toList());
        SeedTestSupport.deleteNonSeedItemData(
            itemInstanceRepository, tempStorageRepository, userRepository, userBalanceRepository);
    }

    @Test
    void 같은_아이템_동시_출품은_하나만_성공하고_나머지는_AUCTION_002() throws Exception {
        ItemTemplate template = itemTemplateRepository.findByTypeCode(1111).orElseThrow(); // 시드 템플릿 재사용
        User owner = userRepository.save(
            User.builder().loginId("auc_racer").passwordHash("hash").nickname("출품경합").build());
        ItemInstance item = itemInstanceRepository.save(ItemInstance.builder()
            .template(template).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.INVENTORY).slotNo(0).build());
        String publicId = item.getPublicId();

        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        AuctionRegisterRequest command = new AuctionRegisterRequest(
            publicId, 1000L, null, null, end, null, null, end.plus(1, ChronoUnit.HOURS));

        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(THREADS);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger alreadyListed = new AtomicInteger();
        List<String> unexpected = new CopyOnWriteArrayList<>();
        try {
            for (int i = 0; i < THREADS; i++) {
                pool.submit(() -> {
                    authenticateAs(owner.getId());
                    try {
                        ready.await();
                        auctionService.register(command);
                        success.incrementAndGet();
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } catch (BusinessException ex) {
                        if ("AUCTION_002".equals(ex.getErrorCode().getCode())) {
                            alreadyListed.incrementAndGet();
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

        assertThat(success.get()).isEqualTo(1); // 정확히 하나만 출품 성공
        assertThat(alreadyListed.get()).isEqualTo(THREADS - 1); // 나머지는 AUCTION_002(500 아님)
        assertThat(unexpected).isEmpty();
        // DB 최종 상태: item 은 LISTED, auction 정확히 1건.
        assertThat(itemInstanceRepository.findById(item.getId()).orElseThrow().getLocation())
            .isEqualTo(ItemLocation.LISTED);
        assertThat(auctionRepository.findAll().stream()
            .filter(auction -> !auction.getPublicId().startsWith("SEEDAUCT")))
            .hasSize(1);
    }

    private void authenticateAs(Long userId) {
        SecurityContextHolder.setContext(new SecurityContextImpl(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of())));
    }
}
