package com.finalcall.api.support;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemOwnershipHistory;
import com.finalcall.domain.item.ItemOwnershipHistoryRepository;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.item.SkillDefinition;
import com.finalcall.domain.item.SkillDefinitionRepository;
import com.finalcall.domain.item.TempStorage;
import com.finalcall.domain.item.TempStorageRepository;
import com.finalcall.domain.item.TransferType;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 로컬 데모 시드(FC-084)의 <b>트랜잭션 경계 헬퍼</b> — 도메인 서비스가 다루지 않는 데이터(아이템 인스턴스 신규
 * 발행·임시보관·초기 잔액)를 도메인 엔티티/리포지토리로 삽입한다. {@link LocalDemoSeeder}(비-트랜잭션 러너)가
 * 외부 빈으로 호출해 각 메서드가 프록시 경유 독립 트랜잭션을 갖는다(AOP self-invocation 회피). local 전용이다.
 *
 * <p>아이템 발행은 운영 경로에 존재하지 않아(카탈로그 시드 외 신규 발행 서비스가 없음) 여기서 엔티티 빌더 +
 * 소유이력(SEED) append 로 직접 만든다. 잔액 funding 은 절대값 세팅이라 원장 흐름이 없어 {@link JdbcTemplate}
 * 로 처리한다(홀드 0 상태에서 세팅되므로 이후 입찰 홀드·낙찰 차감과 정합).
 */
@Component
@Profile("local")
@RequiredArgsConstructor
public class LocalDemoDataService {

    private final ItemInstanceRepository itemInstanceRepository;
    private final ItemOwnershipHistoryRepository itemOwnershipHistoryRepository;
    private final ItemTemplateRepository itemTemplateRepository;
    private final SkillDefinitionRepository skillDefinitionRepository;
    private final TempStorageRepository tempStorageRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    /** skill_code → id 캐시(마스터, 최초 1회 로드). 절대 식별자만 담아 트랜잭션 경계를 넘어 재사용해도 안전하다. */
    private Map<Integer, Long> skillIdByCode;
    /** type_code → id 캐시(마스터 템플릿 40종, 최초 1회 로드). 대량 시드에서 반복 조회를 없앤다. */
    private Map<Integer, Long> templateIdByCode;
    /** type_code → display_name 캐시(스냅샷 원본). */
    private Map<Integer, String> templateNameByCode;

    /** V13 스펙 스냅샷 포맷의 골드포스 시각 표기(UTC ISO, '초'까지). */
    private static final DateTimeFormatter GF_SNAPSHOT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'")
        .withZone(ZoneOffset.UTC);
    /** 대량 마켓 시드 인스턴스 public_id 접두(8자) — 뒤 18자리 0패딩 인덱스로 CHAR(26) 채운다. */
    private static final String LISTED_ITEM_PREFIX = "SEEDLIST";
    /** 대량 마켓 시드 shop public_id 접두(8자). */
    private static final String LISTED_SHOP_PREFIX = "SEEDSHOP";

    /**
     * 초기 잔액을 절대값으로 세팅한다(캐시·게임머니). 가입 직후 홀드 0 상태에서 호출되므로 이후 입찰 홀드·낙찰
     * 차감이 그대로 정합한다(잔액 ≥ 홀드 불변식 유지).
     */
    @Transactional
    public void fund(Long userId, long cash, long gameMoney) {
        jdbcTemplate.update(
            "UPDATE user_balance SET cash_balance = ?, game_money_balance = ? WHERE user_id = ?",
            cash, gameMoney, userId);
    }

    /**
     * 정규 인벤토리 아이템을 발행한다(소유이력 SEED append 포함). 슬롯 유일성은 호출 측이 소유자별 증가 커서로
     * 보장하며 최종 방어선은 DB {@code slot_key} UK 다.
     *
     * @return 발행된 인스턴스의 public_id(경매 등록 입력으로 쓰인다)
     */
    @Transactional
    public String createInventoryItem(Long ownerId, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt, int slotNo) {
        return create(ownerId, typeCode, level, skill1Code, skill2Code, skillPercent, gfExpireAt,
            ItemLocation.INVENTORY, slotNo, null);
    }

    /**
     * 임시보관 아이템을 발행한다(location=TEMP + temp_storage 행 1:1, 소유이력 SEED append). relocate 데모용이며
     * {@code expireAt} 으로 만료 임박분도 심는다.
     */
    @Transactional
    public void createTempItem(Long ownerId, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt, Instant expireAt) {
        create(ownerId, typeCode, level, skill1Code, skill2Code, skillPercent, gfExpireAt,
            ItemLocation.TEMP, null, expireAt);
    }

    private String create(Long ownerId, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt, ItemLocation location, Integer slotNo, Instant tempExpireAt) {
        ItemTemplate template = itemTemplateRepository.findByTypeCode(typeCode)
            .orElseThrow(() -> new IllegalStateException("데모 시드 템플릿 없음 typeCode=" + typeCode));
        ItemInstance item = itemInstanceRepository.save(ItemInstance.builder()
            .template(template)
            .owner(userRepository.getReferenceById(ownerId))
            .level(level)
            .skill1(skillReference(skill1Code))
            .skill2(skillReference(skill2Code))
            .skillPercent(skillPercent)
            .gfExpireAt(gfExpireAt)
            .location(location)
            .slotNo(slotNo)
            .build());
        itemOwnershipHistoryRepository.save(ItemOwnershipHistory.builder()
            .instanceId(item.getId())
            .fromOwnerId(null)
            .toOwnerId(ownerId)
            .transferType(TransferType.SEED)
            .saleOrderId(null)
            .transferredAt(item.getCreatedAt())
            .build());
        if (location == ItemLocation.TEMP) {
            tempStorageRepository.save(TempStorage.builder()
                .instance(item)
                .ownerId(ownerId)
                .storedAt(item.getCreatedAt())
                .expireAt(tempExpireAt)
                .build());
        }
        return item.getPublicId();
    }

    private SkillDefinition skillReference(Integer skillCode) {
        if (skillCode == null) {
            return null;
        }
        return skillDefinitionRepository.getReferenceById(skillId(skillCode));
    }

    private Long skillId(int skillCode) {
        if (skillIdByCode == null) {
            Map<Integer, Long> loaded = new HashMap<>();
            skillDefinitionRepository.findAll().forEach(skill -> loaded.put(skill.getSkillCode(), skill.getId()));
            skillIdByCode = loaded;
        }
        Long id = skillIdByCode.get(skillCode);
        if (id == null) {
            throw new IllegalStateException("데모 시드 스킬 없음 skillCode=" + skillCode);
        }
        return id;
    }

    // ---------------- 대량 마켓 시드(FC-098) — LISTED-direct + shop 직접 INSERT ----------------

    /**
     * 고정가 마켓 리스팅을 대량으로 직접 발행한다(skill-exposure-spec §3.1 LISTED-direct). 정식
     * {@code ShopService.register}(INVENTORY 슬롯 정원 96·주체 세팅·트랜잭션 마찰)를 회피하고, 인스턴스를 처음부터
     * {@code location=LISTED}·{@code slot_no=NULL}(slot_key 생성 컬럼 NULL → UK 무충돌)로 발행하면서 shop 행을 직접
     * INSERT 한다. 세 테이블(item_instance·shop·item_ownership_history)을 {@link JdbcTemplate#batchUpdate} 로
     * 배치 삽입해 부팅 지연을 억제한다(엔티티 save 반복 회피). shop·이력은 인스턴스 public_id 자연키로 상관시켜
     * 생성 키 회수 없이 연결한다.
     *
     * <p>도메인 불변식은 LISTED-direct 라 register 경로를 타지 않으므로 배치가 안전하다(에스크로: LISTED = 출품
     * 중, 소유이력 SEED 1행). idempotency 는 호출 측(LocalDemoSeeder)의 demo1 마커가 보증한다.
     *
     * @param seeds      발행할 리스팅 명세
     * @param startIndex public_id 인덱스 시작값(1-based, 마커 유일성 유지)
     * @return 발행된 리스팅 수
     */
    @Transactional
    public int bulkCreateListedShopItems(List<ListedSeed> seeds, int startIndex) {
        if (seeds.isEmpty()) {
            return 0;
        }
        loadTemplateCache();
        Instant now = Instant.now();
        Timestamp ts = Timestamp.from(now);

        String[] itemPublicIds = new String[seeds.size()];
        String[] shopPublicIds = new String[seeds.size()];
        for (int i = 0; i < seeds.size(); i++) {
            itemPublicIds[i] = publicId(LISTED_ITEM_PREFIX, startIndex + i);
            shopPublicIds[i] = publicId(LISTED_SHOP_PREFIX, startIndex + i);
        }

        insertInstances(seeds, itemPublicIds, ts);
        insertShops(seeds, itemPublicIds, shopPublicIds, ts);
        insertOwnershipHistories(seeds, itemPublicIds, ts);
        return seeds.size();
    }

    private void insertInstances(List<ListedSeed> seeds, String[] itemPublicIds, Timestamp ts) {
        jdbcTemplate.batchUpdate(
            "INSERT INTO item_instance (public_id, template_id, owner_id, level, skill1_id, skill2_id, "
                + "skill_percent, gf_expire_at, location, slot_no, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'LISTED', NULL, ?, ?)",
            new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int row) throws SQLException {
                    ListedSeed seed = seeds.get(row);
                    ps.setString(1, itemPublicIds[row]);
                    ps.setLong(2, templateId(seed.typeCode()));
                    ps.setLong(3, seed.sellerId());
                    ps.setInt(4, seed.level());
                    setSkill(ps, 5, seed.skill1Code());
                    setSkill(ps, 6, seed.skill2Code());
                    ps.setInt(7, seed.skillPercent());
                    if (seed.gfExpireAt() == null) {
                        ps.setNull(8, Types.TIMESTAMP);
                    } else {
                        ps.setTimestamp(8, Timestamp.from(seed.gfExpireAt()));
                    }
                    ps.setTimestamp(9, ts);
                    ps.setTimestamp(10, ts);
                }

                @Override
                public int getBatchSize() {
                    return seeds.size();
                }
            });
    }

    private void insertShops(List<ListedSeed> seeds, String[] itemPublicIds, String[] shopPublicIds, Timestamp ts) {
        // item_instance.id 를 자연키(public_id)로 상관시켜 생성 키 회수 없이 연결한다.
        jdbcTemplate.batchUpdate(
            "INSERT INTO shop (public_id, seller_id, item_instance_id, price, status, end_at, "
                + "item_name_snapshot, item_spec_snapshot, created_at, updated_at) "
                + "SELECT ?, ?, ii.id, ?, 'ACTIVE', ?, ?, ?, ?, ? FROM item_instance ii WHERE ii.public_id = ?",
            new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int row) throws SQLException {
                    ListedSeed seed = seeds.get(row);
                    ps.setString(1, shopPublicIds[row]);
                    ps.setLong(2, seed.sellerId());
                    ps.setLong(3, seed.price());
                    ps.setTimestamp(4, Timestamp.from(seed.endAt()));
                    ps.setString(5, templateName(seed.typeCode()));
                    ps.setString(6, specSnapshot(seed));
                    ps.setTimestamp(7, ts);
                    ps.setTimestamp(8, ts);
                    ps.setString(9, itemPublicIds[row]);
                }

                @Override
                public int getBatchSize() {
                    return seeds.size();
                }
            });
    }

    private void insertOwnershipHistories(List<ListedSeed> seeds, String[] itemPublicIds, Timestamp ts) {
        jdbcTemplate.batchUpdate(
            "INSERT INTO item_ownership_history (instance_id, from_owner_id, to_owner_id, transfer_type, "
                + "sale_order_id, transferred_at, created_at) "
                + "SELECT ii.id, NULL, ?, 'SEED', NULL, ?, ? FROM item_instance ii WHERE ii.public_id = ?",
            new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int row) throws SQLException {
                    ps.setLong(1, seeds.get(row).sellerId());
                    ps.setTimestamp(2, ts);
                    ps.setTimestamp(3, ts);
                    ps.setString(4, itemPublicIds[row]);
                }

                @Override
                public int getBatchSize() {
                    return seeds.size();
                }
            });
    }

    private void setSkill(PreparedStatement ps, int idx, Integer skillCode) throws SQLException {
        if (skillCode == null) {
            ps.setNull(idx, Types.BIGINT);
        } else {
            ps.setLong(idx, skillId(skillCode));
        }
    }

    /** V13 스냅샷 포맷과 동형: {@code Lv.N / skill1=.../skill2=... / P% / GF=...}. */
    private String specSnapshot(ListedSeed seed) {
        return "Lv." + seed.level()
            + " / skill1=" + (seed.skill1Code() == null ? "-" : seed.skill1Code())
            + "/skill2=" + (seed.skill2Code() == null ? "-" : seed.skill2Code())
            + " / " + seed.skillPercent() + "%"
            + " / GF=" + (seed.gfExpireAt() == null ? "-" : GF_SNAPSHOT_FORMAT.format(seed.gfExpireAt()));
    }

    private String publicId(String prefix, int index) {
        return prefix + String.format("%018d", index);
    }

    private void loadTemplateCache() {
        if (templateIdByCode != null) {
            return;
        }
        Map<Integer, Long> ids = new HashMap<>();
        Map<Integer, String> names = new HashMap<>();
        itemTemplateRepository.findAll().forEach(t -> {
            ids.put(t.getTypeCode(), t.getId());
            names.put(t.getTypeCode(), t.getDisplayName());
        });
        templateIdByCode = ids;
        templateNameByCode = names;
    }

    private Long templateId(int typeCode) {
        Long id = templateIdByCode.get(typeCode);
        if (id == null) {
            throw new IllegalStateException("데모 시드 템플릿 없음 typeCode=" + typeCode);
        }
        return id;
    }

    private String templateName(int typeCode) {
        return templateNameByCode.get(typeCode);
    }

    /**
     * 대량 마켓 리스팅 1건의 발행 명세(FC-098). 마법 카드(sub_group 3)는 {@code skill1Code=null}(§6 스킬1 부재).
     */
    public record ListedSeed(Long sellerId, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, Instant gfExpireAt, long price, Instant endAt) {
    }
}
