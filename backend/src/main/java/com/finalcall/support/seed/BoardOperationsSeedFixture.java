package com.finalcall.support.seed;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** FinalCall 세계관으로 창작한 board-surf-20-v1 게시판 fixture. */
final class BoardOperationsSeedFixture {
    private static final String POST_PREFIX = "BSP01";
    private static final String COMMENT_PREFIX = "BSC01";
    private static final String DISCLAIMER = "\n\n※ FinalCall은 해당 게임의 공식 운영 서비스가 아니며, 이 게시글은 테스트를 위한 창작 데이터입니다.";
    private static final String[] COMMUNITY_TOPICS = {
        "토너먼트", "팀플레이", "사커 미니게임", "노카드전", "길드", "채널 선택", "옛날 아이템전", "PvP·PvE", "성장 카드 세팅"
    };
    private static final String[] TOPIC_DETAILS = {
        "예선에서는 이동 속도보다 피격 후 복귀 동선을 먼저 맞췄습니다.", "앞선 역할은 방어 장비, 후방 역할은 재사용 대기 감소를 우선했습니다.",
        "공을 오래 소유하기보다 측면 패스 두 번 뒤 중앙으로 연결하는 흐름이 안정적이었습니다.", "장비 보정 없이 거리 조절과 회피 타이밍만 반복했습니다.",
        "신규 길드원에게는 비싼 장비 대신 역할별 최저 조건표를 공유했습니다.", "혼잡 시간과 한산한 시간의 검색 응답과 매물 회전 차이를 기록했습니다.",
        "예전 장비의 낮은 수치도 희소 스킬 조합에 따라 활용처가 달라졌습니다.", "대전 세팅과 협동 세팅은 생존 옵션의 우선순위를 다르게 잡았습니다.",
        "7단계까지 한 번에 올리지 않고 단계별 체감이 바뀌는 구간을 메모했습니다."
    };
    private static final String[] EVENT_TOPICS = {
        "주말 토너먼트 참가 인증", "3인 팀플레이 조합 공유", "사커 미니게임 친선 주간", "노카드 기본기 챌린지",
        "길드 협동 미션", "PvE 보스 공략 기록전", "1대1 연승 도전", "추억 장비 세팅 자랑",
        "바람 계열 빌드 연구", "7단계 성장 달성 인증", "스킬 2슬롯 조합 공모", "Gold Force 없는 장비 겨루기"
    };
    private static final String[] NOTICE_TITLES = {
        "초보 거래자를 위한 안전 거래 안내", "계정 및 접속 환경 중복 참여 방지 정책", "포인트 적립과 이벤트 보상 수령 기준",
        "실시간 경매 마감 연장 규칙 안내", "아이템 마켓 수수료와 정산 시간 안내", "Gold Force 표기와 만료 상태 확인 방법",
        "스킬 슬롯 1·2 검색 필터 사용 안내", "거래 채팅 사칭과 외부 결제 유도 주의", "비정상 입찰과 시세 조작 대응 원칙",
        "인벤토리 공간 부족과 임시 보관함 안내", "주간 점검 및 검색 인덱스 갱신 안내", "시즌 종료 후 이벤트 보상 수령 안내"
    };

    private final Connection connection;
    private final Instant now;
    private final long[] users = new long[21];
    private final String[] nicknames = new String[21];
    private final long[] posts = new long[61];
    private final Instant[] postCreated = new Instant[61];
    private final long[] comments = new long[205];
    private final int[] commentAuthors = new int[205];
    private final Instant[] commentTimes = new Instant[205];

    BoardOperationsSeedFixture(Connection connection) throws SQLException {
        this.connection = connection;
        this.now = databaseNow();
    }

    State state() throws SQLException {
        long postCount = count("SELECT COUNT(*) FROM post WHERE public_id LIKE 'BSP01%'");
        long commentCount = count("SELECT COUNT(*) FROM comment WHERE public_id LIKE 'BSC01%'");
        long reactionCount = count("SELECT COUNT(*) FROM comment_reaction r JOIN comment c ON c.id=r.comment_id "
            + "WHERE c.public_id LIKE 'BSC01%'");
        if (postCount == 0 && commentCount == 0 && reactionCount == 0) {
            return State.EMPTY;
        }
        if (postCount == 60 && commentCount == 204 && reactionCount == 312) {
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
        if (state != State.COMPLETE) {
            throw new IllegalStateException("완전한 시드만 정리할 수 있습니다.");
        }
        verify();
        detectExternalReferences();
    }

    void dryRun() throws SQLException {
        requireMasters();
        State current = state();
        if (current == State.PARTIAL) {
            throw new IllegalStateException("부분 시드 상태입니다.");
        }
        if (current == State.COMPLETE) {
            verify();
            detectExternalReferences();
        }
        System.out.println("예정 건수: posts=60 comments=204 reactions=312 (notice=12 community=36 event=12)");
    }

    void apply() throws SQLException {
        requireMasters();
        loadUsers();
        insertPosts();
        insertComments();
        insertReactions();
        refreshCounters();
    }

    void verify() throws SQLException {
        requireMasters();
        loadUsers();
        List<String> failures = new ArrayList<>();
        expect(failures, "posts", 60, "SELECT COUNT(*) FROM post WHERE public_id LIKE 'BSP01%'");
        expect(failures, "comments", 204, "SELECT COUNT(*) FROM comment WHERE public_id LIKE 'BSC01%'");
        expect(failures, "reactions", 312, "SELECT COUNT(*) FROM comment_reaction r JOIN comment c "
            + "ON c.id=r.comment_id WHERE c.public_id LIKE 'BSC01%'");
        expect(failures, "noticePosts", 12, boardPostCountSql("notice"));
        expect(failures, "communityPosts", 36, boardPostCountSql("community"));
        expect(failures, "eventPosts", 12, boardPostCountSql("event"));
        expect(failures, "pinned", 5, "SELECT COUNT(*) FROM post WHERE public_id LIKE 'BSP01%' AND is_pinned=1");
        expect(failures, "rootComments", 144, "SELECT COUNT(*) FROM comment WHERE public_id LIKE 'BSC01%' "
            + "AND parent_comment_id IS NULL");
        expect(failures, "replies", 60, "SELECT COUNT(*) FROM comment WHERE public_id LIKE 'BSC01%' "
            + "AND parent_comment_id IS NOT NULL");
        expect(failures, "likes", 260, reactionCountSql("LIKE"));
        expect(failures, "dislikes", 52, reactionCountSql("DISLIKE"));
        expect(failures, "selfReaction", 0, "SELECT COUNT(*) FROM comment_reaction r JOIN comment c "
            + "ON c.id=r.comment_id WHERE c.public_id LIKE 'BSC01%' AND r.user_id=c.author_id");
        expect(failures, "postCounterMismatch", 0, "SELECT COUNT(*) FROM post p WHERE p.public_id LIKE 'BSP01%' "
            + "AND p.comment_count<>(SELECT COUNT(*) FROM comment c WHERE c.post_id=p.id AND c.is_deleted=0)");
        expect(failures, "replyCounterMismatch", 0, "SELECT COUNT(*) FROM comment c WHERE c.public_id LIKE 'BSC01%' "
            + "AND c.reply_count<>(SELECT COUNT(*) FROM comment r WHERE r.parent_comment_id=c.id AND r.is_deleted=0)");
        expect(failures, "reactionCounterMismatch", 0, "SELECT COUNT(*) FROM comment c WHERE c.public_id LIKE 'BSC01%' "
            + "AND (c.like_count<>(SELECT COUNT(*) FROM comment_reaction r WHERE r.comment_id=c.id AND r.reaction_type='LIKE') "
            + "OR c.dislike_count<>(SELECT COUNT(*) FROM comment_reaction r WHERE r.comment_id=c.id AND r.reaction_type='DISLIKE'))");
        expect(failures, "communityAuthorDistribution", 20, "SELECT COUNT(*) FROM (SELECT author_id,COUNT(*) c "
            + "FROM post WHERE public_id LIKE 'BSP01%' AND author_id IS NOT NULL GROUP BY author_id "
            + "HAVING c BETWEEN 1 AND 2) x");
        expect(failures, "participantRoots", 20, "SELECT COUNT(*) FROM (SELECT c.author_id FROM comment c "
            + "WHERE c.public_id LIKE 'BSC01%' AND c.parent_comment_id IS NULL GROUP BY c.author_id HAVING COUNT(*)>=6) x");
        expect(failures, "participantReplies", 20, "SELECT COUNT(*) FROM (SELECT c.author_id FROM comment c "
            + "WHERE c.public_id LIKE 'BSC01%' AND c.parent_comment_id IS NOT NULL GROUP BY c.author_id HAVING COUNT(*)>=2) x");
        expect(failures, "bothReactionTypes", 20, "SELECT COUNT(*) FROM (SELECT r.user_id FROM comment_reaction r "
            + "JOIN comment c ON c.id=r.comment_id WHERE c.public_id LIKE 'BSC01%' GROUP BY r.user_id "
            + "HAVING COUNT(DISTINCT r.reaction_type)=2) x");
        expect(failures, "deletedRows", 0, "SELECT COUNT(*) FROM post p LEFT JOIN comment c ON c.post_id=p.id "
            + "WHERE p.public_id LIKE 'BSP01%' AND (p.is_deleted=1 OR c.is_deleted=1)");
        expect(failures, "recentPinnedNotices", 3, "SELECT COUNT(*) FROM post p JOIN board b ON b.id=p.board_id "
            + "WHERE p.public_id LIKE 'BSP01%' AND b.slug='notice' AND p.is_pinned=1 "
            + "AND p.created_at>=DATE_SUB(?,INTERVAL 30 DAY)", ts(now));
        expect(failures, "communityRecent7Days", 18, "SELECT COUNT(*) FROM post p JOIN board b ON b.id=p.board_id "
            + "WHERE p.public_id LIKE 'BSP01%' AND b.slug='community' "
            + "AND p.created_at>=DATE_SUB(?,INTERVAL 7 DAY)", ts(now));
        expect(failures, "communityRecent24Hours", 8, "SELECT COUNT(*) FROM post p JOIN board b ON b.id=p.board_id "
            + "WHERE p.public_id LIKE 'BSP01%' AND b.slug='community' "
            + "AND p.created_at>=DATE_SUB(?,INTERVAL 24 HOUR)", ts(now));
        expect(failures, "commentBeforePost", 0, "SELECT COUNT(*) FROM comment c JOIN post p ON p.id=c.post_id "
            + "WHERE c.public_id LIKE 'BSC01%' AND c.created_at<=p.created_at");
        expect(failures, "replyBeforeRoot", 0, "SELECT COUNT(*) FROM comment c JOIN comment parent "
            + "ON parent.id=c.parent_comment_id WHERE c.public_id LIKE 'BSC01%' AND c.created_at<=parent.created_at");
        for (String kind : new String[] {"질문", "공략", "모집", "후기", "거래·시세"}) {
            expect(failures, "communityKind-" + kind, expectedKindCount(kind), "SELECT COUNT(*) FROM post p "
                + "JOIN board b ON b.id=p.board_id WHERE p.public_id LIKE 'BSP01%' AND b.slug='community' "
                + "AND p.title LIKE '[" + kind + "]%'");
        }
        verifyFixtureText(failures);
        verifyCommentFixture(failures);
        verifyReactionFixture(failures);
        if (!failures.isEmpty()) {
            throw new IllegalStateException("시드 불변식 위반: " + String.join(", ", failures));
        }
    }

    void cleanup() throws SQLException {
        verify();
        detectExternalReferences();
        execute("DELETE r FROM comment_reaction r JOIN comment c ON c.id=r.comment_id WHERE c.public_id LIKE 'BSC01%'");
        execute("DELETE FROM comment WHERE public_id LIKE 'BSC01%' AND parent_comment_id IS NOT NULL");
        execute("DELETE FROM comment WHERE public_id LIKE 'BSC01%'");
        execute("DELETE FROM post WHERE public_id LIKE 'BSP01%'");
        if (state() != State.EMPTY) {
            throw new IllegalStateException("정리 후 EMPTY 상태가 아닙니다.");
        }
    }

    private void requireMasters() throws SQLException {
        expectExact("게시판", 3, "SELECT COUNT(*) FROM board WHERE slug IN ('notice','community','event')");
        expectExact("test01~test20 사용자", 20,
            "SELECT COUNT(*) FROM user WHERE login_id REGEXP '^test(0[1-9]|1[0-9]|20)$'");
    }

    private void loadUsers() throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT id,nickname,login_id FROM user WHERE login_id REGEXP '^test(0[1-9]|1[0-9]|20)$' ORDER BY login_id");
            ResultSet rows = statement.executeQuery()) {
            int index = 1;
            while (rows.next()) {
                users[index] = rows.getLong("id");
                nicknames[index] = rows.getString("nickname");
                index++;
            }
        }
    }

    private void insertPosts() throws SQLException {
        int number = 0;
        for (int i = 0; i < NOTICE_TITLES.length; i++) {
            number++;
            String body = NOTICE_TITLES[i] + "입니다. 거래 전 대상 아이템의 레벨, 스킬 슬롯, Gold Force 만료 여부를 확인하고 "
                + "플랫폼 안에서 제공되는 기록과 절차를 이용해 주세요." + DISCLAIMER;
            Instant created = i < 3 ? now.minus(1L + i * 9L, ChronoUnit.DAYS)
                : now.minus(40L + (i - 3L) * 10L, ChronoUnit.DAYS);
            insertPost(number, "notice", null, "FinalCall 운영팀", NOTICE_TITLES[i], body, i < 3, created,
                180 + i * 329);
        }
        for (int i = 0; i < 36; i++) {
            number++;
            int user = i < 32 ? i / 2 + 1 : i - 15;
            String topic = COMMUNITY_TOPICS[i % COMMUNITY_TOPICS.length];
            String kind = communityKind(i);
            String title = "[" + kind + "] " + topic + " 실험 기록 " + String.format("%02d", i + 1);
            String body = communityContent(i);
            Instant created = communityCreated(i);
            insertPost(number, "community", users[user], nicknames[user], title, body, false, created, 12 + i * 41);
        }
        for (int i = 0; i < EVENT_TOPICS.length; i++) {
            number++;
            String phase = i < 4 ? "종료된 기록형" : i < 10 ? "진행 분위기의" : "예고형";
            String body = phase + " 테스트 이벤트입니다. 참여 글에는 사용한 장비 레벨, 스킬 1·2 조합과 Gold Force 여부를 "
                + "함께 적어 주세요. 보상 표현은 테스트용 예시이며 실제 지급을 약속하지 않습니다." + DISCLAIMER;
            Instant created = i < 4 ? now.minus(90L - i * 20L, ChronoUnit.DAYS)
                : i < 10 ? now.minus(14L - i, ChronoUnit.DAYS) : now.minus(12L - i, ChronoUnit.HOURS);
            insertPost(number, "event", null, "FinalCall 이벤트팀", EVENT_TOPICS[i], body, i < 2, created,
                90 + i * 211);
        }
    }

    private void insertPost(int number, String board, Long author, String nickname, String title, String content,
        boolean pinned, Instant created, int views) throws SQLException {
        execute("INSERT INTO post(public_id,board_id,author_id,author_nickname,title,content,view_count,comment_count,"
            + "is_pinned,is_deleted,deleted_at,created_at,updated_at) SELECT ?,id,?,?,?,?,?,0,?,0,NULL,?,? FROM board "
            + "WHERE slug=?", key(POST_PREFIX, number), author, nickname, title, content, views, pinned, ts(created),
            ts(created), board);
        posts[number] = lastId();
        postCreated[number] = created;
    }

    private void insertComments() throws SQLException {
        for (CommentSpec spec : commentSpecs()) {
            Long parentId = spec.parentNumber() == null ? null : comments[spec.parentNumber()];
            Instant parentTime = spec.parentNumber() == null ? postCreated[spec.postNumber()]
                : commentCreated(spec.parentNumber());
            Instant created = parentTime.plus(spec.parentNumber() == null ? 10L + spec.rootIndex() : 10L,
                ChronoUnit.MINUTES);
            insertComment(spec.number(), posts[spec.postNumber()], spec.user(), parentId, spec.content(), created);
        }
    }

    private long insertComment(int number, long postId, int user, Long parentId, String content, Instant created)
        throws SQLException {
        String mentioned = null;
        if (parentId != null) {
            mentioned = nicknameForComment(parentId);
        }
        execute("INSERT INTO comment(public_id,post_id,author_id,author_nickname,content,parent_comment_id,"
            + "mentioned_nickname,like_count,dislike_count,reply_count,is_deleted,deleted_at,created_at,updated_at) "
            + "VALUES(?,?,?,?,?,?,?,0,0,0,0,NULL,?,?)", key(COMMENT_PREFIX, number), postId, users[user],
            nicknames[user], content, parentId, mentioned, ts(created), ts(created));
        comments[number] = lastId();
        commentAuthors[number] = user;
        commentTimes[number] = created;
        return comments[number];
    }

    private String nicknameForComment(long commentId) throws SQLException {
        try (PreparedStatement statement = connection
            .prepareStatement("SELECT author_nickname FROM comment WHERE id=?")) {
            statement.setLong(1, commentId);
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
                return rows.getString(1);
            }
        }
    }

    private void insertReactions() throws SQLException {
        for (ReactionSpec spec : reactionSpecs()) {
            execute("INSERT INTO comment_reaction(comment_id,user_id,reaction_type,created_at,updated_at) "
                + "VALUES(?,?,?,?,?)", comments[spec.commentNumber()], users[spec.user()], spec.type(), ts(now),
                ts(now));
        }
    }

    private void refreshCounters() throws SQLException {
        execute("UPDATE comment c LEFT JOIN (SELECT parent_comment_id,COUNT(*) cnt FROM comment "
            + "WHERE parent_comment_id IS NOT NULL GROUP BY parent_comment_id) replies ON replies.parent_comment_id=c.id "
            + "LEFT JOIN (SELECT comment_id,SUM(reaction_type='LIKE') likes,SUM(reaction_type='DISLIKE') dislikes "
            + "FROM comment_reaction GROUP BY comment_id) reactions ON reactions.comment_id=c.id "
            + "SET c.reply_count=COALESCE(replies.cnt,0),c.like_count=COALESCE(reactions.likes,0),"
            + "c.dislike_count=COALESCE(reactions.dislikes,0) WHERE c.public_id LIKE 'BSC01%'");
        execute("UPDATE post p JOIN (SELECT post_id,COUNT(*) cnt FROM comment GROUP BY post_id) comments "
            + "ON comments.post_id=p.id SET p.comment_count=comments.cnt WHERE p.public_id LIKE 'BSP01%'");
    }

    private void detectExternalReferences() throws SQLException {
        long external = count("SELECT (SELECT COUNT(*) FROM post_image i JOIN post p ON p.id=i.post_id "
            + "WHERE p.public_id LIKE 'BSP01%')+(SELECT COUNT(*) FROM comment c JOIN post p ON p.id=c.post_id "
            + "WHERE p.public_id LIKE 'BSP01%' AND c.public_id NOT LIKE 'BSC01%')+(SELECT COUNT(*) FROM comment_reaction r "
            + "JOIN comment c ON c.id=r.comment_id JOIN user u ON u.id=r.user_id WHERE c.public_id LIKE 'BSC01%' "
            + "AND u.login_id NOT REGEXP '^test(0[1-9]|1[0-9]|20)$')");
        if (external != 0) {
            throw new IllegalStateException("외부 게시판 참조가 있어 정리할 수 없습니다.");
        }
    }

    private void verifyFixtureText(List<String> failures) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT p.title,p.content,p.author_id,"
            + "p.author_nickname,p.view_count,p.is_pinned,b.slug,u.login_id FROM post p JOIN board b ON b.id=p.board_id "
            + "LEFT JOIN user u ON u.id=p.author_id WHERE p.public_id LIKE 'BSP01%' ORDER BY p.public_id");
            ResultSet rows = statement.executeQuery()) {
            int number = 0;
            while (rows.next()) {
                number++;
                String expectedTitle;
                String expectedContent;
                boolean expectedSystem;
                boolean expectedPinned;
                String expectedBoard;
                String expectedNickname;
                String expectedLogin;
                int expectedViews;
                if (number <= 12) {
                    expectedTitle = NOTICE_TITLES[number - 1];
                    expectedContent = expectedTitle + "입니다. 거래 전 대상 아이템의 레벨, 스킬 슬롯, Gold Force 만료 여부를 확인하고 "
                        + "플랫폼 안에서 제공되는 기록과 절차를 이용해 주세요." + DISCLAIMER;
                    expectedSystem = true;
                    expectedPinned = number <= 3;
                    expectedBoard = "notice";
                    expectedNickname = "FinalCall 운영팀";
                    expectedLogin = null;
                    expectedViews = 180 + (number - 1) * 329;
                } else if (number <= 48) {
                    int index = number - 13;
                    String topic = COMMUNITY_TOPICS[index % COMMUNITY_TOPICS.length];
                    expectedTitle = "[" + communityKind(index) + "] " + topic + " 실험 기록 "
                        + String.format("%02d", index + 1);
                    expectedContent = communityContent(index);
                    expectedSystem = false;
                    expectedPinned = false;
                    expectedBoard = "community";
                    int user = index < 32 ? index / 2 + 1 : index - 15;
                    expectedNickname = nicknames[user];
                    expectedLogin = String.format("test%02d", user);
                    expectedViews = 12 + index * 41;
                } else {
                    int index = number - 49;
                    String phase = index < 4 ? "종료된 기록형" : index < 10 ? "진행 분위기의" : "예고형";
                    expectedTitle = EVENT_TOPICS[index];
                    expectedContent = phase + " 테스트 이벤트입니다. 참여 글에는 사용한 장비 레벨, 스킬 1·2 조합과 Gold Force 여부를 "
                        + "함께 적어 주세요. 보상 표현은 테스트용 예시이며 실제 지급을 약속하지 않습니다." + DISCLAIMER;
                    expectedSystem = true;
                    expectedPinned = index < 2;
                    expectedBoard = "event";
                    expectedNickname = "FinalCall 이벤트팀";
                    expectedLogin = null;
                    expectedViews = 90 + index * 211;
                }
                if (!expectedTitle.equals(rows.getString("title")) || !expectedContent.equals(rows.getString("content"))
                    || expectedSystem != (rows.getObject("author_id") == null)
                    || expectedPinned != rows.getBoolean("is_pinned") || expectedViews != rows.getInt("view_count")
                    || !expectedBoard.equals(rows.getString("slug"))
                    || !expectedNickname.equals(rows.getString("author_nickname"))
                    || !java.util.Objects.equals(expectedLogin, rows.getString("login_id"))) {
                    failures.add("fixtureText publicNumber=" + number);
                }
            }
        }
    }

    private void verifyCommentFixture(List<String> failures) throws SQLException {
        List<CommentSpec> specs = commentSpecs();
        try (PreparedStatement statement = connection.prepareStatement("SELECT c.content,c.author_nickname,u.login_id,"
            + "p.public_id post_public_id,parent.public_id parent_public_id,c.mentioned_nickname "
            + "FROM comment c JOIN post p ON p.id=c.post_id JOIN user u ON u.id=c.author_id "
            + "LEFT JOIN comment parent ON parent.id=c.parent_comment_id WHERE c.public_id LIKE 'BSC01%' "
            + "ORDER BY c.public_id"); ResultSet rows = statement.executeQuery()) {
            int index = 0;
            while (rows.next()) {
                CommentSpec spec = specs.get(index++);
                String expectedParent = spec.parentNumber() == null ? null : key(COMMENT_PREFIX, spec.parentNumber());
                String expectedMention = spec.parentNumber() == null ? null
                    : nicknames[specs.get(spec.parentNumber() - 1).user()];
                if (!spec.content().equals(rows.getString("content"))
                    || !nicknames[spec.user()].equals(rows.getString("author_nickname"))
                    || !String.format("test%02d", spec.user()).equals(rows.getString("login_id"))
                    || !key(POST_PREFIX, spec.postNumber()).equals(rows.getString("post_public_id"))
                    || !java.util.Objects.equals(expectedParent, rows.getString("parent_public_id"))
                    || !java.util.Objects.equals(expectedMention, rows.getString("mentioned_nickname"))) {
                    failures.add("commentFixture publicNumber=" + spec.number());
                }
            }
        }
    }

    private void verifyReactionFixture(List<String> failures) throws SQLException {
        Set<String> actual = new HashSet<>();
        try (PreparedStatement statement = connection.prepareStatement("SELECT c.public_id,u.login_id,r.reaction_type "
            + "FROM comment_reaction r JOIN comment c ON c.id=r.comment_id JOIN user u ON u.id=r.user_id "
            + "WHERE c.public_id LIKE 'BSC01%'"); ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                actual.add(rows.getString(1) + ":" + rows.getString(2) + ":" + rows.getString(3));
            }
        }
        Set<String> expected = new HashSet<>();
        for (ReactionSpec spec : reactionSpecs()) {
            expected.add(key(COMMENT_PREFIX, spec.commentNumber()) + ":" + String.format("test%02d", spec.user())
                + ":" + spec.type());
        }
        if (!actual.equals(expected)) {
            failures.add("reactionFixture");
        }
    }

    private List<CommentSpec> commentSpecs() {
        List<CommentSpec> specs = new ArrayList<>();
        int number = 0;
        int replyNumber = 0;
        for (int postNumber = 13; postNumber <= 60; postNumber++) {
            int[] roots = new int[3];
            for (int root = 0; root < 3; root++) {
                int user = (postNumber * 3 + root) % 20 + 1;
                number++;
                roots[root] = number;
                String content = "게시글 " + String.format("%02d", postNumber) + "의 " + (root + 1)
                    + "번째 의견입니다. 레벨 " + (3 + (postNumber + root) % 7) + " 장비와 스킬 "
                    + (root % 2 == 0 ? "1슬롯" : "2슬롯") + " 조건으로 비교해 보겠습니다.";
                specs.add(new CommentSpec(number, postNumber, user, null, root, content));
            }
            int replyCount = postNumber <= 36 ? 2 : postNumber >= 49 ? 1 : 0;
            for (int reply = 0; reply < replyCount; reply++) {
                int user = replyNumber % 20 + 1;
                replyNumber++;
                number++;
                String content = "의견을 참고해 Gold Force " + (reply % 2 == 0 ? "적용" : "미적용")
                    + " 장비로 다시 시험하고 결과를 덧붙이겠습니다.";
                specs.add(new CommentSpec(number, postNumber, user, roots[reply % 3], reply, content));
            }
        }
        return specs;
    }

    private List<ReactionSpec> reactionSpecs() {
        List<CommentSpec> specs = commentSpecs();
        List<ReactionSpec> reactions = new ArrayList<>();
        for (int i = 1; i <= 312; i++) {
            int commentNumber = (i - 1) % 204 + 1;
            int cycle = (i - 1) / 204;
            int author = specs.get(commentNumber - 1).user();
            int user = (i - 1) % 20 + 1;
            while (user == author) {
                user = user % 20 + 1;
            }
            if (cycle == 1) {
                user = (user + 9) % 20 + 1;
                while (user == author) {
                    user = user % 20 + 1;
                }
            }
            reactions.add(new ReactionSpec(commentNumber, user, i <= 260 ? "LIKE" : "DISLIKE"));
        }
        return reactions;
    }

    private String communityKind(int index) {
        if (index < 12) {
            return "질문";
        }
        if (index < 21) {
            return "공략";
        }
        if (index < 27) {
            return "모집";
        }
        if (index < 33) {
            return "후기";
        }
        return "거래·시세";
    }

    private int expectedKindCount(String kind) {
        return switch (kind) {
            case "질문" -> 12;
            case "공략" -> 9;
            case "모집", "후기" -> 6;
            case "거래·시세" -> 3;
            default -> throw new IllegalArgumentException("지원하지 않는 커뮤니티 유형입니다.");
        };
    }

    private String communityContent(int index) {
        String topic = COMMUNITY_TOPICS[index % COMMUNITY_TOPICS.length];
        String condition = "레벨 " + (3 + index % 7) + ", " + (index % 3 == 0 ? "스킬 없음" : index % 3 == 1
            ? "스킬 1슬롯" : "스킬 2슬롯") + ", Gold Force " + (index % 2 == 0 ? "적용" : "미적용");
        String ending = switch (communityKind(index)) {
            case "질문" -> "비슷한 조건에서 먼저 바꿔야 할 옵션이 무엇인지 의견을 부탁드립니다.";
            case "공략" -> "세 번씩 반복한 결과라 초보자는 같은 순서로 하나씩 확인해도 좋습니다.";
            case "모집" -> "평일 저녁에 같은 조건을 맞춰 기록할 두 분을 모집합니다.";
            case "후기" -> "고가 장비보다 역할 합의가 결과에 더 크게 작용한 점이 인상적이었습니다.";
            case "거래·시세" -> "최근 매물 세 건의 가격을 비교했으며 급한 추격 입찰은 피하려 합니다.";
            default -> throw new IllegalStateException("지원하지 않는 커뮤니티 유형입니다.");
        };
        return topic + "에서 " + condition + " 조건을 사용했습니다. "
            + TOPIC_DETAILS[index % TOPIC_DETAILS.length] + " " + ending;
    }

    private Instant communityCreated(int index) {
        if (index < 8) {
            return now.minus(2L + index * 3L, ChronoUnit.HOURS);
        }
        if (index < 18) {
            return now.minus(1L + (index - 8L) / 2L, ChronoUnit.DAYS).minus(index, ChronoUnit.MINUTES);
        }
        return now.minus(8L + index - 18L, ChronoUnit.DAYS);
    }

    private Instant commentCreated(int number) {
        return commentTimes[number];
    }

    private String boardPostCountSql(String slug) {
        return "SELECT COUNT(*) FROM post p JOIN board b ON b.id=p.board_id WHERE p.public_id LIKE 'BSP01%' "
            + "AND b.slug='" + slug + "'";
    }

    private String reactionCountSql(String type) {
        return "SELECT COUNT(*) FROM comment_reaction r JOIN comment c ON c.id=r.comment_id "
            + "WHERE c.public_id LIKE 'BSC01%' AND r.reaction_type='" + type + "'";
    }

    private void expectExact(String label, long expected, String sql) throws SQLException {
        long actual = count(sql);
        if (actual != expected) {
            throw new IllegalStateException(label + " 정본이 필요합니다. expected=" + expected + ", actual=" + actual);
        }
    }

    private void expect(List<String> failures, String label, long expected, String sql, Object... values)
        throws SQLException {
        long actual;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) {
                statement.setObject(i + 1, values[i]);
            }
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
                actual = rows.getLong(1);
            }
        }
        if (actual != expected) {
            failures.add(label + " expected=" + expected + " actual=" + actual);
        }
    }

    private long count(String sql) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql);
            ResultSet rows = statement.executeQuery()) {
            rows.next();
            return rows.getLong(1);
        }
    }

    private void execute(String sql, Object... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) {
                statement.setObject(i + 1, values[i]);
            }
            statement.executeUpdate();
        }
    }

    private long lastId() throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT LAST_INSERT_ID()");
            ResultSet rows = statement.executeQuery()) {
            rows.next();
            return rows.getLong(1);
        }
    }

    private Instant databaseNow() throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT NOW(6)");
            ResultSet rows = statement.executeQuery()) {
            rows.next();
            return rows.getTimestamp(1).toInstant();
        }
    }

    private String key(String prefix, int number) {
        return prefix + String.format("%021d", number);
    }

    private Timestamp ts(Instant value) {
        return Timestamp.from(value);
    }

    enum State {
        EMPTY,
        PARTIAL,
        COMPLETE
    }

    private record CommentSpec(int number, int postNumber, int user, Integer parentNumber, int rootIndex,
        String content) {
    }

    private record ReactionSpec(int commentNumber, int user, String type) {
    }
}
