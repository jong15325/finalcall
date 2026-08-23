package com.finalcall.support;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
    private static final DateTimeFormatter GF_SNAPSHOT_FORMAT = DateTimeFormatter
        .ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'")
        .withZone(ZoneOffset.UTC);

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
        enrichBlankSeedListings();

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
        ItemTraits traits = traits(template.getSubGroup(), level, random, now);
        long price = 10_000L + random.nextInt(990_001);
        Instant endAt = now.plus(7 + random.nextInt(24), ChronoUnit.DAYS);
        return new ListedSeed(sellerId, template.getTypeCode(), level, traits.skill1Code(), traits.skill2Code(),
            traits.skillPercent(), traits.gfExpireAt(), price, endAt);
    }

    private int enrichBlankSeedListings() {
        Instant now = Instant.now();
        List<Map<String, Object>> candidates = jdbcTemplate.queryForList(
            "SELECT ii.id AS itemId, ii.level AS level, it.sub_group AS subGroup FROM item_instance ii "
                + "JOIN item_template it ON it.id = ii.template_id "
                + "JOIN shop s ON s.item_instance_id = ii.id "
                + "WHERE ii.public_id LIKE 'SEEDLIST%' AND ii.location = 'LISTED' "
                + "AND ii.skill1_id IS NULL AND ii.skill2_id IS NULL "
                + "AND ii.skill_percent = 0 AND ii.gf_expire_at IS NULL "
                + "AND s.status = 'ACTIVE' AND (s.end_at IS NULL OR s.end_at > ?) ORDER BY ii.id",
            now);
        int enriched = 0;
        for (Map<String, Object> candidate : candidates) {
            long itemId = ((Number)candidate.get("itemId")).longValue();
            int level = ((Number)candidate.get("level")).intValue();
            int subGroup = ((Number)candidate.get("subGroup")).intValue();
            Random random = new Random(RANDOM_SEED ^ itemId);
            ItemTraits traits = traits(subGroup, level, random, now);
            int updated = jdbcTemplate.update(
                "UPDATE item_instance ii JOIN shop s ON s.item_instance_id = ii.id SET "
                    + "ii.skill1_id = (SELECT id FROM skill_definition WHERE skill_code = ?), "
                    + "ii.skill2_id = (SELECT id FROM skill_definition WHERE skill_code = ?), "
                    + "ii.skill_percent = ?, ii.gf_expire_at = ?, ii.updated_at = ?, "
                    + "s.item_spec_snapshot = ?, s.updated_at = ? "
                    + "WHERE ii.id = ? AND ii.public_id LIKE 'SEEDLIST%' AND ii.location = 'LISTED' "
                    + "AND ii.skill1_id IS NULL AND ii.skill2_id IS NULL "
                    + "AND ii.skill_percent = 0 AND ii.gf_expire_at IS NULL "
                    + "AND s.status = 'ACTIVE' AND (s.end_at IS NULL OR s.end_at > ?)",
                traits.skill1Code(), traits.skill2Code(), traits.skillPercent(), traits.gfExpireAt(), now,
                specSnapshot(level, traits), now, itemId, now);
            if (updated > 0) {
                enriched++;
            }
        }
        if (enriched > 0) {
            log.info("[LocalActiveShopSeeder] 기존 활성 시드 매물 {}건 특성 보정 완료", enriched);
        }
        return enriched;
    }

    private ItemTraits traits(int subGroup, int level, Random random, Instant now) {
        boolean magic = subGroup == 3;
        Integer skill1Code;
        Integer skill2Code;
        Instant gfExpireAt;
        do {
            skill1Code = magic ? null : maybeSkill1(random);
            skill2Code = maybeSkill2(random);
            gfExpireAt = random.nextInt(10) < 3
                ? now.plus(5 + random.nextInt(86), ChronoUnit.DAYS)
                : null;
        } while (skill1Code == null && skill2Code == null && gfExpireAt == null);
        int skillPercent = skill1Code == null && skill2Code == null
            ? 0
            : 1 + random.nextInt(levelMaxPercent(level));
        return new ItemTraits(skill1Code, skill2Code, skillPercent, gfExpireAt);
    }

    private Integer maybeSkill1(Random random) {
        return random.nextInt(100) < 15 ? null : 100 + random.nextInt(98);
    }

    private Integer maybeSkill2(Random random) {
        if (random.nextInt(100) < 35) {
            return null;
        }
        int pick = random.nextInt(146);
        return pick < 10 ? 200 + pick : 300 + (pick - 10);
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

    private String specSnapshot(int level, ItemTraits traits) {
        return "Lv." + level
            + " / skill1=" + (traits.skill1Code() == null ? "-" : traits.skill1Code())
            + "/skill2=" + (traits.skill2Code() == null ? "-" : traits.skill2Code())
            + " / " + traits.skillPercent() + "%"
            + " / GF=" + (traits.gfExpireAt() == null ? "-" : GF_SNAPSHOT_FORMAT.format(traits.gfExpireAt()));
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

    private record ItemTraits(Integer skill1Code, Integer skill2Code, int skillPercent, Instant gfExpireAt) {
    }
}
