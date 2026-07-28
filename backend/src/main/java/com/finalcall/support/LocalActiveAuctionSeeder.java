package com.finalcall.support;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.finalcall.domain.auction.dto.AuctionRegisterRequest;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.auction.repository.AuctionRepository;
import com.finalcall.domain.auction.service.AuctionService;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 로컬 데모 — 진행 중(ACTIVE) 경매 대량 시더(FC-144). 기존 {@link LocalDemoSeeder} 가 심은 곧-마감 경매는 시간이 지나면
 * 전부 종결돼 경매장이 비므로, 경매장 화면(GET /api/v1/auctions · ES {@code listings_search})을 채우기 위해 진행 중
 * 경매를 목표치(기본 100건)까지 <b>추가</b>로 올린다(운영 코드 아님, 개발/데모 유틸).
 *
 * <h2>안전장치</h2>
 * <ul>
 *   <li><b>local 전용 + 옵트인</b>: {@code @Profile("local")} + {@code demo.seed.active-auctions.enabled}(기본 off,
 *       {@code matchIfMissing} 없음). 평상시(사용자 IntelliJ 부팅)에는 뜨지 않고, 시딩이 필요한 부팅에서만 env/프로퍼티로
 *       켠다 — 운영 유출도 프로파일 게이트로 원천 차단.</li>
 *   <li><b>멱등(top-up 가드)</b>: 진행 중 경매 수({@code status=ACTIVE·end_at&gt;now})를 세어 목표치 미달분만 추가한다.
 *       재실행해도 이미 100건이면 skip 하므로 중복 폭증이 없다(횟수 기반 카운트).</li>
 *   <li><b>기존 데이터 무손상</b>: 추가 등록만 한다 — 기존 시드 경매·마켓·회원·인벤토리를 건드리지 않는다.</li>
 * </ul>
 *
 * <h2>도메인 경유 삽입 · ES 색인</h2>
 * 아이템은 {@link LocalDemoDataService#createInventoryItem}(소유이력 SEED 포함)로 발행하고, 경매는
 * {@link AuctionService#register}(INVENTORY→LISTED CAS·스냅샷·상태 결정)로 등록한다 — DB row/ES 문서를 손으로 쓰지
 * 않아 검증·정합을 우회하지 않는다. {@code startAt=null} 이라 register 가 ACTIVE 로 확정하고, {@code endAt} 은 1시간~30일로
 * 분산해 시연 중 진행 상태가 유지되게 한다. 색인은 {@link ApplicationReadyEvent} 순서로 보장한다 — 이 시더가
 * {@code HIGHEST_PRECEDENCE} 로 먼저 등록을 끝낸 뒤, 부팅 재색인기({@code ListingBootIndexer},
 * {@code search.reindex-on-startup=true})가 MySQL 전건을 ES {@code listings_search} 로 upsert 해 경매장에 노출된다
 * (CDC 도 근실시간 갱신). 주체는 SecurityContext 라 register 호출 전 판매자 주체를 세팅한다.
 */
@Slf4j
@Component
@Profile("local")
@ConditionalOnProperty(name = "demo.seed.active-auctions.enabled", havingValue = "true")
@RequiredArgsConstructor
public class LocalActiveAuctionSeeder {

    /** 판매자 분산용 데모 계정 핸들(LocalDemoSeeder 가 미리 심는다). round-robin 으로 100건을 고르게 나눈다. */
    private static final List<String> SELLERS = List.of("demo1", "demo2", "demo3", "demo4", "demo5",
        "demo6", "demo7", "demo8", "demo9", "demo10");
    /**
     * 인벤토리 슬롯 시작 번호 — 앱 인벤토리 정원(96칸=slot 0~95, {@code InventoryService.CAPACITY})을 넘는 값이라
     * 기저 시드·유찰 반환이 채우는 실제 슬롯(항상 0~95)과 <b>절대 충돌하지 않는다</b>({@code slot_key} UK 안전).
     * 발행 직후 register 가 LISTED(slot NULL)로 옮겨 이 값은 과도적이며 최종 상태에 남지 않는다.
     */
    private static final int SLOT_BASE = 900;
    /** 소프트클로즈 총연장 버퍼(초) — maxEndAt = endAt + 이 값(LocalDemoSeeder 와 동일 규약). */
    private static final long SOFT_CLOSE_BUFFER_SEC = 600L;
    /** 결정성 난수 시드(재부팅 시 동일 분포 재현). */
    private static final long RANDOM_SEED = 144_144L;
    /** 마법 카드 sub_group(스킬1 구조적 부재, skill-exposure-spec §6). */
    private static final int MAGIC_SUB_GROUP = 3;

    private final UserRepository userRepository;
    private final AuctionService auctionService;
    private final AuctionRepository auctionRepository;
    private final LocalDemoDataService data;
    private final ItemTemplateRepository itemTemplateRepository;

    /** 목표 진행 중 경매 수(기본 100). 현재 진행 중 수를 뺀 미달분만 추가한다. */
    @Value("${demo.seed.active-auctions.target:100}")
    private int targetActive;

    /** 소유자별 다음 인벤토리 슬롯 커서(slot_key UK 충돌 회피). */
    private final Map<String, Integer> slotCursor = new HashMap<>();

    /**
     * 컨텍스트 준비 완료 시(등록이 부팅 재색인보다 먼저 끝나도록 {@code HIGHEST_PRECEDENCE}) 진행 중 경매를 목표치까지
     * 채운다. 판매자 계정이 아직 없으면(기저 시드 미실행) 경고 후 skip 한다 — 다음 부팅이 이어서 채운다.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public void seedActiveAuctions() {
        Map<String, Long> sellerIds = resolveSellerIds();
        if (sellerIds == null) {
            log.warn("[LocalActiveAuctionSeeder] 데모 판매자 계정 미존재 — 기저 시드(LocalDemoSeeder) 선행 필요. skip");
            return;
        }
        long existing = auctionRepository.countByStatusAndEndAtAfter(AuctionStatus.ACTIVE, Instant.now());
        int toCreate = targetActive - (int)existing;
        if (toCreate <= 0) {
            log.info("[LocalActiveAuctionSeeder] 진행 중 경매 {}건(목표 {}) — 추가 불필요, skip", existing, targetActive);
            return;
        }
        List<ItemTemplate> templates = itemTemplateRepository.findAll();
        if (templates.isEmpty()) {
            log.warn("[LocalActiveAuctionSeeder] 템플릿이 비어 시드를 건너뜀");
            return;
        }

        log.info("[LocalActiveAuctionSeeder] 진행 중 경매 {}건 → 목표 {}건, {}건 추가 시작", existing, targetActive, toCreate);
        Random rnd = new Random(RANDOM_SEED);
        int created = 0;
        try {
            for (int i = 0; i < toCreate; i++) {
                String sellerHandle = SELLERS.get(i % SELLERS.size());
                try {
                    registerOne(sellerHandle, sellerIds.get(sellerHandle), templates, rnd);
                    created++;
                } catch (RuntimeException ex) {
                    log.warn("[LocalActiveAuctionSeeder] {}번째 경매 등록 실패 seller={} — 건너뜀",
                        i + 1, sellerHandle, ex);
                }
            }
        } finally {
            SecurityContextHolder.clearContext();
        }
        long total = auctionRepository.countByStatusAndEndAtAfter(AuctionStatus.ACTIVE, Instant.now());
        log.info("[LocalActiveAuctionSeeder] 완료 — {}건 추가, 진행 중 경매 총 {}건", created, total);
    }

    /** 데모 판매자 핸들→내부 PK 해석. 하나라도 없으면 null(기저 시드 미실행). */
    private Map<String, Long> resolveSellerIds() {
        Map<String, Long> ids = new HashMap<>();
        for (String handle : SELLERS) {
            Optional<User> user = userRepository.findByLoginIdAndIsDeletedFalse(handle);
            if (user.isEmpty()) {
                return null;
            }
            ids.put(handle, user.get().getId());
        }
        return ids;
    }

    /**
     * 아이템 1건을 발행해 진행 중(ACTIVE) 경매로 등록한다. 아이템 속성(타입·레벨·스킬·골드포스)·가격·마감시각을 다양화해
     * 필터·정렬·무한스크롤이 실감나게 한다. {@code startAt=null} 이라 register 가 ACTIVE 로 확정한다.
     */
    private void registerOne(String sellerHandle, Long sellerId, List<ItemTemplate> templates, Random rnd) {
        ItemTemplate template = templates.get(rnd.nextInt(templates.size()));
        boolean magic = template.getSubGroup() == MAGIC_SUB_GROUP;
        int level = 1 + rnd.nextInt(9);
        Integer skill1 = magic ? null : maybeSkill1(rnd);
        Integer skill2 = maybeSkill2(rnd);
        int skillPercent = (skill1 == null && skill2 == null) ? 0 : 1 + rnd.nextInt(levelMaxPercent(level));

        Instant now = Instant.now();
        Instant gfExpireAt = rnd.nextInt(10) < 3 // ~30% 골드포스 활성
            ? now.plus(5 + rnd.nextInt(86), ChronoUnit.DAYS)
            : null;
        long startPrice = randomStartPrice(rnd);
        Long buyNowPrice = rnd.nextInt(10) < 5 // ~50% 즉시구매가(항상 시작가보다 큼)
            ? startPrice * (2 + rnd.nextInt(5))
            : null;

        String itemPublicId = data.createInventoryItem(sellerId, template.getTypeCode(), level, skill1, skill2,
            skillPercent, gfExpireAt, nextSlot(sellerHandle));

        Instant endAt = now.plusSeconds(randomEndOffsetSec(rnd));
        Instant maxEndAt = endAt.plusSeconds(SOFT_CLOSE_BUFFER_SEC);
        authenticateAs(sellerId);
        auctionService.register(new AuctionRegisterRequest(
            itemPublicId, startPrice, buyNowPrice, null, endAt, null, null, maxEndAt));
    }

    /** 마감까지 초 — 1시간~30일 분산(다수 다일짜리, 일부 곧-마감). 초 단위가 아니라 최소 1시간이라 시연 중 유지된다. */
    private long randomEndOffsetSec(Random rnd) {
        long hour = 3600L;
        long day = 86_400L;
        double roll = rnd.nextDouble();
        if (roll < 0.20) {
            return (1 + rnd.nextInt(12)) * hour; // 1~12시간
        }
        if (roll < 0.50) {
            return day + rnd.nextInt((int)(2 * day)); // 1~3일
        }
        if (roll < 0.80) {
            return 3 * day + rnd.nextInt((int)(7 * day)); // 3~10일
        }
        return 10 * day + rnd.nextInt((int)(20 * day)); // 10~30일
    }

    /** 시작가 분포(수천~수천만) — 저가일수록 흔하게 가중한다(정렬·필터 체감용). */
    private long randomStartPrice(Random rnd) {
        double roll = rnd.nextDouble();
        if (roll < 0.40) {
            return 5_000L + rnd.nextInt(45_000);
        }
        if (roll < 0.70) {
            return 50_000L + rnd.nextInt(250_000);
        }
        if (roll < 0.90) {
            return 300_000L + rnd.nextInt(1_700_000);
        }
        return 2_000_000L + rnd.nextInt(18_000_000);
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

    /** 레벨별 발동확률 상한(표시 레벨 1~9, skill-exposure-spec §2). 데모라 근사 상한만 쓴다. */
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

    private int nextSlot(String handle) {
        int slot = slotCursor.getOrDefault(handle, SLOT_BASE);
        slotCursor.put(handle, slot + 1);
        return slot;
    }

    private void authenticateAs(Long userId) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of()));
    }
}
