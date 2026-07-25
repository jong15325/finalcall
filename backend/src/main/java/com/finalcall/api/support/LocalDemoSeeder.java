package com.finalcall.api.support;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.finalcall.api.support.LocalDemoDataService.ListedSeed;
import com.finalcall.domain.auction.AuctionRegisterCommand;
import com.finalcall.domain.auction.AuctionRegisterResult;
import com.finalcall.domain.auction.AuctionService;
import com.finalcall.domain.auth.AuthService;
import com.finalcall.domain.bid.BidPlaceCommand;
import com.finalcall.domain.bid.BidService;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 로컬 데모 시드 러너(FC-084) — 완성된 화면(EPIC-FE-REBUILD)과 마감·정산(EPIC-CLOSING)을 실제로 돌려보게 하는
 * <b>개발/검증용 유틸</b>이다(운영 코드 아님).
 *
 * <h2>안전장치</h2>
 * <ul>
 *   <li><b>local 전용</b>: {@code @Profile("local")} + {@code demo.seed.enabled}(기본 on). 통합 테스트는 이 플래그를
 *       off 로 내려 시드가 테스트 데이터에 개입하지 못하게 한다(운영 DB 유입도 프로파일 게이트로 원천 차단).</li>
 *   <li><b>동적 타임스탬프</b>: 경매 시각을 부팅 시각(now) 기준 오프셋으로 계산한다 — V13 정적 SQL 시드가 시간이
 *       지나면 전건 "마감"으로 죽는 함정을 원천 회피하고, 곧-마감 경매가 실제로 카운트다운·정산된다.</li>
 *   <li><b>멱등</b>: 마커(demo1 계정)가 있으면 재삽입하지 않는다(재부팅 안전).</li>
 * </ul>
 *
 * <h2>도메인 경유 삽입</h2>
 * 회원은 {@link AuthService#signup}(BCrypt·잔액 1:1), 경매는 {@link AuctionService#register}(INVENTORY→LISTED CAS·
 * 스냅샷), 입찰은 {@link BidService#place}(홀드·직전홀드 해제·최고가 파생·소프트클로즈)로 넣는다 — 불변식(홀드=입찰
 * 정합, 잔액≥홀드, 최고가 파생)을 운영 코드가 스스로 보증한다. 주체는 SecurityContext 라 각 호출 전 주체를 세팅한다.
 *
 * <p>V13 데모 경매는 별도로 정리하지 않는다 — 마감 워커(local {@code enabled=true})가 부팅 직후 마감 시각이 지난
 * V13 ACTIVE 경매를 정상 종료 상태로 정산해, 진행 목록(SCHEDULED·ACTIVE 만 노출)에서 자연히 빠진다.
 */
@Slf4j
@Component
@Profile("local")
@ConditionalOnProperty(name = "demo.seed.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class LocalDemoSeeder implements ApplicationRunner {

    /** 데모 계정 공통 비밀번호(로컬 전용). 로그인 안내에 노출한다. */
    private static final String PASSWORD = "demo1234!";
    /** 멱등 마커 계정 — 존재하면 이미 시드된 것으로 보고 건너뛴다. */
    private static final String MARKER_LOGIN_ID = "demo1";
    private static final long SOFT_CLOSE_BUFFER_SEC = 600L;
    /** 대량 마켓 시드의 결정성 난수 시드(재부팅 시 동일 분포 재현). */
    private static final long MARKET_RANDOM_SEED = 980_425L;
    /** 대량 마켓 시드 판매자 핸들(다수 판매자 분산 — sellerNickname·마스킹 다양성). */
    private static final List<String> MARKET_SELLERS = List.of("demo1", "demo2", "demo3", "demo4", "demo5", "demo6",
        "demo7", "demo8", "demo9", "demo10");

    private final UserRepository userRepository;
    private final AuthService authService;
    private final AuctionService auctionService;
    private final BidService bidService;
    private final LocalDemoDataService data;
    private final ItemTemplateRepository itemTemplateRepository;

    /** 대량 마켓 리스팅 건수(기본 5000, 테스트는 소량으로 내려 부팅을 빠르게 한다). */
    @Value("${demo.seed.market-count:5000}")
    private int marketCount;

    /** handle(demo1..demo10) → 내부 PK. */
    private final Map<String, Long> userIds = new HashMap<>();
    /** 소유자별 다음 인벤토리 슬롯 커서(slot_key UK 충돌 회피). */
    private final Map<String, Integer> slotCursor = new HashMap<>();

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.existsByLoginIdAndIsDeletedFalse(MARKER_LOGIN_ID)) {
            log.info("[LocalDemoSeeder] 이미 시드됨(demo1 존재) — 건너뜀");
            return;
        }
        log.info("[LocalDemoSeeder] 로컬 데모 데이터 주입 시작");
        try {
            seedMembers();
            seedInventoryAndTemp();
            seedAuctions();
            int listed = seedMarket();
            log.info("[LocalDemoSeeder] 완료 — 회원 {}명, 고정가 마켓 {}건, 곧-마감 경매는 마감 워커가 실시간 정산",
                userIds.size(), listed);
        } catch (RuntimeException ex) {
            log.error("[LocalDemoSeeder] 시드 실패(부분 주입 가능) — 스키마·데이터 확인 필요", ex);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ---------------- 1) 회원 + 잔액 ----------------

    private void seedMembers() {
        List<Member> members = List.of(
            new Member("demo1", "파랑기사", 1_500_000, 8_000_000),
            new Member("demo2", "홍염상단", 800_000, 6_000_000),
            new Member("demo3", "표류대장장이", 3_000_000, 12_000_000),
            new Member("demo4", "그림자수집가", 500_000, 5_000_000),
            new Member("demo5", "은빛궁수", 2_000_000, 9_000_000),
            new Member("demo6", "초록마도사", 600_000, 4_000_000),
            new Member("demo7", "무명검객", 1_200_000, 7_000_000),
            new Member("demo8", "바람상인", 300_000, 3_000_000),
            new Member("demo9", "폭풍기사", 2_500_000, 10_000_000),
            new Member("demo10", "마지막입찰자", 900_000, 5_500_000));
        for (Member member : members) {
            User user = authService.signup(member.handle(), PASSWORD, member.nickname());
            userIds.put(member.handle(), user.getId());
            data.fund(user.getId(), member.cash(), member.gameMoney());
        }
    }

    // ---------------- 2) 여분 인벤토리 + 임시보관 ----------------

    private void seedInventoryAndTemp() {
        // 인벤토리 여분(골드포스 활성/비활성 섞어 프레임 확인). 경매에 올리지 않고 마이/인벤에서 보이게 둔다.
        inventory("demo1", 1111, 3, 100, null, 15, false);
        inventory("demo1", 1223, 6, 110, 130, 40, true);
        inventory("demo3", 1341, 9, 120, 140, 55, true);
        inventory("demo5", 1133, 2, null, null, 0, false);
        inventory("demo7", 1214, 4, 140, null, 20, true);
        inventory("demo9", 1322, 8, 100, 130, 48, false);
        inventory("demo10", 1132, 5, 110, null, 22, false);

        // 임시보관(relocate 데모). 만료 임박 1건 포함.
        Instant now = Instant.now();
        data.createTempItem(userIds.get("demo1"), 1114, 5, 120, null, 25, null, now.plus(2, ChronoUnit.HOURS));
        data.createTempItem(userIds.get("demo1"), 1231, 7, 130, null, 30, null, null);
        data.createTempItem(userIds.get("demo5"), 1124, 6, 100, 140, 35, gf(now), now.plus(3, ChronoUnit.DAYS));
    }

    // ---------------- 3) 경매 + 입찰 ----------------

    private void seedAuctions() {
        long hour = 3600L;
        long day = 86_400L;

        // (A) ACTIVE·여유·입찰 있음 — 입찰 이력/현재가/최고입찰자 마스킹·홀드 정합 확인.
        auction("demo1", 1113, 9, 100, 110, 35, true, 150_000, null, 0, 2 * day,
            bid("demo4", 150_000), bid("demo5", 160_000), bid("demo4", 175_000));
        auction("demo2", 1223, 7, 110, 130, 45, false, 60_000, 400_000L, 0, day,
            bid("demo5", 60_000), bid("demo6", 66_000), bid("demo7", 73_000),
            bid("demo5", 82_000), bid("demo6", 95_000));
        auction("demo3", 1341, 5, 120, null, 22, false, 20_000, 120_000L, 0, 3 * day,
            bid("demo8", 20_000), bid("demo9", 25_000));
        auction("demo1", 1144, 5, null, null, 0, true, 8_000, null, 0, 12 * hour,
            bid("demo10", 8_000));
        auction("demo5", 1131, 3, 110, null, 20, false, 45_000, 400_000L, 0, 8 * hour,
            bid("demo1", 45_000), bid("demo2", 52_000), bid("demo1", 61_000), bid("demo3", 70_000));

        // (B) ACTIVE·여유·입찰 0 — 시작가·"입찰 없음" 표기 + 가격/속성/카테고리 다양(필터·정렬).
        auction("demo2", 1212, 4, null, null, 0, false, 35_000, 300_000L, 0, 18 * hour);
        auction("demo3", 1321, 6, 120, 140, 30, true, 180_000, 1_200_000L, 0, 2 * day);
        auction("demo4", 1234, 2, null, null, 0, false, 12_000, null, 0, 6 * hour);
        auction("demo1", 1114, 8, 120, 140, 47, false, 260_000, null, 0, 30 * hour);
        auction("demo6", 1242, 5, 100, null, 18, false, 95_000, null, 0, 10 * hour);
        auction("demo7", 1133, 1, null, null, 0, false, 15_000, 150_000L, 0, 20 * hour);

        // (C) 곧-마감·입찰 있음 → 마감 워커가 SOLD 로 실시간 정산(관전).
        auction("demo1", 1122, 7, 130, 140, 40, true, 30_000, null, 0, 90,
            bid("demo5", 30_000), bid("demo6", 34_000));
        auction("demo2", 1231, 6, null, null, 0, false, 70_000, 800_000L, 0, 120,
            bid("demo7", 70_000), bid("demo8", 78_000), bid("demo7", 88_000));
        auction("demo3", 1124, 7, null, null, 0, true, 120_000, null, 0, 180,
            bid("demo9", 120_000));

        // (D) 곧-마감·입찰 0 → 마감 워커가 UNSOLD 로 실시간 정산(관전).
        auction("demo1", 1111, 1, null, null, 0, false, 240_000, null, 0, 75);
        auction("demo4", 1244, 7, null, null, 0, true, 18_000, 90_000L, 0, 150);

        // (E) SCHEDULED — startAt 미래.
        auction("demo2", 1311, 1, null, null, 0, false, 88_000, 500_000L, 2 * hour, 2 * day);
        auction("demo3", 1132, 8, null, null, 0, true, 24_000, null, 6 * hour, 3 * day);
        auction("demo5", 1214, 3, null, null, 0, false, 175_000, 1_000_000L, day, 4 * day);
    }

    /**
     * 아이템을 발행해 경매로 등록하고(판매자 주체), 지정한 입찰 체인을 순서대로 성립시킨다(각 입찰자 주체).
     *
     * @param startOffsetSec 0 이하면 즉시 시작(startAt null → ACTIVE), 양수면 미래 시작(SCHEDULED)
     * @param endOffsetSec   now 기준 마감까지 초. 곧-마감(수십~수백 초)이면 마감 워커가 실시간 종결한다
     */
    private void auction(String sellerHandle, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, boolean goldforce, long startPrice, Long buyNowPrice, long startOffsetSec,
        long endOffsetSec, Bid... bids) {
        Long sellerId = userIds.get(sellerHandle);
        Instant now = Instant.now();
        String itemPublicId = data.createInventoryItem(sellerId, typeCode, level, skill1Code, skill2Code,
            skillPercent, goldforce ? gf(now) : null, nextSlot(sellerHandle));

        Instant startAt = startOffsetSec > 0 ? now.plusSeconds(startOffsetSec) : null;
        Instant endAt = now.plusSeconds(endOffsetSec);
        Instant maxEndAt = endAt.plusSeconds(SOFT_CLOSE_BUFFER_SEC);

        authenticateAs(sellerId);
        AuctionRegisterResult result = auctionService.register(new AuctionRegisterCommand(
            itemPublicId, startPrice, buyNowPrice, startAt, endAt, null, null, maxEndAt));

        for (Bid bid : bids) {
            authenticateAs(userIds.get(bid.handle()));
            bidService.place(new BidPlaceCommand(result.auctionPublicId(), bid.amount()));
        }
    }

    // ---------------- 4) 대량 고정가 마켓(FC-098) ----------------

    /**
     * 고정가 마켓을 실데이터 규모(기본 5000건)로 채운다(skill-exposure-spec §3). LISTED-direct + shop 직접 INSERT
     * 배치로 발행하며(정식 register 회피), item_template 40종 × skill_definition 244 다양성·다수 판매자 분산·넓은
     * 가격 분포·동적 end_at 으로 정렬·필터·무한스크롤이 실감나게 한다. 결정성 난수라 재부팅 시 동일 분포를
     * 재현하고, idempotency 는 demo1 마커(run 진입 가드)가 보증한다.
     *
     * @return 발행된 리스팅 수
     */
    private int seedMarket() {
        if (marketCount <= 0) {
            return 0;
        }
        List<ItemTemplate> templates = itemTemplateRepository.findAll();
        if (templates.isEmpty()) {
            log.warn("[LocalDemoSeeder] 템플릿이 비어 마켓 시드를 건너뜀");
            return 0;
        }
        Random rnd = new Random(MARKET_RANDOM_SEED);
        List<ListedSeed> seeds = new ArrayList<>(marketCount);
        Instant now = Instant.now();
        for (int i = 0; i < marketCount; i++) {
            ItemTemplate template = templates.get(rnd.nextInt(templates.size()));
            boolean magic = template.getSubGroup() == 3; // 마법: 스킬1 구조적 부재(§6)
            int level = 1 + rnd.nextInt(9); // 1~9

            Integer skill1 = magic ? null : maybeSkill1(rnd);
            Integer skill2 = maybeSkill2(rnd);
            int skillPercent = (skill1 == null && skill2 == null) ? 0 : 1 + rnd.nextInt(levelMaxPercent(level));
            Instant gfExpireAt = rnd.nextInt(10) < 3 // ~30% 골드포스 활성
                ? now.plus(5 + rnd.nextInt(86), ChronoUnit.DAYS)
                : null;
            long price = randomPrice(rnd);
            Instant endAt = now.plusSeconds((1 + rnd.nextInt(30)) * 86_400L + rnd.nextInt(86_400));
            Long sellerId = userIds.get(MARKET_SELLERS.get(rnd.nextInt(MARKET_SELLERS.size())));

            seeds.add(new ListedSeed(sellerId, template.getTypeCode(), level, skill1, skill2, skillPercent,
                gfExpireAt, price, endAt));
        }
        return data.bulkCreateListedShopItems(seeds, 1);
    }

    /** 스킬1 슬롯(100~197). ~15% 부재(null). */
    private Integer maybeSkill1(Random rnd) {
        return rnd.nextInt(100) < 15 ? null : 100 + rnd.nextInt(98);
    }

    /** 스킬2 슬롯(200~209 + 300~435). ~35% 부재(null). 210~299 는 미시드 코드라 제외한다. */
    private Integer maybeSkill2(Random rnd) {
        if (rnd.nextInt(100) < 35) {
            return null;
        }
        int pick = rnd.nextInt(146); // 10(200~209) + 136(300~435)
        return pick < 10 ? 200 + pick : 300 + (pick - 10);
    }

    /** §2 레벨별 퍼센트 상한(표시 레벨 1~9). 데모라 근사 상한만 쓴다(초과 무해). */
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

    /** 넓은 가격 분포(수만~수억) — 정렬·필터·무한스크롤 체감용. 저가일수록 흔하게 가중한다. */
    private long randomPrice(Random rnd) {
        double roll = rnd.nextDouble();
        if (roll < 0.35) {
            return 10_000L + rnd.nextInt(90_000);
        }
        if (roll < 0.65) {
            return 100_000L + rnd.nextInt(900_000);
        }
        if (roll < 0.85) {
            return 1_000_000L + rnd.nextInt(9_000_000);
        }
        if (roll < 0.97) {
            return 10_000_000L + rnd.nextInt(90_000_000);
        }
        return 100_000_000L + rnd.nextInt(400_000_000);
    }

    // ---------------- 헬퍼 ----------------

    private void inventory(String handle, int typeCode, int level, Integer skill1Code, Integer skill2Code,
        int skillPercent, boolean goldforce) {
        data.createInventoryItem(userIds.get(handle), typeCode, level, skill1Code, skill2Code, skillPercent,
            goldforce ? gf(Instant.now()) : null, nextSlot(handle));
    }

    private Bid bid(String handle, long amount) {
        return new Bid(handle, amount);
    }

    /** 골드포스 활성 만료 시각(now + 30일). */
    private Instant gf(Instant now) {
        return now.plus(30, ChronoUnit.DAYS);
    }

    private int nextSlot(String handle) {
        int slot = slotCursor.getOrDefault(handle, 0);
        slotCursor.put(handle, slot + 1);
        return slot;
    }

    private void authenticateAs(Long userId) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of()));
    }

    private record Member(String handle, String nickname, long cash, long gameMoney) {
    }

    private record Bid(String handle, long amount) {
    }
}
