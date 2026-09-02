package com.finalcall.support.seed;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** 운영 공개 목록 100건 시나리오를 기존 운영 계정에 격리해 적재한다. */
final class OperationsListingSeedFixture {
    static final String SCENARIO = "ops-listings-100-v1";
    private static final String ITEM_PREFIX = "OL1ITM";
    private static final String AUCTION_PREFIX = "OL1AUC";
    private static final String SHOP_PREFIX = "OL1SHP";
    private static final String BID_PREFIX = "OL1BID";

    private final Connection connection;
    private final Instant now;
    private long[] users;
    private long[] templates;
    private long[] templateSubgroups;
    private long[] items;
    private long[] auctions;
    private int[] winningBidders;

    OperationsListingSeedFixture(Connection connection) throws SQLException {
        this.connection = connection;
        this.now = databaseNow();
    }

    State state() throws SQLException {
        long itemsCount = count("SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OL1ITM%'");
        long auctionsCount = count("SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OL1AUC%'");
        long shopsCount = count("SELECT COUNT(*) FROM shop WHERE public_id LIKE 'OL1SHP%'");
        long bidsCount = count("SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OL1BID%'");
        long holdsCount = count("SELECT COUNT(*) FROM money_hold h JOIN bid b ON b.id=h.bid_id "
            + "WHERE b.public_id LIKE 'OL1BID%'");
        long historiesCount = count("SELECT COUNT(*) FROM item_ownership_history h JOIN item_instance i "
            + "ON i.id=h.instance_id WHERE i.public_id LIKE 'OL1ITM%' AND h.transfer_type='SEED'");
        if (itemsCount + auctionsCount + shopsCount + bidsCount + holdsCount + historiesCount == 0) {
            return State.EMPTY;
        }
        return itemsCount == 200 && auctionsCount == 100 && shopsCount == 100 && bidsCount == 110
            && holdsCount == 110 && historiesCount == 200 && failures().isEmpty() ? State.COMPLETE : State.PARTIAL;
    }

    void dryRun() throws SQLException {
        requireMasters();
        loadMasters();
        requireAvailableBalances();
        State current = state();
        if (current == State.PARTIAL) {
            throw new IllegalStateException("부분 적재 상태입니다. 원인 조사 후 안전하게 cleanup 해야 합니다.");
        }
        if (current == State.COMPLETE) {
            verify();
        }
        System.out.println("예정 건수: items=200 auctions=100 shops=100 bids=110 holds=110 ownership=200");
    }

    void apply() throws SQLException {
        requireMasters();
        loadMasters();
        requireAvailableBalances();
        insertItems();
        insertListings();
        insertBidsAndHolds();
        updateHeldBalances(1);
    }

    void verify() throws SQLException {
        List<String> failures = failures();
        if (!failures.isEmpty()) {
            throw new IllegalStateException("운영 목록 시드 불변식 위반: " + String.join(", ", failures));
        }
    }

    void cleanup() throws SQLException {
        detectExternalReferences();
        verify();
        updateHeldBalances(-1);
        execute("DELETE h FROM money_hold h JOIN bid b ON b.id=h.bid_id WHERE b.public_id LIKE 'OL1BID%'");
        execute("DELETE FROM bid WHERE public_id LIKE 'OL1BID%'");
        execute("DELETE FROM auction WHERE public_id LIKE 'OL1AUC%'");
        execute("DELETE FROM shop WHERE public_id LIKE 'OL1SHP%'");
        execute("DELETE h FROM item_ownership_history h JOIN item_instance i ON i.id=h.instance_id "
            + "WHERE i.public_id LIKE 'OL1ITM%'");
        execute("DELETE FROM item_instance WHERE public_id LIKE 'OL1ITM%'");
        if (state() != State.EMPTY) {
            throw new IllegalStateException("cleanup 후 EMPTY 상태가 아닙니다.");
        }
    }

    private List<String> failures() throws SQLException {
        List<String> result = new ArrayList<>();
        expect(result, "items", 200, "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OL1ITM%' "
            + "AND location='LISTED' AND slot_no IS NULL");
        expect(result, "auctions", 100, "SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OL1AUC%' "
            + "AND status='ACTIVE' AND start_at<=NOW(6) AND end_at>NOW(6)");
        expect(result, "shops", 100, "SELECT COUNT(*) FROM shop WHERE public_id LIKE 'OL1SHP%' "
            + "AND status='ACTIVE' AND end_at>NOW(6)");
        expect(result, "bids", 110, "SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OL1BID%'");
        expect(result, "activeBids", 70, "SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OL1BID%' "
            + "AND status='ACTIVE'");
        expect(result, "outbidBids", 40, "SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OL1BID%' "
            + "AND status='OUTBID'");
        expect(result, "holds", 110, "SELECT COUNT(*) FROM money_hold h JOIN bid b ON b.id=h.bid_id "
            + "AND h.user_id=b.bidder_id AND h.amount=b.amount WHERE b.public_id LIKE 'OL1BID%' "
            + "AND ((b.status='ACTIVE' AND h.status='HELD') OR (b.status='OUTBID' AND h.status='RELEASED'))");
        expect(result, "sellerBidViolation", 0, "SELECT COUNT(*) FROM bid b JOIN auction a ON a.id=b.auction_id "
            + "WHERE b.public_id LIKE 'OL1BID%' AND b.bidder_id=a.seller_id");
        expect(result, "sellerAuction", 20, sellerCountSql("auction"));
        expect(result, "sellerShop", 20, sellerCountSql("shop"));
        expect(result, "typesAuction", 40, typeCountSql("auction"));
        expect(result, "typesShop", 40, typeCountSql("shop"));
        expect(result, "levelAuction", 9, levelCountSql("auction"));
        expect(result, "levelShop", 9, levelCountSql("shop"));
        expect(result, "skillsAuction", 34, skillCountSql("auction", 0));
        expect(result, "skillsShop", 34, skillCountSql("shop", 0));
        expect(result, "singleSkillAuction", 33, skillCountSql("auction", 1));
        expect(result, "singleSkillShop", 33, skillCountSql("shop", 1));
        expect(result, "doubleSkillAuction", 33, skillCountSql("auction", 2));
        expect(result, "doubleSkillShop", 33, skillCountSql("shop", 2));
        expect(result, "singleMustUseSlot2", 0, "SELECT COUNT(*) FROM item_instance i WHERE "
            + "i.public_id LIKE 'OL1ITM%' AND i.skill1_id IS NOT NULL AND i.skill2_id IS NULL");
        expect(result, "skill1CodeRange", 0, "SELECT COUNT(*) FROM item_instance i JOIN skill_definition s "
            + "ON s.id=i.skill1_id WHERE i.public_id LIKE 'OL1ITM%' AND s.skill_code NOT BETWEEN 100 AND 197");
        expect(result, "skill2CodeRange", 0, "SELECT COUNT(*) FROM item_instance i JOIN skill_definition s "
            + "ON s.id=i.skill2_id WHERE i.public_id LIKE 'OL1ITM%' AND NOT (s.skill_code BETWEEN 200 AND 209 "
            + "OR s.skill_code BETWEEN 300 AND 435)");
        expect(result, "duplicateSkill", 0, "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OL1ITM%' "
            + "AND skill1_id=skill2_id");
        expect(result, "zeroPercentWithSkill", 0, "SELECT COUNT(*) FROM item_instance WHERE "
            + "public_id LIKE 'OL1ITM%' AND (skill1_id IS NOT NULL OR skill2_id IS NOT NULL) AND skill_percent=0");
        expectMinimum(result, "distinctSkillCodesAuction", 10, distinctSkillSql("auction"));
        expectMinimum(result, "distinctSkillCodesShop", 10, distinctSkillSql("shop"));
        expectMinimum(result, "distinctPercentAuction", 10, distinctPercentSql("auction"));
        expectMinimum(result, "distinctPercentShop", 10, distinctPercentSql("shop"));
        validateSkillApplicability(result);
        expect(result, "goldForceAuction", 50, gfCountSql("auction"));
        expect(result, "goldForceShop", 50, gfCountSql("shop"));
        expect(result, "magicSkill1Auction", 0, forbiddenMagicSkillSql("auction"));
        expect(result, "magicSkill1Shop", 0, forbiddenMagicSkillSql("shop"));
        expect(result, "skillCapAuction", 0, skillCapViolationSql("auction"));
        expect(result, "skillCapShop", 0, skillCapViolationSql("shop"));
        expect(result, "gfSkillMatrixAuction", 0, gfSkillMatrixViolationSql("auction"));
        expect(result, "gfSkillMatrixShop", 0, gfSkillMatrixViolationSql("shop"));
        expect(result, "typeDistributionAuction", 0, typeDistributionViolationSql("auction"));
        expect(result, "typeDistributionShop", 0, typeDistributionViolationSql("shop"));
        expect(result, "typeCombined", 0, "SELECT COUNT(*) FROM (SELECT t.type_code,COUNT(*) c FROM ("
            + "SELECT item_instance_id FROM auction WHERE public_id LIKE 'OL1AUC%' UNION ALL "
            + "SELECT item_instance_id FROM shop WHERE public_id LIKE 'OL1SHP%') l JOIN item_instance i "
            + "ON i.id=l.item_instance_id JOIN item_template t ON t.id=i.template_id GROUP BY t.type_code "
            + "HAVING c<>5) x");
        expect(result, "levelDistributionAuction", 0, levelDistributionViolationSql("auction"));
        expect(result, "levelDistributionShop", 0, levelDistributionViolationSql("shop"));
        expect(result, "priceDistributionAuction", 0, priceDistributionViolationSql("auction"));
        expect(result, "priceDistributionShop", 0, priceDistributionViolationSql("shop"));
        expect(result, "auctionEndDistribution", 0,
            "SELECT COUNT(*) FROM (SELECT CASE WHEN TIMESTAMPDIFF(MINUTE,created_at,end_at)<=15 THEN 1 "
                + "WHEN TIMESTAMPDIFF(MINUTE,created_at,end_at)<=360 THEN 2 "
                + "WHEN TIMESTAMPDIFF(HOUR,created_at,end_at)<=24 THEN 3 ELSE 4 END bucket,COUNT(*) c "
                + "FROM auction WHERE public_id LIKE 'OL1AUC%' GROUP BY bucket HAVING c<>CASE bucket "
                + "WHEN 1 THEN 10 WHEN 2 THEN 25 WHEN 3 THEN 35 ELSE 30 END) x");
        expect(result, "shopEndDistribution", 0,
            "SELECT COUNT(*) FROM (SELECT TIMESTAMPDIFF(DAY,created_at,end_at) days,COUNT(*) c FROM shop "
                + "WHERE public_id LIKE 'OL1SHP%' GROUP BY days HAVING days NOT IN (7,14,21,30) OR c<>25) x");
        expect(result, "buyNow", 50,
            "SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OL1AUC%' AND buy_now_price IS NOT NULL");
        expect(result, "buyNowRatioViolation", 0, "SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OL1AUC%' "
            + "AND buy_now_price IS NOT NULL AND (buy_now_price<=start_price "
            + "OR buy_now_price*100<start_price*120 OR buy_now_price*100>start_price*180 "
            + "OR buy_now_price>10000000)");
        expect(result, "noBid", 30, "SELECT COUNT(*) FROM (SELECT a.id FROM auction a LEFT JOIN bid b "
            + "ON b.auction_id=a.id WHERE a.public_id LIKE 'OL1AUC%' GROUP BY a.id HAVING COUNT(b.id)=0) x");
        expect(result, "highest", 70, "SELECT COUNT(*) FROM auction a JOIN bid b ON b.auction_id=a.id "
            + "AND b.status='ACTIVE' AND b.amount=a.highest_bid_amount AND b.bidder_id=a.highest_bidder_id "
            + "WHERE a.public_id LIKE 'OL1AUC%'");
        expect(result, "sellerOwner", 200, "SELECT COUNT(*) FROM item_instance i LEFT JOIN auction a "
            + "ON a.item_instance_id=i.id LEFT JOIN shop s ON s.item_instance_id=i.id "
            + "WHERE i.public_id LIKE 'OL1ITM%' AND i.owner_id=COALESCE(a.seller_id,s.seller_id)");
        expect(result, "snapshot", 200, snapshotMatchSql());
        expect(result, "snapshotName", 200, "SELECT COUNT(*) FROM item_instance i JOIN item_template t "
            + "ON t.id=i.template_id LEFT JOIN auction a ON a.item_instance_id=i.id LEFT JOIN shop s "
            + "ON s.item_instance_id=i.id WHERE i.public_id LIKE 'OL1ITM%' "
            + "AND COALESCE(a.item_name_snapshot,s.item_name_snapshot)=t.display_name");
        expect(result, "history", 200, "SELECT COUNT(*) FROM item_ownership_history h JOIN item_instance i "
            + "ON i.id=h.instance_id AND h.to_owner_id=i.owner_id WHERE i.public_id LIKE 'OL1ITM%' "
            + "AND h.transfer_type='SEED' AND h.from_owner_id IS NULL");
        expect(result, "heldGlobal", 20, "SELECT COUNT(*) FROM user_balance ub JOIN user u ON u.id=ub.user_id "
            + "LEFT JOIN (SELECT user_id,SUM(amount) amount FROM money_hold WHERE status='HELD' GROUP BY user_id) h "
            + "ON h.user_id=u.id WHERE u.login_id REGEXP '^test(0[1-9]|1[0-9]|20)$' "
            + "AND ub.game_money_held=COALESCE(h.amount,0) AND ub.game_money_balance-ub.game_money_held>=0");
        return result;
    }

    private void requireMasters() throws SQLException {
        expectExact("기존 판매자 계정 test01~test20", 20,
            "SELECT COUNT(*) FROM user WHERE login_id REGEXP '^test(0[1-9]|1[0-9]|20)$' AND is_deleted=0");
        expectExact("item_template 40 type", 40, "SELECT COUNT(DISTINCT type_code) FROM item_template");
        if (count("SELECT COUNT(*) FROM skill_definition") < 2) {
            throw new IllegalStateException("스킬 마스터가 부족합니다.");
        }
        if (state() == State.PARTIAL) {
            throw new IllegalStateException("부분 적재 상태에서는 apply할 수 없습니다.");
        }
    }

    private void loadMasters() throws SQLException {
        users = ids("SELECT id FROM user WHERE login_id REGEXP '^test(0[1-9]|1[0-9]|20)$' ORDER BY login_id");
        templates = ids("SELECT id FROM item_template ORDER BY type_code");
        templateSubgroups = ids("SELECT sub_group FROM item_template ORDER BY type_code");
        requireSkillCandidates();
    }

    private void requireAvailableBalances() throws SQLException {
        long[] remaining = new long[20];
        for (int i = 0; i < users.length; i++) {
            remaining[i] = count("SELECT game_money_balance-game_money_held FROM user_balance WHERE user_id=? "
                + "FOR UPDATE",
                users[i]);
        }
        winningBidders = new int[70];
        for (int auction = 69; auction >= 0; auction--) {
            int seller = auction % 20;
            long amount = bidAmount(auction);
            int selected = -1;
            for (int user = 0; user < remaining.length; user++) {
                if (user != seller && remaining[user] >= amount
                    && (selected < 0 || remaining[user] > remaining[selected])) {
                    selected = user;
                }
            }
            if (selected < 0) {
                throw new IllegalStateException("기존 계정의 가용 게임머니로 전체 입찰을 안전하게 배정할 수 없습니다.");
            }
            winningBidders[auction] = selected;
            remaining[selected] -= amount;
        }
    }

    private void insertItems() throws SQLException {
        items = new long[201];
        for (int channel = 0; channel < 2; channel++) {
            int[] skillCounts = skillCounts(channel);
            int[] skillOrdinals = new int[3];
            for (int i = 0; i < 100; i++) {
                int number = channel * 100 + i + 1;
                int seller = i % 20;
                int skillCount = skillCounts[i];
                int level = level(i);
                String publicId = key(ITEM_PREFIX, number);
                SkillAssignment assignment = assignment(publicId, templates[templateIndex(channel, i)], skillCount,
                    level);
                int skillOrdinal = skillOrdinals[skillCount]++;
                boolean goldForce = skillCount == 0 ? skillOrdinal >= 17
                    : skillCount == 1 ? skillOrdinal >= 16 : skillOrdinal >= 17;
                Timestamp gf = goldForce ? ts(now.plus(7L + i % 84, ChronoUnit.DAYS)) : null;
                execute("INSERT INTO item_instance(public_id,template_id,owner_id,level,skill1_id,skill2_id,"
                    + "skill_percent,gf_expire_at,location,slot_no,created_at,updated_at) "
                    + "VALUES(?,?,?,?,?,?,?,?,'LISTED',NULL,?,?)",
                    publicId, templates[templateIndex(channel, i)], users[seller], level, assignment.skill1Id(),
                    assignment.skill2Id(), assignment.percent(), gf, ts(now), ts(now));
                items[number] = lastId();
                execute("INSERT INTO item_ownership_history(instance_id,from_owner_id,to_owner_id,transfer_type,"
                    + "sale_order_id,transferred_at,created_at) VALUES(?,NULL,?,'SEED',NULL,?,?)", items[number],
                    users[seller], ts(now), ts(now));
            }
        }
    }

    void redistributeSkills() throws SQLException {
        lockNamespaceRows();
        requireRepairShape();
        detectActiveExternalReferences();
        requireSkillCandidates();
        ExcludedState excludedBefore = excludedState();
        for (int channel = 0; channel < 2; channel++) {
            List<RepairItem> channelItems = repairItems(channel);
            int[] counts = redistributedSkillCounts(channelItems);
            for (int i = 0; i < channelItems.size(); i++) {
                RepairItem item = channelItems.get(i);
                SkillAssignment assignment = assignment(item.publicId(), item.templateId(), counts[i], item.level());
                if (update("UPDATE item_instance SET skill1_id=?,skill2_id=?,skill_percent=?,updated_at=NOW(6) "
                    + "WHERE id=?", assignment.skill1Id(), assignment.skill2Id(), assignment.percent(),
                    item.id()) != 1) {
                    throw new IllegalStateException("스킬 갱신 대상이 정확히 한 건이 아닙니다: " + item.publicId());
                }
                ItemSnapshot snapshot = snapshot(item.id());
                int listings = update("UPDATE auction SET item_spec_snapshot=?,updated_at=NOW(6) "
                    + "WHERE item_instance_id=? AND public_id LIKE 'OL1AUC%' AND status='ACTIVE'",
                    snapshot.spec(), item.id());
                listings += update("UPDATE shop SET item_spec_snapshot=?,updated_at=NOW(6) "
                    + "WHERE item_instance_id=? AND public_id LIKE 'OL1SHP%' AND status='ACTIVE'",
                    snapshot.spec(), item.id());
                if (listings != 1) {
                    throw new IllegalStateException("아이템별 ACTIVE listing이 정확히 한 건이 아닙니다: " + item.publicId());
                }
            }
        }
        if (!excludedBefore.equals(excludedState())) {
            throw new IllegalStateException("SOLD 또는 비대상 INVENTORY 아이템이 변경되었습니다.");
        }
    }

    void verifyRedistribution() throws SQLException {
        verifyActiveSkillValueInvariants();
        List<String> result = new ArrayList<>();
        int activeAuctions = activeCount("auction", "OL1AUC%");
        int activeShops = activeCount("shop", "OL1SHP%");
        verifyAdaptiveDistribution(result, "Auction", "auction", activeAuctions);
        verifyAdaptiveDistribution(result, "Shop", "shop", activeShops);
        expectMinimum(result, "activeDistinctSkillAuction", 10, distinctSkillSql("auction"));
        expectMinimum(result, "activeDistinctSkillShop", 10, distinctSkillSql("shop"));
        expectMinimum(result, "activeDistinctPercentAuction", 10, distinctPercentSql("auction"));
        expectMinimum(result, "activeDistinctPercentShop", 10, distinctPercentSql("shop"));
        expect(result, "activeSingleMustUseSlot2", 0, activeItemCountSql()
            + "i.skill1_id IS NOT NULL AND i.skill2_id IS NULL");
        expect(result, "activeNonePercent", 0, activeItemCountSql()
            + "i.skill1_id IS NULL AND i.skill2_id IS NULL AND i.skill_percent<>0");
        expect(result, "activeSkilledPercent", 0, activeItemCountSql()
            + "(i.skill1_id IS NOT NULL OR i.skill2_id IS NOT NULL) "
            + "AND i.skill_percent<1");
        expect(result, "activeSkillCap", 0, activeItemCountSql()
            + "i.skill_percent>CASE i.level WHEN 1 THEN 9 WHEN 2 THEN 15 WHEN 3 THEN 19 WHEN 4 THEN 23 "
            + "WHEN 5 THEN 25 WHEN 6 THEN 27 WHEN 7 THEN 31 WHEN 8 THEN 33 ELSE 36 END");
        expect(result, "activeDuplicateSkill", 0, activeItemCountSql() + "i.skill1_id=i.skill2_id");
        validateActiveSkillApplicability(result);
        expect(result, "activeSnapshot", activeAuctions + activeShops, activeSnapshotMatchSql());
        if (!result.isEmpty()) {
            throw new IllegalStateException("ACTIVE 스킬 재분배 불변식 위반: " + String.join(", ", result));
        }
    }

    private void verifyAdaptiveDistribution(List<String> failures, String name, String table, int active)
        throws SQLException {
        Quotas quotas = quotas(active);
        expect(failures, "active" + name + "None", quotas.none(), activeSkillCountSql(table, 0));
        expect(failures, "active" + name + "Single", quotas.single(), activeSkillCountSql(table, 1));
        expect(failures, "active" + name + "Double", quotas.doubleSkill(), activeSkillCountSql(table, 2));
    }

    private void verifyActiveSkillValueInvariants() throws SQLException {
        List<String> violations = new ArrayList<>();
        expect(violations, "activeSingleMustUseSlot2", 0, activeItemCountSql()
            + "i.skill1_id IS NOT NULL AND i.skill2_id IS NULL");
        expect(violations, "activeNonePercent", 0, activeItemCountSql()
            + "i.skill1_id IS NULL AND i.skill2_id IS NULL AND i.skill_percent<>0");
        expect(violations, "activeSkilledPercent", 0, activeItemCountSql()
            + "(i.skill1_id IS NOT NULL OR i.skill2_id IS NOT NULL) AND i.skill_percent<1");
        expect(violations, "activeSkillCap", 0, activeItemCountSql()
            + "i.skill_percent>CASE i.level WHEN 1 THEN 9 WHEN 2 THEN 15 WHEN 3 THEN 19 WHEN 4 THEN 23 "
            + "WHEN 5 THEN 25 WHEN 6 THEN 27 WHEN 7 THEN 31 WHEN 8 THEN 33 ELSE 36 END");
        expect(violations, "activeDuplicateSkill", 0, activeItemCountSql() + "i.skill1_id=i.skill2_id");
        if (!violations.isEmpty()) {
            throw new IllegalStateException("ACTIVE 스킬 값 불변식 위반: " + String.join(", ", violations));
        }
    }

    private void lockNamespaceRows() throws SQLException {
        ids("SELECT id FROM item_instance WHERE public_id LIKE 'OL1ITM%' ORDER BY id FOR UPDATE");
        ids("SELECT id FROM auction WHERE public_id LIKE 'OL1AUC%' ORDER BY id FOR UPDATE");
        ids("SELECT id FROM shop WHERE public_id LIKE 'OL1SHP%' ORDER BY id FOR UPDATE");
    }

    private void requireRepairShape() throws SQLException {
        expectExact("재분배 대상 아이템", 200,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OL1ITM%'");
        int activeAuctions = activeCount("auction", "OL1AUC%");
        int activeShops = activeCount("shop", "OL1SHP%");
        quotas(activeAuctions);
        quotas(activeShops);
        int activeTotal = activeAuctions + activeShops;
        expectExact("ACTIVE 아이템별 listing 1:1", activeTotal, "SELECT COUNT(*) FROM item_instance i LEFT JOIN auction a "
            + "ON a.item_instance_id=i.id AND a.public_id LIKE 'OL1AUC%' AND a.status='ACTIVE' LEFT JOIN shop s "
            + "ON s.item_instance_id=i.id AND s.public_id LIKE 'OL1SHP%' AND s.status='ACTIVE' "
            + "WHERE i.public_id LIKE 'OL1ITM%' "
            + "AND (a.id IS NOT NULL)+(s.id IS NOT NULL)=1");
        expectExact("재분배 제외 SOLD 또는 미연결 아이템", 200 - activeTotal, "SELECT COUNT(*) FROM item_instance i "
            + "WHERE i.public_id LIKE 'OL1ITM%' AND NOT EXISTS (SELECT 1 FROM auction a "
            + "WHERE a.item_instance_id=i.id AND a.status='ACTIVE') AND NOT EXISTS (SELECT 1 FROM shop s "
            + "WHERE s.item_instance_id=i.id AND s.status='ACTIVE')");
    }

    private void insertListings() throws SQLException {
        auctions = new long[101];
        for (int i = 0; i < 100; i++) {
            int seller = i % 20;
            long startPrice = price(i, 5_000_000L);
            Instant end = auctionEnd(i);
            Long buyNow = i < 50 ? Math.min(10_000_000L, startPrice * (120L + i % 61) / 100) : null;
            ItemSnapshot snapshot = snapshot(items[i + 1]);
            execute("INSERT INTO auction(public_id,seller_id,item_instance_id,start_price,buy_now_price,status,"
                + "result_type,highest_bid_amount,highest_bidder_id,start_at,end_at,base_end_at,max_end_at,"
                + "soft_close_window_sec,soft_close_extend_sec,extension_count,item_name_snapshot,"
                + "item_spec_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',NULL,NULL,NULL,?,?,?,?,"
                + "300,300,0,?,?,?,?)",
                key(AUCTION_PREFIX, i + 1), users[seller], items[i + 1], startPrice, buyNow,
                ts(now.minus(1, ChronoUnit.DAYS)), ts(end), ts(end), ts(end.plus(30, ChronoUnit.MINUTES)),
                snapshot.name(), snapshot.spec(), ts(now), ts(now));
            auctions[i + 1] = lastId();
        }
        for (int i = 0; i < 100; i++) {
            int seller = i % 20;
            ItemSnapshot snapshot = snapshot(items[i + 101]);
            execute("INSERT INTO shop(public_id,seller_id,item_instance_id,price,status,end_at,item_name_snapshot,"
                + "item_spec_snapshot,created_at,updated_at) VALUES(?,?,?,?,'ACTIVE',?,?,?,?,?)",
                key(SHOP_PREFIX, i + 1), users[seller], items[i + 101], price(i, 10_000_000L),
                ts(now.plus(new int[] {7, 14, 21, 30}[i / 25], ChronoUnit.DAYS)), snapshot.name(), snapshot.spec(),
                ts(now), ts(now));
        }
    }

    private void insertBidsAndHolds() throws SQLException {
        int bidNumber = 0;
        for (int i = 0; i < 70; i++) {
            int seller = i % 20;
            int bidder = (seller + 1) % 20;
            long start = price(i, 5_000_000L);
            if (i < 40) {
                bidNumber++;
                long oldAmount = start + 1_000;
                insertBid(bidNumber, i + 1, bidder, oldAmount, "OUTBID", "RELEASED",
                    now.minus(2, ChronoUnit.HOURS));
            }
            bidNumber++;
            int winner = winningBidders[i];
            long amount = bidAmount(i);
            insertBid(bidNumber, i + 1, winner, amount, "ACTIVE", "HELD", now.minus(1, ChronoUnit.HOURS));
            execute("UPDATE auction SET highest_bid_amount=?,highest_bidder_id=? WHERE id=?", amount, users[winner],
                auctions[i + 1]);
        }
    }

    private void insertBid(int number, int auction, int bidder, long amount, String status, String holdStatus,
        Instant createdAt) throws SQLException {
        execute("INSERT INTO bid(public_id,auction_id,bidder_id,amount,status,created_at,updated_at) "
            + "VALUES(?,?,?,?,?,?,?)", key(BID_PREFIX, number), auctions[auction], users[bidder], amount, status,
            ts(createdAt), ts(createdAt));
        long bidId = lastId();
        execute("INSERT INTO money_hold(user_id,bid_id,amount,status,released_at,created_at,updated_at) "
            + "VALUES(?,?,?,?,?,?,?)", users[bidder], bidId, amount, holdStatus,
            "RELEASED".equals(holdStatus) ? ts(createdAt.plus(30, ChronoUnit.MINUTES)) : null, ts(createdAt),
            ts(createdAt));
    }

    private void updateHeldBalances(int direction) throws SQLException {
        String safety = direction > 0 ? "ub.game_money_balance-ub.game_money_held>=x.amount"
            : "ub.game_money_held>=x.amount";
        int updated = update("UPDATE user_balance ub JOIN (SELECT h.user_id,SUM(h.amount) amount FROM money_hold h "
            + "JOIN bid b ON b.id=h.bid_id WHERE b.public_id LIKE 'OL1BID%' AND h.status='HELD' GROUP BY h.user_id) x "
            + "ON x.user_id=ub.user_id SET ub.game_money_held=ub.game_money_held+(?*x.amount),ub.updated_at=NOW(6) "
            + "WHERE " + safety, direction);
        long expected = count("SELECT COUNT(DISTINCT h.user_id) FROM money_hold h JOIN bid b ON b.id=h.bid_id "
            + "WHERE b.public_id LIKE 'OL1BID%' AND h.status='HELD'");
        if (updated != expected) {
            throw new IllegalStateException("잔액 조건부 갱신 충돌로 전체 작업을 중단합니다.");
        }
    }

    private void detectExternalReferences() throws SQLException {
        long references = count("SELECT (SELECT COUNT(*) FROM sale_order o JOIN auction a ON a.id=o.source_id "
            + "WHERE o.source_type='AUCTION' AND a.public_id LIKE 'OL1AUC%')+(SELECT COUNT(*) FROM sale_order o "
            + "JOIN shop s ON s.id=o.source_id WHERE o.source_type='SHOP' AND s.public_id LIKE 'OL1SHP%')+"
            + "(SELECT COUNT(*) FROM bid b JOIN auction a ON a.id=b.auction_id WHERE a.public_id LIKE 'OL1AUC%' "
            + "AND b.public_id NOT LIKE 'OL1BID%')+(SELECT COUNT(*) FROM item_ownership_history h "
            + "JOIN item_instance i ON i.id=h.instance_id WHERE i.public_id LIKE 'OL1ITM%' "
            + "AND h.transfer_type<>'SEED')+(SELECT COUNT(*) FROM temp_storage x JOIN item_instance i "
            + "ON i.id=x.instance_id WHERE i.public_id LIKE 'OL1ITM%')+(SELECT COUNT(*) FROM item_delivery d "
            + "JOIN item_instance i ON i.id=d.item_instance_id WHERE i.public_id LIKE 'OL1ITM%')");
        if (references != 0) {
            throw new IllegalStateException("외부 거래/입찰/소유권 참조가 있어 cleanup을 거부합니다.");
        }
    }

    private void detectActiveExternalReferences() throws SQLException {
        long references = count("SELECT (SELECT COUNT(*) FROM sale_order o JOIN auction a ON a.id=o.source_id "
            + "WHERE o.source_type='AUCTION' AND a.public_id LIKE 'OL1AUC%' AND a.status='ACTIVE')+"
            + "(SELECT COUNT(*) FROM sale_order o JOIN shop s ON s.id=o.source_id WHERE o.source_type='SHOP' "
            + "AND s.public_id LIKE 'OL1SHP%' AND s.status='ACTIVE')+(SELECT COUNT(*) FROM bid b JOIN auction a "
            + "ON a.id=b.auction_id WHERE a.public_id LIKE 'OL1AUC%' AND a.status='ACTIVE' "
            + "AND b.public_id NOT LIKE 'OL1BID%')+(SELECT COUNT(*) FROM item_ownership_history h "
            + "JOIN item_instance i ON i.id=h.instance_id LEFT JOIN auction a ON a.item_instance_id=i.id "
            + "LEFT JOIN shop s ON s.item_instance_id=i.id WHERE i.public_id LIKE 'OL1ITM%' "
            + "AND (a.status='ACTIVE' OR s.status='ACTIVE') AND h.transfer_type<>'SEED')+"
            + "(SELECT COUNT(*) FROM temp_storage x JOIN item_instance i ON i.id=x.instance_id "
            + "WHERE i.public_id LIKE 'OL1ITM%' AND (EXISTS (SELECT 1 FROM auction a WHERE a.item_instance_id=i.id "
            + "AND a.status='ACTIVE') OR EXISTS (SELECT 1 FROM shop s WHERE s.item_instance_id=i.id "
            + "AND s.status='ACTIVE')))+(SELECT COUNT(*) FROM item_delivery d JOIN item_instance i "
            + "ON i.id=d.item_instance_id WHERE i.public_id LIKE 'OL1ITM%' AND (EXISTS (SELECT 1 FROM auction a "
            + "WHERE a.item_instance_id=i.id AND a.status='ACTIVE') OR EXISTS (SELECT 1 FROM shop s "
            + "WHERE s.item_instance_id=i.id AND s.status='ACTIVE')))");
        if (references != 0) {
            throw new IllegalStateException("ACTIVE 대상에 외부 거래 또는 소유권 참조가 있습니다.");
        }
    }

    private ExcludedState excludedState() throws SQLException {
        String sql = "SELECT SHA2(GROUP_CONCAT(CONCAT(i.public_id,':',COALESCE(i.skill1_id,0),':',"
            + "COALESCE(i.skill2_id,0),':',i.skill_percent,':',COALESCE(a.item_spec_snapshot,'')) "
            + "ORDER BY i.public_id SEPARATOR '|'),256) FROM item_instance i LEFT JOIN auction a "
            + "ON a.item_instance_id=i.id AND a.public_id LIKE 'OL1AUC%' LEFT JOIN shop s "
            + "ON s.item_instance_id=i.id AND s.public_id LIKE 'OL1SHP%' WHERE i.public_id LIKE 'OL1ITM%' "
            + "AND NOT EXISTS (SELECT 1 FROM auction active_a WHERE active_a.item_instance_id=i.id "
            + "AND active_a.status='ACTIVE') AND NOT EXISTS (SELECT 1 FROM shop active_s "
            + "WHERE active_s.item_instance_id=i.id AND active_s.status='ACTIVE')";
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet row = statement.executeQuery()) {
            row.next();
            String checksum = String.valueOf(row.getString(1));
            long excluded = count("SELECT COUNT(*) FROM item_instance i WHERE i.public_id LIKE 'OL1ITM%' "
                + "AND NOT EXISTS (SELECT 1 FROM auction a WHERE a.item_instance_id=i.id AND a.status='ACTIVE') "
                + "AND NOT EXISTS (SELECT 1 FROM shop s WHERE s.item_instance_id=i.id AND s.status='ACTIVE')");
            return new ExcludedState(excluded, checksum);
        }
    }

    private String sellerCountSql(String table) {
        return "SELECT COUNT(*) FROM (SELECT seller_id,COUNT(*) c FROM " + table + " WHERE public_id LIKE 'OL1%"
            + ("auction".equals(table) ? "AUC" : "SHP") + "%' GROUP BY seller_id HAVING c=5) x";
    }

    private String typeCountSql(String table) {
        return "SELECT COUNT(DISTINCT t.type_code) FROM " + table + " l JOIN item_instance i "
            + "ON i.id=l.item_instance_id JOIN item_template t ON t.id=i.template_id WHERE l.public_id LIKE 'OL1%"
            + ("auction".equals(table) ? "AUC" : "SHP") + "%'";
    }

    private String levelCountSql(String table) {
        return "SELECT COUNT(DISTINCT i.level) FROM " + table + " l JOIN item_instance i ON i.id=l.item_instance_id "
            + "WHERE l.public_id LIKE 'OL1%" + ("auction".equals(table) ? "AUC" : "SHP") + "%'";
    }

    private String skillCountSql(String table, int count) {
        String predicate = "(i.skill1_id IS NULL)+(i.skill2_id IS NULL)=2";
        if (count == 1) {
            predicate = "(i.skill1_id IS NOT NULL)+(i.skill2_id IS NOT NULL)=1";
        } else if (count == 2) {
            predicate = "i.skill1_id IS NOT NULL AND i.skill2_id IS NOT NULL";
        } else if (count != 0) {
            throw new IllegalArgumentException("지원하지 않는 스킬 수입니다.");
        }
        return "SELECT COUNT(*) FROM " + table + " l JOIN item_instance i ON i.id=l.item_instance_id WHERE "
            + "l.public_id LIKE 'OL1%" + ("auction".equals(table) ? "AUC" : "SHP") + "%' AND "
            + predicate;
    }

    private String activeSkillCountSql(String table, int count) {
        return skillCountSql(table, count) + " AND l.status='ACTIVE'";
    }

    private String forbiddenMagicSkillSql(String table) {
        return "SELECT COUNT(*) FROM " + table + " l JOIN item_instance i ON i.id=l.item_instance_id "
            + "JOIN item_template t ON t.id=i.template_id WHERE l.public_id LIKE 'OL1%"
            + ("auction".equals(table) ? "AUC" : "SHP") + "%' AND t.sub_group=3 AND i.skill1_id IS NOT NULL";
    }

    private String skillCapViolationSql(String table) {
        return "SELECT COUNT(*) FROM " + table + " l JOIN item_instance i ON i.id=l.item_instance_id WHERE "
            + "l.public_id LIKE 'OL1%" + ("auction".equals(table) ? "AUC" : "SHP")
            + "%' AND i.skill_percent>CASE i.level WHEN 1 THEN 9 WHEN 2 THEN 15 WHEN 3 THEN 19 WHEN 4 THEN 23 "
            + "WHEN 5 THEN 25 WHEN 6 THEN 27 WHEN 7 THEN 31 WHEN 8 THEN 33 ELSE 36 END";
    }

    private String gfSkillMatrixViolationSql(String table) {
        String prefix = "auction".equals(table) ? "AUC" : "SHP";
        return "SELECT COUNT(*) FROM (SELECT ((i.skill1_id IS NOT NULL)+(i.skill2_id IS NOT NULL)) skills,"
            + "(i.gf_expire_at IS NOT NULL) gf,COUNT(*) c FROM " + table
            + " l JOIN item_instance i ON i.id=l.item_instance_id WHERE l.public_id LIKE 'OL1%" + prefix
            + "%' GROUP BY skills,gf HAVING c<>CASE WHEN skills=0 THEN 17 WHEN skills=1 AND gf=0 THEN 16 "
            + "WHEN skills=1 AND gf=1 THEN 17 WHEN skills=2 AND gf=0 THEN 17 ELSE 16 END) x";
    }

    private String typeDistributionViolationSql(String table) {
        String prefix = "auction".equals(table) ? "AUC" : "SHP";
        return "SELECT COUNT(*) FROM (SELECT t.type_code,COUNT(*) c FROM " + table
            + " l JOIN item_instance i ON i.id=l.item_instance_id JOIN item_template t ON t.id=i.template_id "
            + "WHERE l.public_id LIKE 'OL1%" + prefix + "%' GROUP BY t.type_code HAVING c NOT IN (2,3)) x";
    }

    private String levelDistributionViolationSql(String table) {
        String prefix = "auction".equals(table) ? "AUC" : "SHP";
        return "SELECT COUNT(*) FROM (SELECT i.level,COUNT(*) c FROM " + table
            + " l JOIN item_instance i ON i.id=l.item_instance_id WHERE l.public_id LIKE 'OL1%" + prefix
            + "%' GROUP BY i.level HAVING c<>CASE WHEN i.level=9 THEN 12 ELSE 11 END) x";
    }

    private String priceDistributionViolationSql(String table) {
        String prefix = "auction".equals(table) ? "AUC" : "SHP";
        String priceColumn = "auction".equals(table) ? "l.start_price" : "l.price";
        return "SELECT COUNT(*) FROM (SELECT CASE WHEN " + priceColumn + "<100000 THEN 1 WHEN " + priceColumn
            + "<500000 THEN 2 WHEN " + priceColumn + "<1000000 THEN 3 WHEN " + priceColumn
            + "<3000000 THEN 4 ELSE 5 END bucket,COUNT(*) c FROM " + table
            + " l WHERE l.public_id LIKE 'OL1%" + prefix + "%' GROUP BY bucket HAVING c<>20) x";
    }

    private String snapshotMatchSql() {
        String expected = "CONCAT('Lv.',i.level,' / skill1=',COALESCE(s1.skill_code,'-'),'/skill2=',"
            + "COALESCE(s2.skill_code,'-'),' / ',i.skill_percent,'% / GF=',"
            + "COALESCE(DATE_FORMAT(i.gf_expire_at,'%Y-%m-%dT%H:%i:%sZ'),'-'))";
        return "SELECT COUNT(*) FROM item_instance i JOIN item_template t ON t.id=i.template_id "
            + "LEFT JOIN skill_definition s1 ON s1.id=i.skill1_id LEFT JOIN skill_definition s2 ON s2.id=i.skill2_id "
            + "LEFT JOIN auction a ON a.item_instance_id=i.id LEFT JOIN shop s ON s.item_instance_id=i.id "
            + "WHERE i.public_id LIKE 'OL1ITM%' AND COALESCE(a.item_name_snapshot,s.item_name_snapshot)=t.display_name "
            + "AND COALESCE(a.item_spec_snapshot,s.item_spec_snapshot)=" + expected;
    }

    private int[] skillCounts(int channel) {
        int[] result = new int[100];
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            order.add(i);
        }
        order.sort(Comparator.comparing(index -> hashHex(key(ITEM_PREFIX, channel * 100 + index + 1), "group")));
        int doubles = 0;
        for (int index : order) {
            if (doubles < 33 && templateSubgroups[templateIndex(channel, index)] != 3) {
                result[index] = 2;
                doubles++;
            }
        }
        int singles = 0;
        for (int index : order) {
            if (result[index] == 0 && singles < 33) {
                result[index] = 1;
                singles++;
            }
        }
        return result;
    }

    private int[] redistributedSkillCounts(List<RepairItem> items) {
        int[] result = new int[items.size()];
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            order.add(i);
        }
        order.sort(Comparator.comparing(index -> hashHex(items.get(index).publicId(), "group")));
        Quotas quotas = quotas(items.size());
        int doubles = 0;
        for (int index : order) {
            if (doubles < quotas.doubleSkill() && items.get(index).subGroup() != 3) {
                result[index] = 2;
                doubles++;
            }
        }
        int singles = 0;
        for (int index : order) {
            if (result[index] == 0 && singles < quotas.single()) {
                result[index] = 1;
                singles++;
            }
        }
        if (doubles != quotas.doubleSkill() || singles != quotas.single()) {
            throw new IllegalStateException("채널별 스킬 분포를 구성할 수 없습니다.");
        }
        return result;
    }

    private SkillAssignment assignment(String publicId, long templateId, int count, int level) throws SQLException {
        if (count == 0) {
            return new SkillAssignment(null, null, 0);
        }
        TemplateAxes axes = templateAxes(templateId);
        Long skill1 = count == 2 ? selectCandidate(skill1Candidates(axes), publicId, "skill1") : null;
        Long skill2 = selectCandidate(skill2Candidates(axes), publicId, "skill2");
        if (skill1 != null && skill1.equals(skill2)) {
            throw new IllegalStateException("동일 스킬이 두 슬롯에 배치되었습니다.");
        }
        int percent = 1 + hashModulo(publicId, "percent", maxPercent(level));
        return new SkillAssignment(skill1, skill2, percent);
    }

    private List<SkillCandidate> skill1Candidates(TemplateAxes axes) throws SQLException {
        String target = axes.subGroup() == 1 ? "도끼·지팡이·검·활"
            : axes.kind() == 1 ? "방패" : axes.kind() == 2 ? "펜던트"
                : axes.kind() == 3 ? "갑옷" : "부츠";
        return candidates("skill_code BETWEEN 100 AND 197 AND description LIKE ?", "%" + target + "%");
    }

    private List<SkillCandidate> skill2Candidates(TemplateAxes axes) throws SQLException {
        String target = axes.subGroup() == 1 ? switch (axes.kind()) {
            case 1 -> "도끼";
            case 2 -> "지팡이";
            case 3 -> "검";
            default -> "활";
        } : axes.subGroup() == 2 ? switch (axes.kind()) {
            case 1 -> "방패";
            case 2 -> "펜던트";
            case 3 -> "갑옷";
            default -> "부츠";
        } : "마법";
        List<SkillCandidate> all = candidates("(skill_code BETWEEN 200 AND 209 OR skill_code BETWEEN 300 AND 435)");
        return all.stream().filter(skill -> applicable(skill, target, axes)).toList();
    }

    private boolean applicable(SkillCandidate skill, String target, TemplateAxes axes) {
        String description = normalizeTargets(skill.description());
        if (skill.code() >= 386) {
            return true;
        }
        if (!supportsTarget(description, target)) {
            return false;
        }
        if (axes.subGroup() != 3) {
            return true;
        }
        if (description.contains("마법(물/흙)")) {
            return axes.element() == 1 || axes.element() == 3;
        }
        if (description.contains("마법(불/바람)")) {
            return axes.element() == 2 || axes.element() == 4;
        }
        return true;
    }

    private String normalizeTargets(String description) {
        return description.replace("마법(물흙)", "마법(물/흙)").replace("마법(물,흙)", "마법(물/흙)")
            .replace("마법(물·흙)", "마법(물/흙)").replace("마법(불바)", "마법(불/바람)")
            .replace("마법(불,바)", "마법(불/바람)").replace("마법(불·바람)", "마법(불/바람)");
    }

    private boolean supportsTarget(String description, String target) {
        String targets = normalizeTargets(description).replace(" 적용", "")
            .replace("마법(물/흙)", "마법물흙").replace("마법(불/바람)", "마법불바람");
        for (String token : targets.split("·")) {
            String normalized = token.trim();
            if (normalized.equals(target) || "마법".equals(target) && normalized.startsWith("마법")) {
                return true;
            }
        }
        return false;
    }

    private void validateSkillApplicability(List<String> failures) throws SQLException {
        validateSkillApplicability(failures, false);
    }

    private void validateActiveSkillApplicability(List<String> failures) throws SQLException {
        validateSkillApplicability(failures, true);
    }

    private void validateSkillApplicability(List<String> failures, boolean activeOnly) throws SQLException {
        int violations = 0;
        List<String> details = new ArrayList<>();
        String sql = "SELECT t.sub_group,t.element,t.kind,s1.skill_code,s1.description,s2.skill_code,s2.description "
            + "FROM item_instance i JOIN item_template t ON t.id=i.template_id "
            + "LEFT JOIN skill_definition s1 ON s1.id=i.skill1_id "
            + "LEFT JOIN skill_definition s2 ON s2.id=i.skill2_id WHERE i.public_id LIKE 'OL1ITM%'"
            + (activeOnly ? " AND EXISTS (SELECT 1 FROM auction a WHERE a.item_instance_id=i.id AND a.status='ACTIVE' "
                + "UNION ALL SELECT 1 FROM shop s WHERE s.item_instance_id=i.id AND s.status='ACTIVE')" : "");
        try (PreparedStatement statement = connection.prepareStatement(sql);
            ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                TemplateAxes axes = new TemplateAxes(rows.getInt(1), rows.getInt(2), rows.getInt(3));
                Integer skill1 = (Integer)rows.getObject(4);
                Integer skill2 = (Integer)rows.getObject(6);
                if (skill1 != null && !independentlyApplicable(axes, skill1, rows.getString(5), true)
                    || skill2 != null && !independentlyApplicable(axes, skill2, rows.getString(7), false)) {
                    violations++;
                    details.add(axes + ":" + skill1 + "/" + skill2);
                }
            }
        }
        if (violations != 0) {
            failures.add("skillApplicability=" + violations + "/0 " + details);
        }
    }

    private boolean independentlyApplicable(TemplateAxes axes, int code, String rawDescription, boolean slot1) {
        if (slot1 && (code < 100 || code > 197) || !slot1 && !(code >= 200 && code <= 209
            || code >= 300 && code <= 435)) {
            return false;
        }
        if (slot1 && axes.subGroup() == 3) {
            return false;
        }
        String description = normalizeTargets(rawDescription);
        if (!slot1 && code >= 386) {
            return true;
        }
        String target = axes.subGroup() == 1 ? switch (axes.kind()) {
            case 1 -> "도끼";
            case 2 -> "지팡이";
            case 3 -> "검";
            default -> "활";
        } : axes.subGroup() == 2 ? switch (axes.kind()) {
            case 1 -> "방패";
            case 2 -> "펜던트";
            case 3 -> "갑옷";
            default -> "부츠";
        } : "마법";
        if (!supportsTarget(description, target)) {
            return false;
        }
        if (axes.subGroup() != 3) {
            return true;
        }
        boolean waterEarth = axes.element() == 1 || axes.element() == 3;
        return waterEarth ? !description.contains("마법(불/바람)") : !description.contains("마법(물/흙)");
    }

    private String distinctSkillSql(String table) {
        String prefix = "auction".equals(table) ? "AUC" : "SHP";
        return "SELECT COUNT(DISTINCT code) FROM (SELECT s1.skill_code code FROM " + table
            + " l JOIN item_instance i ON i.id=l.item_instance_id JOIN skill_definition s1 ON s1.id=i.skill1_id "
            + "WHERE l.public_id LIKE 'OL1%" + prefix + "%' AND l.status='ACTIVE' UNION ALL SELECT s2.skill_code FROM "
            + table
            + " l JOIN item_instance i ON i.id=l.item_instance_id JOIN skill_definition s2 ON s2.id=i.skill2_id "
            + "WHERE l.public_id LIKE 'OL1%" + prefix + "%' AND l.status='ACTIVE') x";
    }

    private String distinctPercentSql(String table) {
        String prefix = "auction".equals(table) ? "AUC" : "SHP";
        return "SELECT COUNT(DISTINCT i.skill_percent) FROM " + table
            + " l JOIN item_instance i ON i.id=l.item_instance_id WHERE l.public_id LIKE 'OL1%" + prefix
            + "%' AND l.status='ACTIVE' AND i.skill_percent>0";
    }

    private String activeSnapshotMatchSql() {
        String expected = "CONCAT('Lv.',i.level,' / skill1=',COALESCE(s1.skill_code,'-'),'/skill2=',"
            + "COALESCE(s2.skill_code,'-'),' / ',i.skill_percent,'% / GF=',"
            + "COALESCE(DATE_FORMAT(i.gf_expire_at,'%Y-%m-%dT%H:%i:%sZ'),'-'))";
        return "SELECT COUNT(*) FROM item_instance i LEFT JOIN skill_definition s1 ON s1.id=i.skill1_id "
            + "LEFT JOIN skill_definition s2 ON s2.id=i.skill2_id LEFT JOIN auction a ON a.item_instance_id=i.id "
            + "AND a.status='ACTIVE' LEFT JOIN shop s ON s.item_instance_id=i.id AND s.status='ACTIVE' "
            + "WHERE i.public_id LIKE 'OL1ITM%' AND (a.id IS NOT NULL OR s.id IS NOT NULL) "
            + "AND COALESCE(a.item_spec_snapshot,s.item_spec_snapshot)=" + expected;
    }

    private String activeItemCountSql() {
        return "SELECT COUNT(*) FROM item_instance i JOIN (SELECT item_instance_id FROM auction WHERE "
            + "public_id LIKE 'OL1AUC%' AND status='ACTIVE' UNION ALL SELECT item_instance_id FROM shop WHERE "
            + "public_id LIKE 'OL1SHP%' AND status='ACTIVE') active ON active.item_instance_id=i.id WHERE ";
    }

    private List<SkillCandidate> candidates(String predicate, Object... values) throws SQLException {
        List<SkillCandidate> result = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement("SELECT id,skill_code,description "
            + "FROM skill_definition WHERE " + predicate + " ORDER BY skill_code")) {
            bind(statement, values);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    result.add(new SkillCandidate(rows.getLong(1), rows.getInt(2), rows.getString(3)));
                }
            }
        }
        return result;
    }

    private Long selectCandidate(List<SkillCandidate> candidates, String publicId, String purpose) {
        if (candidates.isEmpty()) {
            throw new IllegalStateException("적용 가능한 스킬 마스터 후보가 없습니다: " + publicId + "/" + purpose);
        }
        return candidates.get(hashModulo(publicId, purpose, candidates.size())).id();
    }

    private void requireSkillCandidates() throws SQLException {
        expectExact("스킬1 유효 코드", 98,
            "SELECT COUNT(*) FROM skill_definition WHERE skill_code BETWEEN 100 AND 197");
        expectExact("스킬2 유효 코드", 146, "SELECT COUNT(*) FROM skill_definition "
            + "WHERE skill_code BETWEEN 200 AND 209 OR skill_code BETWEEN 300 AND 435");
    }

    private TemplateAxes templateAxes(long templateId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT sub_group,element,kind FROM item_template WHERE id=?")) {
            statement.setLong(1, templateId);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) {
                    throw new IllegalStateException("아이템 템플릿이 없습니다: " + templateId);
                }
                return new TemplateAxes(row.getInt(1), row.getInt(2), row.getInt(3));
            }
        }
    }

    private List<RepairItem> repairItems(int channel) throws SQLException {
        String table = channel == 0 ? "auction" : "shop";
        String prefix = channel == 0 ? "OL1AUC%" : "OL1SHP%";
        List<RepairItem> result = new ArrayList<>();
        String sql = "SELECT i.id,i.public_id,i.template_id,i.level,t.sub_group FROM " + table
            + " l JOIN item_instance i ON i.id=l.item_instance_id JOIN item_template t ON t.id=i.template_id "
            + "WHERE l.public_id LIKE ? AND l.status='ACTIVE' ORDER BY i.public_id FOR UPDATE";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, prefix);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    result.add(new RepairItem(rows.getLong(1), rows.getString(2), rows.getLong(3), rows.getInt(4),
                        rows.getInt(5)));
                }
            }
        }
        quotas(result.size());
        return result;
    }

    private int activeCount(String table, String prefix) throws SQLException {
        return Math.toIntExact(count("SELECT COUNT(*) FROM " + table + " WHERE public_id LIKE ? AND status='ACTIVE'",
            prefix));
    }

    private Quotas quotas(int active) {
        if (active < 30) {
            throw new IllegalStateException("채널별 ACTIVE listing은 최소 30건이어야 합니다: " + active);
        }
        int quotient = active / 3;
        int remainder = active % 3;
        return new Quotas(quotient + (remainder >= 1 ? 1 : 0), quotient + (remainder >= 2 ? 1 : 0), quotient);
    }

    private int hashModulo(String publicId, String purpose, int divisor) {
        byte[] digest = digest(publicId, purpose);
        long value = 0;
        for (int i = 0; i < 8; i++) {
            value = (value << 8) | Byte.toUnsignedLong(digest[i]);
        }
        return (int)Long.remainderUnsigned(value, divisor);
    }

    private String hashHex(String publicId, String purpose) {
        return java.util.HexFormat.of().formatHex(digest(publicId, purpose));
    }

    private byte[] digest(String publicId, String purpose) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(
                (SCENARIO + ":skills:v2:" + publicId + ":" + purpose).getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
        }
    }

    private String gfCountSql(String table) {
        return "SELECT COUNT(*) FROM " + table + " l JOIN item_instance i ON i.id=l.item_instance_id WHERE "
            + "l.public_id LIKE 'OL1%" + ("auction".equals(table) ? "AUC" : "SHP")
            + "%' AND i.gf_expire_at>NOW(6)";
    }

    private int templateIndex(int channel, int index) {
        return channel == 0 ? index % 40 : (index + 20) % 40;
    }

    private int level(int index) {
        int[] counts = {11, 11, 11, 11, 11, 11, 11, 11, 12};
        int cursor = index;
        for (int level = 1; level <= counts.length; level++) {
            if (cursor < counts[level - 1]) {
                return level;
            }
            cursor -= counts[level - 1];
        }
        throw new IllegalArgumentException("잘못된 인덱스");
    }

    private int maxPercent(int level) {
        return new int[] {9, 15, 19, 23, 25, 27, 31, 33, 36}[level - 1];
    }

    private long price(int index, long maximum) {
        long[][] ranges = {{10_000, 99_999}, {100_000, 499_999}, {500_000, 999_999},
            {1_000_000, 2_999_999}, {3_000_000, maximum}};
        int bucket = index / 20;
        long min = ranges[bucket][0];
        return min + (ranges[bucket][1] - min) * (index % 20) / 19;
    }

    private long bidAmount(int auctionIndex) {
        return price(auctionIndex, 5_000_000L) + 2_000 + auctionIndex * 100L;
    }

    private Instant auctionEnd(int index) {
        if (index < 10) {
            return now.plus(5L + index, ChronoUnit.MINUTES);
        }
        if (index < 35) {
            return now.plus(16L + (index - 10L) * 14L, ChronoUnit.MINUTES);
        }
        if (index < 70) {
            return now.plus(7L + (index - 35L) % 18, ChronoUnit.HOURS);
        }
        return now.plus(25L + (index - 70L) * 5L, ChronoUnit.HOURS);
    }

    private ItemSnapshot snapshot(long itemId) throws SQLException {
        String sql = "SELECT t.display_name,CONCAT('Lv.',i.level,' / skill1=',COALESCE(s1.skill_code,'-'),"
            + "'/skill2=',COALESCE(s2.skill_code,'-'),' / ',i.skill_percent,'% / GF=',"
            + "COALESCE(DATE_FORMAT(i.gf_expire_at,'%Y-%m-%dT%H:%i:%sZ'),'-')) FROM item_instance i "
            + "JOIN item_template t ON t.id=i.template_id LEFT JOIN skill_definition s1 ON s1.id=i.skill1_id "
            + "LEFT JOIN skill_definition s2 ON s2.id=i.skill2_id WHERE i.id=?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, itemId);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return new ItemSnapshot(result.getString(1), result.getString(2));
            }
        }
    }

    private void expect(List<String> failures, String name, long expected, String sql) throws SQLException {
        long actual = count(sql);
        if (actual != expected) {
            failures.add(name + "=" + actual + "/" + expected);
        }
    }

    private void expectExact(String name, long expected, String sql) throws SQLException {
        long actual = count(sql);
        if (actual != expected) {
            throw new IllegalStateException(name + " 건수가 " + expected + "이 아닙니다: " + actual);
        }
    }

    private void expectMinimum(List<String> failures, String name, long minimum, String sql) throws SQLException {
        long actual = count(sql);
        if (actual < minimum) {
            failures.add(name + "=" + actual + "/minimum-" + minimum);
        }
    }

    private long count(String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, values);
            try (ResultSet result = statement.executeQuery()) {
                result.next();
                return result.getLong(1);
            }
        }
    }

    private void execute(String sql, Object... values) throws SQLException {
        update(sql, values);
    }

    private int update(String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, values);
            return statement.executeUpdate();
        }
    }

    private long[] ids(String sql) throws SQLException {
        List<Long> result = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql);
            ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                result.add(rows.getLong(1));
            }
        }
        return result.stream().mapToLong(Long::longValue).toArray();
    }

    private long lastId() throws SQLException {
        return count("SELECT LAST_INSERT_ID()");
    }

    private Instant databaseNow() throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT NOW(6)");
            ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getTimestamp(1).toInstant();
        }
    }

    private static void bind(PreparedStatement statement, Object... values) throws SQLException {
        for (int i = 0; i < values.length; i++) {
            statement.setObject(i + 1, values[i]);
        }
    }

    private static String key(String prefix, int number) {
        return prefix + String.format("%0" + (26 - prefix.length()) + "d", number);
    }

    private static Timestamp ts(Instant instant) {
        return Timestamp.from(instant);
    }

    enum State {
        EMPTY, COMPLETE, PARTIAL
    }

    private record ItemSnapshot(String name, String spec) {
    }

    private record SkillAssignment(Long skill1Id, Long skill2Id, int percent) {
    }

    private record SkillCandidate(long id, int code, String description) {
    }

    private record TemplateAxes(int subGroup, int element, int kind) {
    }

    private record RepairItem(long id, String publicId, long templateId, int level, int subGroup) {
    }

    private record Quotas(int none, int single, int doubleSkill) {
    }

    private record ExcludedState(long count, String checksum) {
    }
}
