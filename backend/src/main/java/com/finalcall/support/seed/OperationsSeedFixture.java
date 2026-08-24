package com.finalcall.support.seed;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/** ops-20-v1/v2 fixture를 시나리오별 단일 JDBC 트랜잭션으로 관리한다. */
final class OperationsSeedFixture {
    private final Connection connection;
    private final Instant now;
    private final boolean version2;
    private final String loginPattern;
    private long[] users;
    private long[] items;
    private long[] auctions;
    private long[] shops;
    private long[] bids;
    private long[] orders;
    private long[] rooms;
    private long[] messages;

    OperationsSeedFixture(Connection connection) throws SQLException {
        this(connection, "ops-20-v1");
    }

    OperationsSeedFixture(Connection connection, String scenario) throws SQLException {
        this.connection = connection;
        this.now = databaseNow();
        this.version2 = "ops-20-v2".equals(scenario);
        this.loginPattern = version2 ? "OP2USR%" : "fc\\_ops\\_%";
    }

    State state() throws SQLException {
        if (version2 && legacyRowCount() != 0) {
            throw new IllegalStateException("ops-20-v1 cleanup 선행 필요: v1 시드 행이 남아 있습니다.");
        }
        long userCount = count("SELECT COUNT(*) FROM user WHERE login_id LIKE ? ESCAPE '\\\\'", loginPattern);
        long itemCount = count("SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%'");
        long rows = count("SELECT (SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OPSAUC%')+"
            + "(SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OPSBID%')+"
            + "(SELECT COUNT(*) FROM chat_message WHERE public_id LIKE 'OPSMSG%')+"
            + "(SELECT COUNT(*) FROM chat_event_outbox WHERE event_id LIKE 'OPSEVT%')");
        if (userCount == 0 && itemCount == 0 && rows == 0) {
            return State.EMPTY;
        }
        if (userCount == 20 && itemCount == itemCount() && expectedCoreCounts()) {
            return State.COMPLETE;
        }
        return State.PARTIAL;
    }

    void requireEmpty(State state) {
        if (state != State.EMPTY) {
            throw new IllegalStateException("부분 시드 상태입니다. 원인을 조사해야 합니다.");
        }
    }

    void requireComplete(State state) throws SQLException {
        if (state != State.COMPLETE && !isLegacyOutboxOnly()) {
            throw new IllegalStateException("완전한 시드만 정리할 수 있습니다.");
        }
    }

    void dryRun() throws SQLException {
        requireMasters();
        State current = state();
        if (current == State.PARTIAL) {
            throw new IllegalStateException("부분 시드 상태입니다.");
        }
        if (current == State.COMPLETE) {
            detectExternalReferences();
            verify();
        }
        System.out.printf("예정 건수: users=20 items=%d auctions=%d bids=%d holds=%d shops=%d "
            + "orders=16 ledgers=16 deliveries=16 chatRooms=24 messages=420 memos=100%n",
            itemCount(), auctionCount(), bidCount(), bidCount(), shopCount());
    }

    void apply(String passwordHash) throws SQLException {
        if (version2 && legacyRowCount() != 0) {
            throw new IllegalStateException("ops-20-v1 cleanup 선행 필요: v1 시드 행이 남아 있습니다.");
        }
        requireMasters();
        insertUsers(passwordHash);
        insertItems();
        insertListings();
        insertBids();
        insertOrders();
        insertSocial();
        updateBalances();
    }

    void verify() throws SQLException {
        List<String> failures = new ArrayList<>();
        expect(failures, "users", 20, "SELECT COUNT(*) FROM user WHERE login_id LIKE ? ESCAPE '\\\\'", loginPattern);
        expect(failures, "items", itemCount(), "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%'");
        expect(failures, "auctions", auctionCount(), "SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OPSAUC%'");
        expect(failures, "bids", bidCount(), "SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OPSBID%'");
        expect(failures, "holds", bidCount(),
            "SELECT COUNT(*) FROM money_hold h JOIN bid b ON b.id=h.bid_id WHERE b.public_id LIKE 'OPSBID%'");
        expect(failures, "shops", shopCount(), "SELECT COUNT(*) FROM shop WHERE public_id LIKE 'OPSSHP%'");
        expect(failures, "orders", 16, "SELECT COUNT(*) FROM sale_order WHERE public_id LIKE 'OPSORD%'");
        expect(failures, "ledgers", 16,
            "SELECT COUNT(*) FROM platform_revenue_ledger l JOIN sale_order o ON o.id=l.sale_order_id WHERE o.public_id LIKE 'OPSORD%'");
        expect(failures, "deliveries", 16, "SELECT COUNT(*) FROM item_delivery WHERE public_id LIKE 'OPSDLV%'");
        expect(failures, "rooms", 24, "SELECT COUNT(*) FROM chat_room WHERE public_id LIKE 'OPSROM%'");
        expect(failures, "roomStates", 48,
            "SELECT COUNT(*) FROM chat_room_member_state s JOIN chat_room r ON r.id=s.room_id WHERE r.public_id LIKE 'OPSROM%'");
        expect(failures, "messages", 420, "SELECT COUNT(*) FROM chat_message WHERE public_id LIKE 'OPSMSG%'");
        expect(failures, "memos", 100, "SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%'");
        expect(failures, "temp", 10,
            "SELECT COUNT(*) FROM temp_storage t JOIN item_instance i ON i.id=t.instance_id WHERE i.public_id LIKE 'OPSITM%' AND i.location='TEMP' AND i.owner_id=t.owner_id");
        expect(failures, "seedHistory", itemCount(),
            "SELECT COUNT(*) FROM item_ownership_history h JOIN item_instance i ON i.id=h.instance_id WHERE i.public_id LIKE 'OPSITM%' AND h.transfer_type='SEED'");
        expect(failures, "tradeHistory", 16,
            "SELECT COUNT(*) FROM item_ownership_history h JOIN item_instance i ON i.id=h.instance_id WHERE i.public_id LIKE 'OPSITM%' AND h.transfer_type='TRADE'");
        expect(failures, "bidHoldMatch", bidCount(),
            "SELECT COUNT(*) FROM bid b JOIN money_hold h ON h.bid_id=b.id AND h.user_id=b.bidder_id AND h.amount=b.amount WHERE b.public_id LIKE 'OPSBID%' AND ((b.status='ACTIVE' AND h.status='HELD') OR (b.status='OUTBID' AND h.status='RELEASED') OR (b.status='WON' AND h.status='CAPTURED'))");
        expect(failures, "orderTail", 16,
            "SELECT COUNT(*) FROM sale_order o JOIN platform_revenue_ledger l ON l.sale_order_id=o.id AND l.amount=o.fee_amount JOIN item_delivery d ON d.sale_order_id=o.id AND d.item_instance_id=o.item_instance_id AND d.recipient_user_id=o.buyer_id WHERE o.public_id LIKE 'OPSORD%'");
        expect(failures, "heldSum", 20,
            "SELECT COUNT(*) FROM user u JOIN user_balance ub ON ub.user_id=u.id LEFT JOIN (SELECT user_id,SUM(amount) amount FROM money_hold WHERE status='HELD' GROUP BY user_id) h ON h.user_id=u.id WHERE u.login_id LIKE ? ESCAPE '\\\\' AND ub.game_money_held=COALESCE(h.amount,0)",
            loginPattern);
        expect(failures, "chatSequence", 24,
            "SELECT COUNT(*) FROM chat_room r JOIN (SELECT room_id,COUNT(*) c,MIN(room_sequence) mn,MAX(room_sequence) mx FROM chat_message WHERE public_id LIKE 'OPSMSG%' GROUP BY room_id) m ON m.room_id=r.id WHERE r.public_id LIKE 'OPSROM%' AND m.mn=1 AND m.mx=m.c AND r.last_sequence=m.mx");
        verifyTradeAccounting(failures);
        verifyListingAndDelivery(failures);
        verifySocial(failures);
        verifyDistributions(failures);
        if (!failures.isEmpty()) {
            throw new IllegalStateException("시드 불변식 위반: " + String.join(", ", failures));
        }
    }

    void cleanup() throws SQLException {
        if (isLegacyOutboxOnly()) {
            execute("DELETE FROM chat_event_outbox WHERE event_id LIKE 'OPSEVT%'");
            if (state() != State.EMPTY) {
                throw new IllegalStateException("v1 고아 outbox 정리 후 EMPTY 상태가 아닙니다.");
            }
            return;
        }
        detectExternalReferences();
        validateDerivedClosingOrderChildren();
        int derivedOrderCount = removeDerivedClosingOrders();
        if (derivedOrderCount == 0) {
            verify();
        }
        execute(
            "DELETE q FROM chat_report_daily_quota q JOIN user u ON u.id=q.reporter_id WHERE u.login_id LIKE ? ESCAPE '\\\\'",
            loginPattern);
        execute("DELETE FROM chat_event_outbox WHERE event_id LIKE 'OPSEVT%'");
        execute("DELETE FROM chat_report WHERE public_id LIKE 'OPSRPT%'");
        execute(
            "DELETE b FROM chat_user_block b JOIN user u ON u.id=b.blocker_id WHERE u.login_id LIKE ? ESCAPE '\\\\'",
            loginPattern);
        execute("DELETE FROM chat_message WHERE public_id LIKE 'OPSMSG%'");
        execute(
            "DELETE s FROM chat_room_member_state s JOIN chat_room r ON r.id=s.room_id WHERE r.public_id LIKE 'OPSROM%'");
        execute("DELETE FROM chat_room WHERE public_id LIKE 'OPSROM%'");
        execute("DELETE FROM user_memo WHERE public_id LIKE 'OPSMEM%'");
        execute("DELETE FROM item_delivery WHERE public_id LIKE 'OPSDLV%'");
        execute(
            "DELETE l FROM platform_revenue_ledger l JOIN sale_order o ON o.id=l.sale_order_id WHERE o.public_id LIKE 'OPSORD%'");
        execute(
            "DELETE h FROM item_ownership_history h JOIN sale_order o ON o.id=h.sale_order_id WHERE o.public_id LIKE 'OPSORD%'");
        execute("DELETE FROM sale_order WHERE public_id LIKE 'OPSORD%'");
        execute("DELETE h FROM money_hold h JOIN bid b ON b.id=h.bid_id WHERE b.public_id LIKE 'OPSBID%'");
        execute("DELETE FROM bid WHERE public_id LIKE 'OPSBID%'");
        execute("DELETE FROM auction WHERE public_id LIKE 'OPSAUC%'");
        execute("DELETE FROM shop WHERE public_id LIKE 'OPSSHP%'");
        execute(
            "DELETE t FROM temp_storage t JOIN item_instance i ON i.id=t.instance_id WHERE i.public_id LIKE 'OPSITM%'");
        execute(
            "DELETE h FROM item_ownership_history h JOIN item_instance i ON i.id=h.instance_id WHERE i.public_id LIKE 'OPSITM%'");
        execute("DELETE FROM item_instance WHERE public_id LIKE 'OPSITM%'");
        execute("DELETE m FROM money_exchange m JOIN user u ON u.id=m.user_id WHERE u.login_id LIKE ? ESCAPE '\\\\'",
            loginPattern);
        execute("DELETE b FROM user_balance b JOIN user u ON u.id=b.user_id WHERE u.login_id LIKE ? ESCAPE '\\\\'",
            loginPattern);
        execute("DELETE FROM user WHERE login_id LIKE ? ESCAPE '\\\\'", loginPattern);
        if (state() != State.EMPTY) {
            throw new IllegalStateException("정리 후 EMPTY 상태가 아닙니다.");
        }
    }

    private void insertUsers(String hash) throws SQLException {
        users = new long[21];
        for (int i = 1; i <= 20; i++) {
            long cash = i == 1 ? 300_000 : i >= 19 ? 0 : i * 10_000L;
            execute(
                "INSERT INTO user(public_id,login_id,password_hash,nickname,primary_character_id,email,email_verified,is_admin,is_deleted,deleted_at,created_at,updated_at) VALUES(?,?,?,?,?,?,1,0,0,NULL,?,?)",
                key("OPSUSR", i), loginId(i), hash, String.format("운영검증%02d", i), character(i),
                loginId(i) + "@example.invalid", ts(now.minus(60L - i, ChronoUnit.DAYS)), ts(now));
            users[i] = lastId();
            execute(
                "INSERT INTO user_balance(user_id,cash_balance,game_money_balance,game_money_held,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                users[i], cash, 80_000L + i * 1_496_000L, 0, ts(now), ts(now));
            if (i <= 8) {
                execute(
                    "INSERT INTO money_exchange(user_id,cash_amount,game_money_amount,applied_rate,idempotency_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                    users[i], i * 10_000L, i * 100_000L, 10.000000, scenarioKey() + "-exchange-" + i, ts(now), ts(now));
            }
        }
    }

    private void insertItems() throws SQLException {
        items = new long[itemCount() + 1];
        List<Long> templates = ids("SELECT id FROM item_template ORDER BY type_code");
        List<Long> skills = ids("SELECT id FROM skill_definition ORDER BY id LIMIT 18");
        int[] slots = new int[21];
        int skilledNumber = 0;
        for (int i = 1; i <= itemCount(); i++) {
            int seller = 1 + i % 20;
            int owner = buyer(i, seller);
            String location = location(i);
            Integer slot = "INVENTORY".equals(location) ? slots[owner]++ : null;
            int skillGroup = skillGroup(i);
            Long skill1 = skillGroup == 0 ? null : skills.get(i % 18);
            Long skill2 = skillGroup < 2 ? null : skills.get((i + 7) % 18);
            int skillPercent = skillGroup == 0 ? (version2 ? 0 : percent(i))
                : version2 ? skilledPercent(++skilledNumber) : percent(i);
            int gfGroup = gfGroup(i);
            Timestamp gf = gfGroup == 0 ? null
                : gfGroup == 1 ? ts(now.plus(i, ChronoUnit.DAYS)) : ts(now.minus(1L + i % 90, ChronoUnit.DAYS));
            int templateIndex = version2 && i >= 57 && i <= 96 ? i - 57 : (i - 1) % templates.size();
            execute(
                "INSERT INTO item_instance(public_id,template_id,owner_id,level,skill1_id,skill2_id,skill_percent,gf_expire_at,location,slot_no,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                key("OPSITM", i), templates.get(templateIndex), users[owner], level(i), skill1, skill2, skillPercent,
                gf,
                location, slot, ts(now.minus(40, ChronoUnit.DAYS)), ts(now));
            items[i] = lastId();
            execute(
                "INSERT INTO item_ownership_history(instance_id,from_owner_id,to_owner_id,transfer_type,sale_order_id,transferred_at,created_at) VALUES(?,NULL,?,'SEED',NULL,?,?)",
                items[i], users[seller], ts(now.minus(40, ChronoUnit.DAYS)), ts(now.minus(40, ChronoUnit.DAYS)));
            if ("TEMP".equals(location)) {
                execute(
                    "INSERT INTO temp_storage(instance_id,owner_id,stored_at,expire_at,created_at) VALUES(?,?,?,NULL,?)",
                    items[i], users[owner], ts(now.minus(i, ChronoUnit.HOURS)), ts(now.minus(i, ChronoUnit.HOURS)));
            }
        }
    }

    private void insertListings() throws SQLException {
        auctions = new long[auctionCount() + 1];
        for (int i = 1; i <= auctionCount(); i++) {
            String status = auctionStatus(i);
            int soldStart = version2 ? 37 : 21;
            String result = i >= soldStart && i <= soldStart + 6 ? "BID"
                : i >= soldStart + 7 && i <= soldStart + 9 ? "BUYNOW" : null;
            Instant start = i <= 4 ? now.plus(i, ChronoUnit.DAYS) : now.minus(2, ChronoUnit.DAYS);
            Instant end = auctionEnd(i, status);
            execute(
                "INSERT INTO auction(public_id,seller_id,item_instance_id,start_price,buy_now_price,status,result_type,highest_bid_amount,highest_bidder_id,start_at,end_at,base_end_at,max_end_at,soft_close_window_sec,soft_close_extend_sec,extension_count,item_name_snapshot,item_spec_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                key("OPSAUC", i), users[1 + i % 20], items[i], 10_000L + i * 1_000L,
                i % 2 == 0 || "BUYNOW".equals(result) ? 100_000L + i * 2_000L : null,
                status, result, null, null, ts(start), ts(end), ts(end), ts(end.plus(30, ChronoUnit.MINUTES)), 300, 300,
                0,
                "운영 경매 아이템 " + i, "레벨 " + level(i) + " · 스킬 " + percent(i) + "%", ts(now.minus(2, ChronoUnit.DAYS)),
                ts(now));
            auctions[i] = lastId();
        }
        shops = new long[shopCount() + 1];
        for (int i = 1; i <= shopCount(); i++) {
            int itemNo = (version2 ? 56 : 36) + i;
            String status = shopStatus(i);
            execute(
                "INSERT INTO shop(public_id,seller_id,item_instance_id,price,status,end_at,item_name_snapshot,item_spec_snapshot,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                key("OPSSHP", i), users[1 + itemNo % 20], items[itemNo], shopPrice(i), status,
                ts("ACTIVE".equals(status) ? now.plus(7, ChronoUnit.DAYS) : now.minus(1, ChronoUnit.DAYS)),
                "운영 마켓 아이템 " + i, "다양한 스킬과 골드포스", ts(now.minus(3, ChronoUnit.DAYS)), ts(now));
            shops[i] = lastId();
        }
    }

    private void insertBids() throws SQLException {
        bids = new long[bidCount() + 1];
        int no = 0;
        int targetCount = version2 ? 39 : 23;
        int activeEnd = version2 ? 36 : 20;
        for (int target = 0; target < targetCount; target++) {
            int auctionNo = target + 5;
            int size = target < 5 ? 6 : 5;
            long highest = 0;
            int highestUser = 0;
            for (int sequence = 1; sequence <= size; sequence++) {
                no++;
                int seller = 1 + auctionNo % 20;
                int bidder = 1 + (seller + sequence + target) % 20;
                if (bidder == seller) {
                    bidder = 1 + bidder % 20;
                }
                long amount = 10_000L + auctionNo * 1_000L + sequence * 2_000L;
                boolean last = sequence == size;
                String bidStatus = last ? (auctionNo <= activeEnd ? "ACTIVE" : "WON") : "OUTBID";
                String holdStatus = last ? (auctionNo <= activeEnd ? "HELD" : "CAPTURED") : "RELEASED";
                Instant created = now.minus(2L * (size - sequence + 1), ChronoUnit.HOURS);
                execute(
                    "INSERT INTO bid(public_id,auction_id,bidder_id,amount,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                    key("OPSBID", no), auctions[auctionNo], users[bidder], amount, bidStatus, ts(created), ts(created));
                bids[no] = lastId();
                execute(
                    "INSERT INTO money_hold(user_id,bid_id,amount,status,released_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                    users[bidder], bids[no], amount, holdStatus,
                    "RELEASED".equals(holdStatus) ? ts(created.plus(1, ChronoUnit.HOURS)) : null,
                    ts(created), ts("RELEASED".equals(holdStatus) ? created.plus(1, ChronoUnit.HOURS) : created));
                highest = amount;
                highestUser = bidder;
            }
            execute("UPDATE auction SET highest_bid_amount=?,highest_bidder_id=? WHERE id=?", highest,
                users[highestUser], auctions[auctionNo]);
            if (auctionNo > activeEnd) {
                execute("UPDATE item_instance SET owner_id=? WHERE id=?", users[highestUser], items[auctionNo]);
            }
        }
    }

    private void insertOrders() throws SQLException {
        orders = new long[17];
        for (int i = 1; i <= 16; i++) {
            boolean auction = i <= 10;
            int itemNo = auction ? (version2 ? 36 : 20) + i : (version2 ? 96 : 46) + i;
            int sourceNo = auction ? (version2 ? 36 : 20) + i : (version2 ? 40 : 10) + i;
            OrderSource source = auction ? auctionOrderSource(sourceNo) : shopOrderSource(sourceNo);
            long fee = fee(source.price());
            execute(
                "INSERT INTO sale_order(public_id,source_type,source_id,buyer_id,seller_id,item_instance_id,final_price,fee_amount,settle_amount,fee_policy_version,status,settled_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'SETTLED',?,?)",
                key("OPSORD", i), auction ? "AUCTION" : "SHOP", auction ? auctions[sourceNo] : shops[sourceNo],
                source.buyerId(), source.sellerId(), items[itemNo], source.price(), fee, source.price() - fee,
                "v1.0", ts(now.minus(1, ChronoUnit.DAYS)), ts(now.minus(1, ChronoUnit.DAYS)));
            orders[i] = lastId();
            execute(
                "INSERT INTO platform_revenue_ledger(sale_order_id,amount,fee_policy_version,created_at) VALUES(?,?,?,?)",
                orders[i], fee, "v1.0", ts(now));
            execute(
                "INSERT INTO item_ownership_history(instance_id,from_owner_id,to_owner_id,transfer_type,sale_order_id,transferred_at,created_at) VALUES(?,?,?,?,?,?,?)",
                items[itemNo], source.sellerId(), source.buyerId(), "TRADE", orders[i], ts(now), ts(now));
            String status = deliveryStatus(i);
            execute(
                "INSERT INTO item_delivery(public_id,sale_order_id,item_instance_id,recipient_user_id,recipient_nickname,item_uuid,type_code,level,skill1_code,skill2_code,skill_percent,gf_expire_at,status,claim_token,claimed_at,applied_at,created_at) SELECT ?,?,?,?,?,?,t.type_code,x.level,s1.skill_code,s2.skill_code,x.skill_percent,x.gf_expire_at,?,?,?,?,? FROM item_instance x JOIN item_template t ON t.id=x.template_id LEFT JOIN skill_definition s1 ON s1.id=x.skill1_id LEFT JOIN skill_definition s2 ON s2.id=x.skill2_id WHERE x.id=?",
                key("OPSDLV", i), orders[i], items[itemNo], source.buyerId(), source.buyerNickname(),
                String.format(scenarioKey() + "-item-%022d", itemNo),
                status, "CLAIMED".equals(status) ? scenarioKey() + "-claim-token-000000000000001" : null,
                "CLAIMED".equals(status) ? ts(now.minus(2, ChronoUnit.HOURS)) : null,
                "APPLIED".equals(status) ? ts(now.minus(1, ChronoUnit.HOURS)) : null, ts(now), items[itemNo]);
        }
    }

    private OrderSource auctionOrderSource(int sourceNo) throws SQLException {
        int bidEnd = version2 ? 43 : 27;
        String priceColumn = sourceNo <= bidEnd ? "b.amount" : "a.buy_now_price";
        String join = sourceNo <= bidEnd
            ? " JOIN bid b ON b.auction_id=a.id AND b.status='WON'"
            : " JOIN item_instance i ON i.id=a.item_instance_id JOIN user buyer ON buyer.id=i.owner_id";
        String buyerColumn = sourceNo <= bidEnd ? "b.bidder_id" : "buyer.id";
        String nicknameColumn = sourceNo <= bidEnd
            ? "(SELECT nickname FROM user WHERE id=b.bidder_id)"
            : "buyer.nickname";
        return orderSource("SELECT a.seller_id," + buyerColumn + "," + priceColumn + "," + nicknameColumn
            + " FROM auction a" + join + " WHERE a.id=?", auctions[sourceNo]);
    }

    private OrderSource shopOrderSource(int sourceNo) throws SQLException {
        return orderSource("SELECT s.seller_id,i.owner_id,s.price,u.nickname FROM shop s "
            + "JOIN item_instance i ON i.id=s.item_instance_id JOIN user u ON u.id=i.owner_id WHERE s.id=?",
            shops[sourceNo]);
    }

    private OrderSource orderSource(String sql, long sourceId) throws SQLException {
        try (PreparedStatement statement = prepare(sql, sourceId); ResultSet result = statement.executeQuery()) {
            if (!result.next()) {
                throw new IllegalStateException("주문 원본 listing을 찾을 수 없습니다.");
            }
            return new OrderSource(result.getLong(1), result.getLong(2), result.getLong(3), result.getString(4));
        }
    }

    private void insertSocial() throws SQLException {
        rooms = new long[25];
        messages = new long[421];
        int messageNo = 0;
        for (int roomNo = 1; roomNo <= 24; roomNo++) {
            int low = 1 + (roomNo - 1) % 12;
            int high = 13 + roomNo * 5 % 8;
            int size = roomNo <= 12 ? 18 : roomNo <= 23 ? 17 : 17;
            Instant last = now.minus(24L - roomNo, ChronoUnit.HOURS);
            execute(
                "INSERT INTO chat_room(public_id,member_low_id,member_high_id,last_sequence,last_activity_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                key("OPSROM", roomNo), users[low], users[high], size, ts(last), ts(now.minus(20, ChronoUnit.DAYS)),
                ts(last));
            rooms[roomNo] = lastId();
            long read = size - (roomNo <= 12 ? 4 : 0);
            execute(
                "INSERT INTO chat_room_member_state(room_id,user_id,last_read_sequence,last_read_at,archived_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                rooms[roomNo], users[low], read, ts(last), roomNo <= 3 ? ts(now) : null, ts(now), ts(last));
            execute(
                "INSERT INTO chat_room_member_state(room_id,user_id,last_read_sequence,last_read_at,archived_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                rooms[roomNo], users[high], read, ts(last), roomNo >= 22 ? ts(now) : null, ts(now), ts(last));
            for (int sequence = 1; sequence <= size; sequence++) {
                messageNo++;
                int sender = sequence % 2 == 1 ? low : high;
                execute(
                    "INSERT INTO chat_message(public_id,room_id,room_sequence,sender_id,sender_nickname_snapshot,client_message_id,body,created_at) VALUES(?,?,?,?,?,?,?,?)",
                    key("OPSMSG", messageNo), rooms[roomNo], sequence, users[sender], String.format("운영검증%02d", sender),
                    uuid(messageNo), chatBody(sequence),
                    ts(last.minus(size - sequence, ChronoUnit.MINUTES)));
                messages[messageNo] = lastId();
            }
            for (int e = 1; e <= 2; e++) {
                execute(
                    "INSERT INTO chat_event_outbox(event_id,aggregate_type,aggregate_id,event_type,event_version,payload,occurred_at,created_at) VALUES(?,'CHAT_ROOM',?,'MESSAGE_CREATED',1,JSON_OBJECT('roomPublicId',?,'sequence',?),?,?)",
                    key("OPSEVT", roomNo * 2 - 2 + e), key("OPSROM", roomNo), key("OPSROM", roomNo), size - 2 + e,
                    ts(last), ts(last));
            }
        }
        if (messageNo != 420) {
            throw new IllegalStateException("메시지 생성 수 오류: " + messageNo);
        }
        for (int i = 1; i <= 3; i++) {
            execute("INSERT INTO chat_user_block(blocker_id,blocked_id,created_at) VALUES(?,?,?)", users[i],
                users[i + 10], ts(now));
        }
        for (int i = 1; i <= 4; i++) {
            int reported = 13 + i * 5 % 8;
            execute(
                "INSERT INTO chat_report(public_id,room_id,message_id,message_public_id,reporter_id,reported_user_id,reason,detail,message_body_snapshot,sender_nickname_snapshot,status,resolved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                key("OPSRPT", i), rooms[i], messages[(i - 1) * 18 + 2], key("OPSMSG", (i - 1) * 18 + 2), users[i],
                users[reported], "ABUSE", "운영 검증 신고",
                chatBody(2), String.format("운영검증%02d", reported), i <= 2 ? "PENDING" : "RESOLVED",
                i <= 2 ? null : ts(now), ts(now), ts(now));
            execute(
                "INSERT INTO chat_report_daily_quota(reporter_id,quota_date,report_count,created_at,updated_at) VALUES(?,CURRENT_DATE,1,?,?)",
                users[i], ts(now), ts(now));
        }
        for (int i = 1; i <= 100; i++) {
            boolean system = i > 84;
            int sender = 1 + i % 20;
            int receiver = 1 + (i + 7) % 20;
            boolean read = i <= 68;
            boolean deleted = i <= 8;
            execute(
                "INSERT INTO user_memo(public_id,sender_id,sender_nickname,sender_level,sender_gender,receiver_id,receiver_nickname,memo_type,body,is_read,read_at,is_deleted,deleted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                key("OPSMEM", i), system ? null : users[sender], system ? "시스템" : String.format("운영검증%02d", sender),
                system ? null : level(i), system ? null : i % 2,
                users[receiver], String.format("운영검증%02d", receiver), system ? (i <= 92 ? 0 : 14) : 5,
                system ? "거래 및 배송 상태 변경 알림 " + i : "아이템 거래 관련 쪽지 " + i, read, read ? ts(now) : null,
                deleted, deleted ? ts(now) : null, ts(now.minus(100L - i, ChronoUnit.HOURS)));
        }
    }

    private void updateBalances() throws SQLException {
        execute(
            "UPDATE user_balance ub JOIN user u ON u.id=ub.user_id LEFT JOIN (SELECT user_id,SUM(amount) amount FROM money_hold WHERE status='HELD' GROUP BY user_id) h ON h.user_id=u.id SET ub.game_money_held=COALESCE(h.amount,0),ub.updated_at=? WHERE u.login_id LIKE ? ESCAPE '\\\\'",
            ts(now), loginPattern);
        execute(
            "UPDATE user_balance ub JOIN (SELECT buyer_id,SUM(final_price) amount FROM sale_order WHERE public_id LIKE 'OPSORD%' GROUP BY buyer_id) x ON x.buyer_id=ub.user_id SET ub.game_money_balance=ub.game_money_balance-x.amount");
        execute(
            "UPDATE user_balance ub JOIN (SELECT seller_id,SUM(settle_amount) amount FROM sale_order WHERE public_id LIKE 'OPSORD%' GROUP BY seller_id) x ON x.seller_id=ub.user_id SET ub.game_money_balance=ub.game_money_balance+x.amount");
    }

    private void verifyTradeAccounting(List<String> failures) throws SQLException {
        verifyFeeFormula(failures);
        expect(failures, "auctionHighest", 0,
            "SELECT COUNT(*) FROM auction a LEFT JOIN bid b ON b.auction_id=a.id AND b.status IN ('ACTIVE','WON') "
                + "WHERE a.public_id LIKE 'OPSAUC%' AND a.status IN ('ACTIVE','SOLD') "
                + "AND COALESCE(a.result_type,'')<>'BUYNOW' "
                + "AND (a.highest_bid_amount<>b.amount OR a.highest_bidder_id<>b.bidder_id)");
        expect(failures, "orderSource", 0,
            "SELECT COUNT(*) FROM sale_order o LEFT JOIN auction a ON o.source_type='AUCTION' AND a.id=o.source_id "
                + "LEFT JOIN bid b ON a.id=b.auction_id AND b.status='WON' LEFT JOIN shop s ON o.source_type='SHOP' "
                + "AND s.id=o.source_id WHERE o.public_id LIKE 'OPSORD%' AND (o.seller_id<>COALESCE(a.seller_id,s.seller_id) "
                + "OR o.item_instance_id<>COALESCE(a.item_instance_id,s.item_instance_id) OR o.final_price<>CASE "
                + "WHEN o.source_type='SHOP' THEN s.price WHEN a.result_type='BID' THEN b.amount ELSE a.buy_now_price END "
                + "OR o.buyer_id<>CASE WHEN a.result_type='BID' THEN b.bidder_id ELSE "
                + "(SELECT owner_id FROM item_instance WHERE id=o.item_instance_id) END)");
        expect(failures, "orderOwnerHistory", 0,
            "SELECT COUNT(*) FROM sale_order o JOIN item_instance i ON i.id=o.item_instance_id "
                + "LEFT JOIN item_ownership_history h ON h.sale_order_id=o.id AND h.instance_id=o.item_instance_id "
                + "AND h.from_owner_id=o.seller_id AND h.to_owner_id=o.buyer_id AND h.transfer_type='TRADE' "
                + "WHERE o.public_id LIKE 'OPSORD%' AND (i.owner_id<>o.buyer_id OR h.id IS NULL)");
        expect(failures, "feeAndLedger", 0,
            "SELECT COUNT(*) FROM sale_order o LEFT JOIN platform_revenue_ledger l ON l.sale_order_id=o.id "
                + "WHERE o.public_id LIKE 'OPSORD%' AND (o.settle_amount<>o.final_price-o.fee_amount "
                + "OR l.amount<>o.fee_amount OR l.fee_policy_version<>o.fee_policy_version)");
        expect(failures, "accountingEquation", 0,
            "SELECT ABS((SELECT SUM(final_price) FROM sale_order WHERE public_id LIKE 'OPSORD%')-"
                + "(SELECT SUM(settle_amount+fee_amount) FROM sale_order WHERE public_id LIKE 'OPSORD%'))");
        expect(failures, "balance", 0,
            "SELECT COUNT(*) FROM user u JOIN user_balance ub ON ub.user_id=u.id LEFT JOIN "
                + "(SELECT buyer_id,SUM(final_price) amount FROM sale_order WHERE public_id LIKE 'OPSORD%' GROUP BY buyer_id) buy "
                + "ON buy.buyer_id=u.id LEFT JOIN (SELECT seller_id,SUM(settle_amount) amount FROM sale_order "
                + "WHERE public_id LIKE 'OPSORD%' GROUP BY seller_id) sell ON sell.seller_id=u.id "
                + "WHERE u.login_id LIKE ? ESCAPE '\\\\' AND ub.game_money_balance<>(80000+"
                + "CAST(RIGHT(u.login_id,2) AS UNSIGNED)*1496000-COALESCE(buy.amount,0)+COALESCE(sell.amount,0))",
            loginPattern);
    }

    private void verifyFeeFormula(List<String> failures) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(scope(
            "SELECT final_price,fee_amount FROM sale_order WHERE public_id LIKE 'OPSORD%'"));
            ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                long price = rows.getLong(1);
                long actual = rows.getLong(2);
                if (actual != fee(price)) {
                    failures.add("feeFormula=" + actual + "/" + fee(price));
                }
            }
        }
    }

    private void verifyListingAndDelivery(List<String> failures) throws SQLException {
        expect(failures, "itemLocationXor", 0,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND ((location='INVENTORY' AND "
                + "(slot_no IS NULL OR slot_no NOT BETWEEN 0 AND 95)) OR (location<>'INVENTORY' AND slot_no IS NOT NULL))");
        expect(failures, "duplicateSlot", 0,
            "SELECT COUNT(*) FROM (SELECT owner_id,slot_no FROM item_instance WHERE public_id LIKE 'OPSITM%' "
                + "AND location='INVENTORY' GROUP BY owner_id,slot_no HAVING COUNT(*)>1) x");
        expect(failures, "tempContract", 0,
            "SELECT COUNT(*) FROM item_instance i LEFT JOIN temp_storage t ON t.instance_id=i.id "
                + "WHERE i.public_id LIKE 'OPSITM%' AND ((i.location='TEMP' AND (t.id IS NULL OR t.owner_id<>i.owner_id)) "
                + "OR (i.location<>'TEMP' AND t.id IS NOT NULL))");
        expect(failures, "listingLocation", 0,
            "SELECT COUNT(*) FROM item_instance i LEFT JOIN auction a ON a.item_instance_id=i.id "
                + "LEFT JOIN shop s ON s.item_instance_id=i.id WHERE i.public_id LIKE 'OPSITM%' AND "
                + "((COALESCE(a.status,s.status) IN ('SCHEDULED','ACTIVE') AND i.location<>'LISTED') OR "
                + "(COALESCE(a.status,s.status) IN ('UNSOLD','CANCELLED','EXPIRED') "
                + "AND i.location NOT IN ('INVENTORY','TEMP')))");
        expect(failures, "deliveryContract", 0,
            "SELECT COUNT(*) FROM item_delivery d JOIN sale_order o ON o.id=d.sale_order_id "
                + "JOIN item_instance i ON i.id=d.item_instance_id WHERE d.public_id LIKE 'OPSDLV%' AND "
                + "(d.recipient_user_id<>o.buyer_id OR d.item_instance_id<>o.item_instance_id OR "
                + "(d.status='CLAIMED')<>(d.claim_token IS NOT NULL AND d.claimed_at IS NOT NULL) OR "
                + "(d.status<>'CLAIMED' AND (d.claim_token IS NOT NULL OR d.claimed_at IS NOT NULL)) OR "
                + "(d.status='APPLIED')<>(d.applied_at IS NOT NULL) OR (d.status='APPLIED' AND i.location<>'IN_GAME') OR "
                + "(d.status<>'APPLIED' AND i.location NOT IN ('INVENTORY','TEMP')))");
    }

    private void verifySocial(List<String> failures) throws SQLException {
        expect(failures, "roomMembers", 0,
            "SELECT COUNT(*) FROM chat_room r WHERE r.public_id LIKE 'OPSROM%' AND (r.member_low_id>=r.member_high_id OR "
                + "(SELECT COUNT(*) FROM chat_room_member_state s WHERE s.room_id=r.id)<>2)");
        expect(failures, "readState", 0,
            "SELECT COUNT(*) FROM chat_room_member_state s JOIN chat_room r ON r.id=s.room_id "
                + "WHERE r.public_id LIKE 'OPSROM%' AND s.last_read_sequence NOT BETWEEN 0 AND r.last_sequence");
        expect(failures, "blocks", 3,
            "SELECT COUNT(*) FROM chat_user_block b JOIN user u ON u.id=b.blocker_id "
                + "WHERE u.login_id LIKE ? ESCAPE '\\\\'",
            loginPattern);
        expect(failures, "reports", 4, "SELECT COUNT(*) FROM chat_report WHERE public_id LIKE 'OPSRPT%'");
        expect(failures, "reportStatus", 0,
            "SELECT COUNT(*) FROM chat_report WHERE public_id LIKE 'OPSRPT%' AND "
                + "((status='PENDING' AND resolved_at IS NOT NULL) OR (status='RESOLVED' AND resolved_at IS NULL))");
        expect(failures, "quota", 4,
            "SELECT COUNT(*) FROM chat_report_daily_quota q JOIN user u ON u.id=q.reporter_id "
                + "WHERE u.login_id LIKE ? ESCAPE '\\\\' AND q.quota_date=CURRENT_DATE AND q.report_count=1",
            loginPattern);
        expect(failures, "outbox", 48, "SELECT COUNT(*) FROM chat_event_outbox WHERE event_id LIKE 'OPSEVT%'");
        expect(failures, "memoContract", 0,
            "SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%' AND "
                + "((is_read=1)<>(read_at IS NOT NULL) OR (is_deleted=1)<>(deleted_at IS NOT NULL) OR "
                + "(memo_type=5 AND sender_id IS NULL) OR (memo_type IN (0,14) AND sender_id IS NOT NULL))");
        expect(failures, "memoUser", 84,
            "SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%' AND memo_type=5");
        expect(failures, "memoSystem0", 8,
            "SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%' AND memo_type=0");
        expect(failures, "memoSystem14", 8,
            "SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%' AND memo_type=14");
        expect(failures, "memoRead", 68,
            "SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%' AND is_read=1");
        expect(failures, "memoDeleted", 8,
            "SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%' AND is_deleted=1");
    }

    private void verifyDistributions(List<String> failures) throws SQLException {
        dist(failures, "item_instance", "public_id LIKE 'OPSITM%'", "location",
            new String[] {"INVENTORY", "TEMP", "LISTED", "IN_GAME"},
            version2 ? new int[] {148, 10, 76, 6} : new int[] {104, 10, 40, 6});
        expect(failures, "noSkill", version2 ? 48 : 12,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND skill1_id IS NULL AND skill2_id IS NULL");
        expect(failures, "oneSkill", version2 ? 72 : 48,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND skill1_id IS NOT NULL AND skill2_id IS NULL");
        expect(failures, "twoSkill", version2 ? 120 : 100,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND skill1_id IS NOT NULL AND skill2_id IS NOT NULL");
        expect(failures, "gfNone", version2 ? 96 : 80,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND gf_expire_at IS NULL");
        expect(failures, "gfActive", version2 ? 96 : 56,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND gf_expire_at>?", ts(now));
        expect(failures, "gfExpired", version2 ? 48 : 24,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND gf_expire_at<=?", ts(now));
        expect(failures, "level1to3", version2 ? 48 : 30,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND level BETWEEN 1 AND 3");
        expect(failures, "level4to6", version2 ? 72 : 48,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND level BETWEEN 4 AND 6");
        expect(failures, "level7to9", version2 ? 72 : 50,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND level BETWEEN 7 AND 9");
        expect(failures, "level10plus", version2 ? 48 : 32,
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND level>=10");
        int[] percentCounts = version2 ? new int[] {40, 56, 56, 32, 8} : new int[] {32, 48, 48, 24, 8};
        int[] percentMin = {5, 16, 31, 51, 81};
        int[] percentMax = {15, 30, 50, 80, 99};
        for (int i = 0; i < percentCounts.length; i++) {
            expect(failures, "skillPercent" + i, percentCounts[i],
                "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%' AND skill_percent BETWEEN ? AND ?",
                percentMin[i], percentMax[i]);
        }
        dist(failures, "auction", "public_id LIKE 'OPSAUC%'", "status",
            new String[] {"SCHEDULED", "ACTIVE", "SOLD", "UNSOLD", "CANCELLED"},
            version2 ? new int[] {4, 32, 10, 5, 5} : new int[] {4, 16, 10, 3, 3});
        dist(failures, "bid", "public_id LIKE 'OPSBID%'", "status", new String[] {"ACTIVE", "OUTBID", "WON"},
            version2 ? new int[] {32, 161, 7} : new int[] {16, 97, 7});
        dist(failures, "shop", "public_id LIKE 'OPSSHP%'", "status",
            new String[] {"ACTIVE", "SOLD", "EXPIRED", "CANCELLED"},
            version2 ? new int[] {40, 6, 5, 5} : new int[] {20, 6, 3, 3});
        dist(failures, "item_delivery", "public_id LIKE 'OPSDLV%'", "status",
            new String[] {"PENDING", "DEFERRED", "CLAIMED", "APPLIED", "FAILED"}, new int[] {5, 2, 1, 6, 2});
        expect(failures, "unread", 96,
            "SELECT SUM(r.last_sequence-s.last_read_sequence) FROM chat_room_member_state s JOIN chat_room r ON r.id=s.room_id WHERE r.public_id LIKE 'OPSROM%'");
        expect(failures, "archived", 6,
            "SELECT COUNT(*) FROM chat_room_member_state s JOIN chat_room r ON r.id=s.room_id WHERE r.public_id LIKE 'OPSROM%' AND s.archived_at IS NOT NULL");
        if (version2) {
            verifyVersion2Coverage(failures);
        }
    }

    private void detectExternalReferences() throws SQLException {
        long external = count(
            "SELECT (SELECT COUNT(*) FROM auction a JOIN item_instance i ON i.id=a.item_instance_id "
                + "WHERE (i.public_id LIKE 'OPSITM%' OR a.seller_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\')) "
                + "AND a.public_id NOT LIKE 'OPSAUC%')+"
                + "(SELECT COUNT(*) FROM shop s JOIN item_instance i ON i.id=s.item_instance_id "
                + "WHERE (i.public_id LIKE 'OPSITM%' OR s.seller_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\')) "
                + "AND s.public_id NOT LIKE 'OPSSHP%')+"
                + "(SELECT COUNT(*) FROM bid b LEFT JOIN auction a ON a.id=b.auction_id WHERE b.public_id NOT LIKE 'OPSBID%' "
                + "AND (a.public_id LIKE 'OPSAUC%' OR b.bidder_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\')))+"
                + "(SELECT COUNT(*) FROM sale_order o WHERE o.public_id NOT LIKE 'OPSORD%' AND "
                + "(o.item_instance_id IN (SELECT id FROM item_instance WHERE public_id LIKE 'OPSITM%') OR "
                + "o.buyer_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\') OR "
                + "o.seller_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\')) "
                + "AND NOT (" + derivedClosingOrderCondition("o") + "))+"
                + "(SELECT COUNT(*) FROM chat_room r WHERE r.public_id NOT LIKE 'OPSROM%' AND "
                + "(r.member_low_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\') OR "
                + "r.member_high_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\')))+"
                + "(SELECT COUNT(*) FROM chat_message m LEFT JOIN chat_room r ON r.id=m.room_id "
                + "WHERE m.public_id NOT LIKE 'OPSMSG%' AND (r.public_id LIKE 'OPSROM%' OR "
                + "m.sender_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\')))+"
                + "(SELECT COUNT(*) FROM chat_user_block b JOIN user bu ON bu.id=b.blocker_id JOIN user bd "
                + "ON bd.id=b.blocked_id WHERE (bu.login_id LIKE ? ESCAPE '\\\\' OR bd.login_id LIKE ? ESCAPE '\\\\') "
                + "AND NOT (bu.login_id IN ('fc_ops_01','fc_ops_02','fc_ops_03') "
                + "AND bd.login_id IN ('fc_ops_11','fc_ops_12','fc_ops_13')))+"
                + "(SELECT COUNT(*) FROM user_social_account s WHERE s.user_id IN "
                + "(SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\'))+"
                + "(SELECT COUNT(*) FROM post p WHERE p.author_id IN "
                + "(SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\'))+"
                + "(SELECT COUNT(*) FROM comment c WHERE c.author_id IN "
                + "(SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\'))+"
                + "(SELECT COUNT(*) FROM comment_reaction r WHERE r.user_id IN "
                + "(SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\'))+"
                + "(SELECT COUNT(*) FROM post_image p WHERE p.uploader_id IN "
                + "(SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\'))+"
                + "(SELECT COUNT(*) FROM user_memo m WHERE m.public_id NOT LIKE 'OPSMEM%' AND "
                + "(m.sender_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\') OR "
                + "m.receiver_id IN (SELECT id FROM user WHERE login_id LIKE ? ESCAPE '\\\\')))",
            loginPattern, loginPattern, loginPattern, loginPattern, loginPattern, loginPattern, loginPattern,
            loginPattern, loginPattern, loginPattern, loginPattern, loginPattern, loginPattern,
            loginPattern, loginPattern, loginPattern, loginPattern);
        if (external != 0) {
            throw new IllegalStateException("외부 거래/대화 참조 " + external + "건으로 cleanup을 거부합니다.");
        }
    }

    private String derivedClosingOrderCondition(String orderAlias) {
        if (version2) {
            return "FALSE";
        }
        return orderAlias + ".source_type='AUCTION' AND EXISTS (SELECT 1 FROM auction da "
            + "JOIN item_instance di ON di.id=" + orderAlias + ".item_instance_id "
            + "JOIN user db ON db.id=" + orderAlias + ".buyer_id "
            + "JOIN user ds ON ds.id=" + orderAlias + ".seller_id WHERE da.id=" + orderAlias + ".source_id "
            + "AND da.public_id LIKE 'OPSAUC%' AND di.public_id LIKE 'OPSITM%' "
            + "AND db.public_id LIKE 'OPSUSR%' AND ds.public_id LIKE 'OPSUSR%' "
            + "AND da.item_instance_id=" + orderAlias + ".item_instance_id "
            + "AND da.seller_id=" + orderAlias + ".seller_id)";
    }

    private int removeDerivedClosingOrders() throws SQLException {
        if (version2) {
            return 0;
        }
        String derived = derivedClosingOrderCondition("o");
        int derivedOrderCount = Math.toIntExact(count("SELECT COUNT(*) FROM sale_order o "
            + "WHERE o.public_id NOT LIKE 'OPSORD%' AND " + derived));
        execute("DELETE d FROM item_delivery d JOIN sale_order o ON o.id=d.sale_order_id "
            + "WHERE o.public_id NOT LIKE 'OPSORD%' AND " + derived);
        execute("DELETE l FROM platform_revenue_ledger l JOIN sale_order o ON o.id=l.sale_order_id "
            + "WHERE o.public_id NOT LIKE 'OPSORD%' AND " + derived);
        execute("DELETE h FROM item_ownership_history h JOIN sale_order o ON o.id=h.sale_order_id "
            + "WHERE o.public_id NOT LIKE 'OPSORD%' AND " + derived);
        execute("DELETE o FROM sale_order o WHERE o.public_id NOT LIKE 'OPSORD%' AND " + derived);
        return derivedOrderCount;
    }

    private void validateDerivedClosingOrderChildren() throws SQLException {
        if (version2) {
            return;
        }
        String derived = derivedClosingOrderCondition("o");
        long invalid = count("SELECT COUNT(*) FROM sale_order o WHERE o.public_id NOT LIKE 'OPSORD%' AND "
            + derived + " AND (o.status<>'SETTLED' OR o.settled_at IS NULL OR o.buyer_id=o.seller_id OR "
            + "o.fee_policy_version<>'v1.0' OR o.final_price<>o.fee_amount+o.settle_amount OR "
            + "o.fee_amount<>LEAST(o.final_price,GREATEST(100,LEAST(300000,("
            + "LEAST(o.final_price,100000)*6+GREATEST(0,LEAST(o.final_price-100000,900000))*5+"
            + "GREATEST(0,LEAST(o.final_price-1000000,2000000))*4+"
            + "GREATEST(0,o.final_price-3000000)*3+50) DIV 100))) OR "
            + "NOT EXISTS (SELECT 1 FROM auction a WHERE a.id=o.source_id AND ((a.result_type='BID' AND "
            + "o.final_price=(SELECT b.amount FROM bid b WHERE b.auction_id=a.id AND b.status='WON' LIMIT 1) AND "
            + "o.buyer_id=(SELECT b.bidder_id FROM bid b WHERE b.auction_id=a.id AND b.status='WON' LIMIT 1) AND "
            + "(SELECT COUNT(*) FROM bid b WHERE b.auction_id=a.id AND b.status='WON')=1) OR "
            + "(a.result_type='BUYNOW' AND o.final_price=a.buy_now_price AND "
            + "o.buyer_id=(SELECT i.owner_id FROM item_instance i WHERE i.id=o.item_instance_id)))) OR "
            + "(SELECT COUNT(*) FROM item_delivery d WHERE d.sale_order_id=o.id)<>1 OR "
            + "EXISTS (SELECT 1 FROM item_delivery d WHERE d.sale_order_id=o.id AND "
            + "(d.recipient_user_id<>o.buyer_id OR d.item_instance_id<>o.item_instance_id OR "
            + "d.public_id IS NULL OR d.item_uuid IS NULL OR d.recipient_nickname IS NULL OR "
            + "d.status NOT IN ('PENDING','DEFERRED','CLAIMED','APPLIED','FAILED') OR "
            + "(d.status='CLAIMED')<>(d.claim_token IS NOT NULL AND d.claimed_at IS NOT NULL) OR "
            + "(d.status<>'CLAIMED' AND (d.claim_token IS NOT NULL OR d.claimed_at IS NOT NULL)) OR "
            + "(d.status='APPLIED')<>(d.applied_at IS NOT NULL))) OR "
            + "(SELECT COUNT(*) FROM platform_revenue_ledger l WHERE l.sale_order_id=o.id)<>1 OR "
            + "EXISTS (SELECT 1 FROM platform_revenue_ledger l WHERE l.sale_order_id=o.id AND "
            + "(l.amount<>o.fee_amount OR l.fee_policy_version<>o.fee_policy_version)) OR "
            + "(SELECT COUNT(*) FROM item_ownership_history h WHERE h.sale_order_id=o.id)<>1 OR "
            + "EXISTS (SELECT 1 FROM item_ownership_history h "
            + "WHERE h.sale_order_id=o.id AND (h.instance_id<>o.item_instance_id OR "
            + "h.from_owner_id<>o.seller_id OR h.to_owner_id<>o.buyer_id OR h.transfer_type<>'TRADE')))");
        if (invalid != 0) {
            throw new IllegalStateException("closing 파생 주문 자식 정합성 위반 " + invalid + "건으로 cleanup을 거부합니다.");
        }
    }

    private void verifyVersion2Coverage(List<String> failures) throws SQLException {
        expect(failures, "templateRows", 40, "SELECT COUNT(*) FROM item_template");
        expect(failures, "templateTypes", 40, "SELECT COUNT(DISTINCT type_code) FROM item_template");
        expect(failures, "activeShopTypeCoverage", 0,
            "SELECT COUNT(*) FROM (SELECT t.id FROM item_template t LEFT JOIN item_instance i ON i.template_id=t.id "
                + "AND i.public_id LIKE 'OPSITM%' LEFT JOIN shop s ON s.item_instance_id=i.id "
                + "AND s.public_id LIKE 'OPSSHP%' AND s.status='ACTIVE' GROUP BY t.id HAVING COUNT(s.id)<>1) x");
        int[][] expected = {{4, 4, 4}, {5, 5, 4}, {5, 5, 4}};
        for (int skill = 0; skill < 3; skill++) {
            for (int goldForce = 0; goldForce < 3; goldForce++) {
                expect(failures, "activeShopGrid" + skill + goldForce, expected[skill][goldForce],
                    "SELECT COUNT(*) FROM shop s JOIN item_instance i ON i.id=s.item_instance_id "
                        + "WHERE s.public_id LIKE 'OPSSHP%' AND s.status='ACTIVE' AND "
                        + skillCondition(skill) + " AND " + goldForceCondition(goldForce));
            }
        }
    }

    private String skillCondition(int group) {
        return switch (group) {
            case 0 -> "i.skill1_id IS NULL AND i.skill2_id IS NULL";
            case 1 -> "i.skill1_id IS NOT NULL AND i.skill2_id IS NULL";
            default -> "i.skill1_id IS NOT NULL AND i.skill2_id IS NOT NULL";
        };
    }

    private String goldForceCondition(int group) {
        return switch (group) {
            case 0 -> "i.gf_expire_at IS NULL";
            case 1 -> "i.gf_expire_at>CURRENT_TIMESTAMP(6)";
            default -> "i.gf_expire_at<=CURRENT_TIMESTAMP(6)";
        };
    }

    private boolean expectedCoreCounts() throws SQLException {
        return count("SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OPSAUC%'") == auctionCount()
            && count("SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OPSBID%'") == bidCount()
            && count("SELECT COUNT(*) FROM shop WHERE public_id LIKE 'OPSSHP%'") == shopCount()
            && count("SELECT COUNT(*) FROM sale_order WHERE public_id LIKE 'OPSORD%'") == 16
            && count("SELECT COUNT(*) FROM chat_message WHERE public_id LIKE 'OPSMSG%'") == 420
            && count("SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%'") == 100;
    }

    private void requireMasters() throws SQLException {
        long templates = count("SELECT COUNT(*) FROM item_template");
        long types = count("SELECT COUNT(DISTINCT type_code) FROM item_template");
        if (version2 && (templates != 40 || types != 40)) {
            throw new IllegalStateException("ops-20-v2는 item_template 40행과 distinct type_code 40개가 필요합니다.");
        }
        if ((!version2 && templates < 24) || count("SELECT COUNT(*) FROM skill_definition") < 18) {
            throw new IllegalStateException("item_template 24개와 skill_definition 18개 이상이 필요합니다.");
        }
    }

    private void dist(List<String> failures, String table, String scope, String column, String[] values, int[] expected)
        throws SQLException {
        for (int i = 0; i < values.length; i++) {
            expect(failures, table + "." + values[i], expected[i],
                "SELECT COUNT(*) FROM " + table + " WHERE " + scope + " AND " + column + "=?", values[i]);
        }
    }

    private void expect(List<String> failures, String name, long expected, String sql, Object... args)
        throws SQLException {
        long actual = count(sql, args);
        if (actual != expected) {
            failures.add(name + "=" + actual + "/" + expected);
        }
    }

    private long count(String sql, Object... args) throws SQLException {
        try (PreparedStatement statement = prepare(sql, args); ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getLong(1);
        }
    }

    private List<Long> ids(String sql) throws SQLException {
        List<Long> result = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql);
            ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                result.add(rows.getLong(1));
            }
        }
        return result;
    }

    private void execute(String sql, Object... args) throws SQLException {
        try (PreparedStatement statement = prepare(sql, args)) {
            statement.executeUpdate();
        }
    }

    private PreparedStatement prepare(String sql, Object... args) throws SQLException {
        PreparedStatement statement = connection.prepareStatement(scope(sql));
        for (int i = 0; i < args.length; i++) {
            statement.setObject(i + 1, args[i]);
        }
        return statement;
    }

    private long lastId() throws SQLException {
        return count("SELECT LAST_INSERT_ID()");
    }

    private Instant databaseNow() throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT CURRENT_TIMESTAMP(6)");
            ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getTimestamp(1).toInstant();
        }
    }

    private String key(String prefix, int number) {
        prefix = version2 ? prefix.replace("OPS", "OP2") : prefix;
        return prefix + String.format("%0" + (26 - prefix.length()) + "d", number);
    }

    private String scope(String sql) {
        if (!version2) {
            return sql;
        }
        return sql.replace("login_id LIKE ? ESCAPE '\\\\'", "public_id LIKE ? ESCAPE '\\\\'")
            .replace("OPSITM", "OP2ITM").replace("OPSAUC", "OP2AUC").replace("OPSBID", "OP2BID")
            .replace("OPSSHP", "OP2SHP").replace("OPSORD", "OP2ORD").replace("OPSDLV", "OP2DLV")
            .replace("OPSROM", "OP2ROM").replace("OPSMSG", "OP2MSG").replace("OPSMEM", "OP2MEM")
            .replace("OPSRPT", "OP2RPT").replace("OPSEVT", "OP2EVT").replace("fc_ops_", "test");
    }

    private long legacyRowCount() throws SQLException {
        String sql = "SELECT (SELECT COUNT(*) FROM user WHERE login_id LIKE 'fc\\_ops\\_%' ESCAPE '\\\\')+"
            + "(SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%')+"
            + "(SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OPSAUC%')+"
            + "(SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OPSBID%')+"
            + "(SELECT COUNT(*) FROM shop WHERE public_id LIKE 'OPSSHP%')+"
            + "(SELECT COUNT(*) FROM sale_order WHERE public_id LIKE 'OPSORD%')+"
            + "(SELECT COUNT(*) FROM chat_room WHERE public_id LIKE 'OPSROM%')+"
            + "(SELECT COUNT(*) FROM chat_message WHERE public_id LIKE 'OPSMSG%')+"
            + "(SELECT COUNT(*) FROM chat_event_outbox WHERE event_id LIKE 'OPSEVT%')+"
            + "(SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%')";
        try (PreparedStatement statement = connection.prepareStatement(sql);
            ResultSet result = statement.executeQuery()) {
            result.next();
            return result.getLong(1);
        }
    }

    private boolean isLegacyOutboxOnly() throws SQLException {
        if (version2) {
            return false;
        }
        long outbox = count("SELECT COUNT(*) FROM chat_event_outbox WHERE event_id LIKE 'OPSEVT%'");
        return outbox > 0 && count("SELECT (SELECT COUNT(*) FROM user WHERE login_id LIKE ? ESCAPE '\\\\')+"
            + "(SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'OPSITM%')+"
            + "(SELECT COUNT(*) FROM auction WHERE public_id LIKE 'OPSAUC%')+"
            + "(SELECT COUNT(*) FROM bid WHERE public_id LIKE 'OPSBID%')+"
            + "(SELECT COUNT(*) FROM shop WHERE public_id LIKE 'OPSSHP%')+"
            + "(SELECT COUNT(*) FROM sale_order WHERE public_id LIKE 'OPSORD%')+"
            + "(SELECT COUNT(*) FROM chat_room WHERE public_id LIKE 'OPSROM%')+"
            + "(SELECT COUNT(*) FROM chat_message WHERE public_id LIKE 'OPSMSG%')+"
            + "(SELECT COUNT(*) FROM user_memo WHERE public_id LIKE 'OPSMEM%')", loginPattern) == 0;
    }

    private static String uuid(int number) {
        return String.format("00000000-0000-4000-8000-%012d", number);
    }

    private int itemCount() {
        return version2 ? 240 : 160;
    }

    private int auctionCount() {
        return version2 ? 56 : 36;
    }

    private int bidCount() {
        return version2 ? 200 : 120;
    }

    private int shopCount() {
        return version2 ? 56 : 32;
    }

    private String scenarioKey() {
        return version2 ? "ops-20-v2" : "ops-20-v1";
    }

    private String loginId(int number) {
        return version2 ? String.format("test%02d", number) : String.format("fc_ops_%02d", number);
    }

    private int skillGroup(int itemNumber) {
        if (!version2) {
            return itemNumber <= 12 ? 0 : itemNumber <= 60 ? 1 : 2;
        }
        if (itemNumber >= 57 && itemNumber <= 96) {
            int activeShopNumber = itemNumber - 56;
            return activeShopNumber <= 12 ? 0 : activeShopNumber <= 26 ? 1 : 2;
        }
        int ordinal = itemNumber < 57 ? itemNumber : itemNumber - 40;
        return ordinal <= 36 ? 0 : ordinal <= 94 ? 1 : 2;
    }

    private int gfGroup(int itemNumber) {
        if (!version2) {
            return itemNumber <= 80 ? 0 : itemNumber <= 136 ? 1 : 2;
        }
        if (itemNumber >= 57 && itemNumber <= 96) {
            int activeShopNumber = itemNumber - 56;
            if (activeShopNumber <= 12) {
                return (activeShopNumber - 1) / 4;
            }
            if (activeShopNumber <= 26) {
                int singleNumber = activeShopNumber - 13;
                return singleNumber < 5 ? 0 : singleNumber < 10 ? 1 : 2;
            }
            int doubleNumber = activeShopNumber - 27;
            return doubleNumber < 5 ? 0 : doubleNumber < 10 ? 1 : 2;
        }
        int ordinal = itemNumber < 57 ? itemNumber : itemNumber - 40;
        return ordinal <= 82 ? 0 : ordinal <= 164 ? 1 : 2;
    }

    private static int skilledPercent(int ordinal) {
        if (ordinal <= 40) {
            return 5 + (ordinal - 1) % 11;
        }
        if (ordinal <= 96) {
            return 16 + (ordinal - 41) % 15;
        }
        if (ordinal <= 152) {
            return 31 + (ordinal - 97) % 20;
        }
        if (ordinal <= 184) {
            return 51 + (ordinal - 153) % 30;
        }
        return 81 + (ordinal - 185) % 19;
    }

    private String auctionStatus(int number) {
        if (!version2) {
            return number <= 4 ? "SCHEDULED"
                : number <= 20 ? "ACTIVE" : number <= 30 ? "SOLD" : number <= 33 ? "UNSOLD" : "CANCELLED";
        }
        return number <= 4 ? "SCHEDULED"
            : number <= 36 ? "ACTIVE" : number <= 46 ? "SOLD" : number <= 51 ? "UNSOLD" : "CANCELLED";
    }

    private String shopStatus(int number) {
        if (!version2) {
            return number <= 20 ? "ACTIVE" : number <= 26 ? "SOLD" : number <= 29 ? "EXPIRED" : "CANCELLED";
        }
        return number <= 40 ? "ACTIVE" : number <= 46 ? "SOLD" : number <= 51 ? "EXPIRED" : "CANCELLED";
    }

    private long shopPrice(int number) {
        if (!version2) {
            return 30_000L + number * 2_500L;
        }
        return 30_000L + (8_770_000L * (number - 1) / 55);
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static int character(int number) {
        int[] characters = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 25, 26, 27, 28};
        return characters[(number - 1) % 16];
    }

    private int level(int number) {
        if (version2) {
            if (number <= 48) {
                return 1 + (number - 1) % 3;
            }
            if (number <= 120) {
                return 4 + (number - 49) % 3;
            }
            if (number <= 192) {
                return 7 + (number - 121) % 3;
            }
            return 10 + (number - 193) % 6;
        }
        if (number <= 30) {
            return 1 + (number - 1) % 3;
        }
        if (number <= 78) {
            return 4 + (number - 31) % 3;
        }
        if (number <= 128) {
            return 7 + (number - 79) % 3;
        }
        return 10 + (number - 129) % 6;
    }

    private static int percent(int number) {
        if (number <= 32) {
            return 5 + (number - 1) % 11;
        }
        if (number <= 80) {
            return 16 + (number - 33) % 15;
        }
        if (number <= 128) {
            return 31 + (number - 81) % 20;
        }
        if (number <= 152) {
            return 51 + (number - 129) % 30;
        }
        return 81 + (number - 153) % 19;
    }

    private int buyer(int item, int seller) {
        int bidStart = version2 ? 37 : 21;
        int buyNowStart = version2 ? 44 : 28;
        int shopSoldStart = version2 ? 97 : 57;
        if (item >= bidStart && item <= bidStart + 6) {
            int result = 1 + (seller + item) % 20;
            return result == seller ? 1 + result % 20 : result;
        }
        return (item >= buyNowStart && item <= buyNowStart + 2)
            || (item >= shopSoldStart && item <= shopSoldStart + 5) ? 1 + (seller + 6) % 20 : seller;
    }

    private String location(int number) {
        if (version2) {
            if (number <= 36 || number >= 57 && number <= 96) {
                return "LISTED";
            }
            if (number >= 37 && number <= 42) {
                return "IN_GAME";
            }
            if (number == 43 || number >= 103 && number <= 111) {
                return "TEMP";
            }
            return "INVENTORY";
        }
        if (number <= 20 || number >= 37 && number <= 56) {
            return "LISTED";
        }
        if (number >= 21 && number <= 26) {
            return "IN_GAME";
        }
        if (number == 27 || number >= 69 && number <= 77) {
            return "TEMP";
        }
        return "INVENTORY";
    }

    private Instant auctionEnd(int number, String status) {
        if ("SCHEDULED".equals(status)) {
            if (version2) {
                long[] minutes = {15, 60, 360, 1_440};
                return now.plus(minutes[number - 1], ChronoUnit.MINUTES);
            }
            return now.plus(number + 3L, ChronoUnit.DAYS);
        }
        if (!"ACTIVE".equals(status)) {
            return now.minus(number, ChronoUnit.HOURS);
        }
        int activeNumber = number - 4;
        if (version2) {
            if (activeNumber <= 6) {
                return now.plus(Math.min(5, activeNumber), ChronoUnit.MINUTES);
            }
            if (activeNumber <= 14) {
                return now.plus(5L + (activeNumber - 6L) * 3L, ChronoUnit.MINUTES);
            }
            if (activeNumber <= 24) {
                return now.plus(activeNumber - 14L, ChronoUnit.HOURS);
            }
            return now.plus(6L + (activeNumber - 24L) * 8L, ChronoUnit.HOURS);
        }
        if (activeNumber <= 4) {
            return now.plus(activeNumber * 3L, ChronoUnit.MINUTES);
        }
        if (activeNumber <= 10) {
            return now.plus(activeNumber - 3L, ChronoUnit.HOURS);
        }
        return now.plus(activeNumber - 9L, ChronoUnit.DAYS);
    }

    private static String deliveryStatus(int number) {
        if (number <= 6) {
            return "APPLIED";
        }
        if (number <= 11) {
            return "PENDING";
        }
        if (number <= 13) {
            return "DEFERRED";
        }
        if (number == 14) {
            return "CLAIMED";
        }
        return "FAILED";
    }

    private static long fee(long price) {
        long numerator = Math.min(price, 100_000) * 6;
        numerator += Math.max(0, Math.min(price - 100_000, 900_000)) * 5;
        numerator += Math.max(0, Math.min(price - 1_000_000, 2_000_000)) * 4;
        numerator += Math.max(0, price - 3_000_000) * 3;
        long rounded = (numerator + 50) / 100;
        return Math.min(price, Math.max(100, Math.min(300_000, rounded)));
    }

    private static String chatBody(int sequence) {
        String[] bodies = {"아이템 옵션 확인 가능할까요?", "골드포스 남은 기간은 화면과 같습니다.", "가격을 조정할 수 있을까요?", "경매 종료 전에 다시 확인하겠습니다.",
            "배송 상태 확인했습니다.", "스킬 조합 때문에 관심이 있습니다."};
        return bodies[(sequence - 1) % bodies.length];
    }

    private record OrderSource(long sellerId, long buyerId, long price, String buyerNickname) {
    }

    enum State {
        EMPTY, COMPLETE, PARTIAL
    }
}
