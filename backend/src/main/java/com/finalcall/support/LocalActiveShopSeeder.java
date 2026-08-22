package com.finalcall.support;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.LocalDemoDataService.ListedSeed;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 로컬 데모 계정의 판매 가능한 마켓 리스팅을 판매자별 목표 수까지 보충한다.
 * 기존 리스팅의 상태나 만료 시각은 변경하지 않고 부족분만 새로 발행한다.
 */
@Slf4j
@Component
@Profile("local")
@ConditionalOnProperty(name = "demo.seed.active-shops.enabled", havingValue = "true")
@RequiredArgsConstructor
public class LocalActiveShopSeeder {

    private static final List<String> SELLERS = List.of("demo1", "demo2", "demo3", "demo4");
    private static final String LOCK_NAME = "finalcall:local-active-shop-seed";
    private static final long RANDOM_SEED = 352_004L;

    private final UserRepository userRepository;
    private final ItemTemplateRepository itemTemplateRepository;
    private final LocalDemoDataService data;
    private final JdbcTemplate jdbcTemplate;

    @Value("${demo.seed.active-shops.target-per-seller:5}")
    private int targetPerSeller;

    @EventListener(ApplicationReadyEvent.class)
    @Order(Ordered.HIGHEST_PRECEDENCE + 1)
    @Transactional
    public void seedActiveShops() {
        if (targetPerSeller <= 0 || !acquireLockUntilTransactionCompletion()) {
            return;
        }
        topUp();
    }

    private void topUp() {
        List<ItemTemplate> templates = itemTemplateRepository.findAll();
        if (templates.isEmpty()) {
            log.warn("[LocalActiveShopSeeder] 아이템 템플릿이 없어 보충을 건너뜀");
            return;
        }

        Instant now = Instant.now();
        Random random = new Random(RANDOM_SEED);
        List<ListedSeed> seeds = new ArrayList<>();
        for (String loginId : SELLERS) {
            Optional<User> seller = userRepository.findByLoginIdAndIsDeletedFalse(loginId);
            if (seller.isEmpty()) {
                log.warn("[LocalActiveShopSeeder] 데모 계정 {} 미존재 — 해당 판매자 보충을 건너뜀", loginId);
                continue;
            }
            long active = countActive(seller.get().getId(), now);
            int missing = Math.max(0, targetPerSeller - (int)active);
            for (int index = 0; index < missing; index++) {
                seeds.add(seed(seller.get().getId(), templates, random, now));
            }
        }
        if (seeds.isEmpty()) {
            log.info("[LocalActiveShopSeeder] 판매자별 활성 리스팅 목표 충족 — 추가 불필요");
            return;
        }

        int startIndex = nextPublicIdIndex();
        int created = data.bulkCreateListedShopItems(seeds, startIndex);
        log.info("[LocalActiveShopSeeder] 활성 마켓 리스팅 {}건 보충 완료 (public id 시작={})", created, startIndex);
    }

    private ListedSeed seed(Long sellerId, List<ItemTemplate> templates, Random random, Instant now) {
        ItemTemplate template = templates.get(random.nextInt(templates.size()));
        int level = 1 + random.nextInt(9);
        long price = 10_000L + random.nextInt(990_001);
        Instant endAt = now.plus(7 + random.nextInt(24), ChronoUnit.DAYS);
        return new ListedSeed(sellerId, template.getTypeCode(), level, null, null, 0, null, price, endAt);
    }

    private long countActive(Long sellerId, Instant now) {
        Long count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM shop WHERE seller_id = ? AND status = 'ACTIVE' "
                + "AND (end_at IS NULL OR end_at > ?)",
            Long.class, sellerId, now);
        return count == null ? 0L : count;
    }

    private int nextPublicIdIndex() {
        Long maxSuffix = jdbcTemplate.queryForObject(
            "SELECT GREATEST("
                + "COALESCE((SELECT MAX(CAST(SUBSTRING(public_id, 9) AS UNSIGNED)) FROM shop "
                + "WHERE public_id LIKE 'SEEDSHOP%'), 0), "
                + "COALESCE((SELECT MAX(CAST(SUBSTRING(public_id, 9) AS UNSIGNED)) FROM item_instance "
                + "WHERE public_id LIKE 'SEEDLIST%'), 0))",
            Long.class);
        long next = (maxSuffix == null ? 0L : maxSuffix) + 1L;
        if (next > Integer.MAX_VALUE) {
            throw new IllegalStateException("로컬 마켓 시드 public id 범위를 초과했습니다");
        }
        return (int)next;
    }

    boolean acquireLockUntilTransactionCompletion() {
        Integer acquired = jdbcTemplate.queryForObject("SELECT GET_LOCK(?, 0)", Integer.class, LOCK_NAME);
        if (acquired == null || acquired != 1) {
            log.info("[LocalActiveShopSeeder] 다른 시더가 실행 중이어서 보충을 건너뜀");
            return false;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            releaseLockSafely();
            throw new IllegalStateException("로컬 마켓 시드 lock은 활성 트랜잭션 안에서만 획득할 수 있습니다");
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                releaseLockSafely();
            }
        });
        return true;
    }

    private void releaseLockSafely() {
        try {
            Integer released = jdbcTemplate.queryForObject("SELECT RELEASE_LOCK(?)", Integer.class, LOCK_NAME);
            if (released == null || released != 1) {
                log.warn("[LocalActiveShopSeeder] named lock 해제 결과가 비정상임 result={}", released);
            }
        } catch (RuntimeException ex) {
            log.warn("[LocalActiveShopSeeder] named lock 해제 실패 — 원 트랜잭션 결과는 유지함", ex);
        }
    }
}
