package com.finalcall.domain.shop.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ShopErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.service.InventoryService;
import com.finalcall.domain.search.dto.ListingSearchResult;
import com.finalcall.domain.search.entity.ListingSearchCondition;
import com.finalcall.domain.search.entity.ListingType;
import com.finalcall.domain.search.service.ListingSearchService;
import com.finalcall.domain.settlement.service.FeeCalculator;
import com.finalcall.domain.shop.config.ShopListingProperties;
import com.finalcall.domain.shop.dto.MyShopListing;
import com.finalcall.domain.shop.dto.MyShopSlice;
import com.finalcall.domain.shop.dto.ShopRegisterCommand;
import com.finalcall.domain.shop.dto.ShopRegisterResult;
import com.finalcall.domain.shop.dto.ShopSlice;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopCursor;
import com.finalcall.domain.shop.entity.ShopSearchCondition;
import com.finalcall.domain.shop.entity.ShopSort;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.domain.shop.repository.ShopRepository;

import lombok.RequiredArgsConstructor;

/**
 * 고정가 서비스(shop, EPIC-SHOP) — 등록·목록·상세·판매자 취소. 구매는 money·concurrency 최고위험이라
 * {@link ShopPurchaseService} 로 분리한다.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)}, 쓰기(register·cancel)만 오버라이드(CLAUDE.md §5). 주체는
 * SecurityContext 기준이다(B-009, IDOR 방지 — X-User-Id 불신). 비즈니스 검증은 {@link Preconditions}.
 *
 * <p><b>동시성(concurrency-review):</b> 출품(INVENTORY→LISTED)·취소(→CANCELLED)는 모두 조건부 CAS 단일 승자다
 * (domain-spec §8 "정합성은 DB"). 앱락 없이 DB 가 승자를 보증하므로 영향행 0 을 원인별 에러로 매핑한다. 에스크로
 * 전이(item location)는 취소 CAS 성공 후 동일 TX 에서 수행돼 실패 시 함께 롤백된다. 경매(auction)와 같은 item
 * CAS({@code markListedIfInInventory})를 공유하므로 한 아이템을 경매·고정가에 동시 출품할 수 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ShopService {

    /** 스펙 스냅샷 최대 길이(item_spec_snapshot VARCHAR(255), erd §4.2). AuctionService 선례 동형. */
    private static final int SPEC_SNAPSHOT_MAX_LENGTH = 255;

    private final ShopRepository shopRepository;
    private final ItemInstanceRepository itemInstanceRepository;
    private final InventoryService inventoryService;
    private final ShopListingProperties listingProperties;
    private final FeeCalculator feeCalculator;
    /** 자유문 검색(EPIC-SEARCH) — {@code q} 매칭·랭킹·커서는 ES 가, 표시 데이터 하이드레이션은 MySQL(정본)이 담당. */
    private final ListingSearchService listingSearchService;

    /**
     * 고정가를 등록한다(계약 §3.2 POST /shops, 단일 TX). 소유 검증 후 기한을 서버 설정 일수로 자동 계산하고, item 을
     * INVENTORY→LISTED 로 조건부 CAS 이동(중복 출품 차단)한 뒤 shop 을 스냅샷과 함께 INSERT 한다. CAS 실패 시
     * shop INSERT 도 롤백된다.
     *
     * <p>가격 양수 검증은 요청 계층 {@code @Positive}(→ 400)가 담당한다(shop-spec §3). 미존재·미소유·미보유(TEMP)는
     * <b>SHOP_001 403 단일</b>로 통일하고(SEC-007 열거 방지), 상태 충돌인 "이미 출품중"만 SHOP_002 409 로 분리한다.
     *
     * @return 등록된 고정가의 public_id·상태(ACTIVE)·자동 계산 기한
     */
    @Transactional
    @ServiceLog
    public ShopRegisterResult register(ShopRegisterCommand command) {
        Long sellerId = currentUserId();
        Instant now = Instant.now();

        // 미존재·미소유는 403(SHOP_001)로 통일한다(SEC-007). owner 는 detail 쿼리가 fetch join 한다.
        ItemInstance item = itemInstanceRepository.findDetailByPublicId(command.itemInstancePublicId())
            .orElseThrow(() -> new BusinessException(ShopErrorCode.SHOP_ITEM_NOT_SELLABLE));
        Preconditions.validate(item.isOwnedBy(sellerId), ShopErrorCode.SHOP_ITEM_NOT_SELLABLE);

        // 기한 자동 계산(shop-spec §3.1) — 판매자는 고르지 않는다. end_at = now + 설정 일수(하드코딩 금지).
        Instant endAt = now.plus(listingProperties.defaultDurationDays(), ChronoUnit.DAYS);

        // CAS 전 초기 위치를 포착해 실패(0행) 원인을 분기한다(RR 스냅숏 staleness 회피, auction 선례).
        ItemLocation initialLocation = item.getLocation();
        int affected = itemInstanceRepository.markListedIfInInventory(item.getId());
        if (affected == 0) {
            // TEMP=미보유(인벤토리에 없음)→403. 그 외(LISTED·동시 선점 패자)=이미 출품중→409.
            if (initialLocation == ItemLocation.TEMP) {
                throw new BusinessException(ShopErrorCode.SHOP_ITEM_NOT_SELLABLE);
            }
            throw new BusinessException(ShopErrorCode.SHOP_ALREADY_LISTED);
        }

        Shop shop = shopRepository.save(Shop.builder()
            .seller(item.getOwner()) // owner == seller(검증 완료), fetch join 으로 초기화됨
            .itemInstance(item)
            .price(command.price())
            .status(ShopStatus.ACTIVE)
            .endAt(endAt)
            .itemNameSnapshot(item.getTemplate().getDisplayName())
            .itemSpecSnapshot(buildSpecSnapshot(item))
            .build());
        return new ShopRegisterResult(shop.getPublicId(), ShopStatus.ACTIVE, endAt);
    }

    /** 고정가 목록(계약 §3.2 GET /shops) — 공통 필터 + keyset cursor. status 미지정이면 판매 중(ACTIVE) 기본 노출. */
    @ServiceLog
    public ShopSlice getList(ShopSearchCondition condition, String cursor, int size) {
        ShopCursor decoded = ShopCursor.decode(cursor);
        List<Shop> fetched = shopRepository.findByCursor(condition, decoded, size);

        boolean hasNext = fetched.size() > size;
        List<Shop> content = hasNext ? fetched.subList(0, size) : fetched;
        String nextCursor = content.isEmpty() ? null : encodeNext(content, condition.sort());
        return new ShopSlice(content, nextCursor, hasNext);
    }

    /**
     * 자유문 검색 목록(계약 C1~C3, EPIC-SEARCH). {@code q} 로 ES({@code listings} alias)를 질의해 관련도 순 public_id 를
     * 얻고, 표시 데이터는 MySQL(정본)에서 하이드레이션해 공개 목록({@code GET /shops})과 동일한 응답 형태를 만든다
     * (§12.8). 코드축 필터는 {@code q} 와 AND 결합, 정렬은 relevance 고정이다. 고정가는 스킬·골드포스 필터가 없다
     * (공통 필터 중 shop 노출분만 — ShopSearchCondition 정합). ES 순서를 보존하도록 public_id 기준 재배열하고,
     * ES 가 스테일해 DB 에 없는 public_id 는 제외한다(유령 행 방지).
     */
    @ServiceLog
    public ShopSlice search(ShopSearchCondition condition, String query, String cursor, int size) {
        ListingSearchCondition searchCondition = new ListingSearchCondition(
            ListingType.SHOP, query,
            condition.mainCategory(), condition.subGroup(), condition.element(), condition.kind(),
            condition.minLevel(), condition.maxLevel(), null, null, null,
            condition.minPrice(), condition.maxPrice(), shopStatuses(condition.status()));
        ListingSearchResult result = listingSearchService.search(searchCondition, cursor, size);

        Map<String, Shop> byPublicId = shopRepository.findByPublicIds(result.publicIds()).stream()
            .collect(Collectors.toMap(Shop::getPublicId, Function.identity(), (a, b) -> a));
        List<Shop> ordered = result.publicIds().stream()
            .map(byPublicId::get)
            .filter(Objects::nonNull)
            .toList();
        return new ShopSlice(ordered, result.nextCursor(), result.hasNext());
    }

    /** 검색 노출 상태 화이트리스트 — 공개 목록과 동일 규약(null=판매 중 ACTIVE, 지정=해당 상태만). */
    private List<String> shopStatuses(ShopStatus status) {
        if (status == null) {
            return List.of(ShopStatus.ACTIVE.name());
        }
        return List.of(status.name());
    }

    /**
     * 내 판매 목록(계약 §3.2 GET /me/shops) — 판매자 <b>본인 스코프</b> keyset cursor. 판매자는 컨트롤러가 아니라
     * 여기서 SecurityContext 주체로 도출한다(B-009, IDOR 원천 차단 — 요청에 seller 파라미터 없음). 각 리스팅에
     * 판매자 전용 예상 정산({@code estimatedFee}·{@code estimatedSettle})을 결합한다.
     *
     * <p><b>status 규약:</b> {@code null} = ALL(무필터). 기본값(ACTIVE) 해석은 컨트롤러가 이미 마쳤으므로 여기 도달한
     * null 은 전 상태 조회 의도다(계약 §3.2 ALL 센티널). <b>예상 정산은 추정치다</b>(shop-spec §10.3): ACTIVE 는
     * sale_order 부재라 현재 정책 {@code FeeCalculator} 로 파생하며 SOLD 시점 실현값과 드리프트할 수 있다(S-B).
     * 공개 {@code GET /shops} 의 {@code ShopSummary} 는 이 값을 절대 받지 않는다(별도 DTO 격리).
     *
     * @param status    상태 필터(null=ALL 무필터, 지정=해당 영속 상태만)
     * @param sort      정렬 필드(화이트리스트)
     * @param ascending 오름차순 여부(false=내림차순, 기본 createdAt desc)
     */
    @ServiceLog
    public MyShopSlice getMyShops(ShopStatus status, ShopSort sort, boolean ascending, String cursor, int size) {
        Long sellerId = currentUserId();
        ShopCursor decoded = ShopCursor.decode(cursor);
        List<Shop> fetched = shopRepository.findBySellerCursor(sellerId, status, sort, ascending, decoded, size);

        boolean hasNext = fetched.size() > size;
        List<Shop> content = hasNext ? fetched.subList(0, size) : fetched;
        String nextCursor = content.isEmpty() ? null : encodeNext(content, sort);
        List<MyShopListing> listings = content.stream().map(this::toListing).toList();
        return new MyShopSlice(listings, nextCursor, hasNext);
    }

    /** 리스팅에 예상 정산을 결합한다. {@code estimatedFee = FeeCalculator.compute(price)}, settle = price − fee. */
    private MyShopListing toListing(Shop shop) {
        long estimatedFee = feeCalculator.compute(shop.getPrice());
        return new MyShopListing(shop, estimatedFee, shop.getPrice() - estimatedFee);
    }

    /** 고정가 상세(계약 §3.2 GET /shops/{id}). itemInstance·template·skill·seller 를 fetch join 한다. 없으면 SHOP_003. */
    @ServiceLog
    public Shop getDetail(String publicId) {
        return shopRepository.findDetailByPublicId(publicId)
            .orElseThrow(() -> new BusinessException(ShopErrorCode.SHOP_NOT_FOUND));
    }

    /**
     * 판매자 취소(계약 §3.2 POST /shops/{id}/cancel, 단일 TX). 주체=판매자 검증 후 ACTIVE 조건부 CAS 로 CANCELLED
     * 전이하고, 성공 시 출품 아이템 에스크로를 해제한다(LISTED→INVENTORY/만실 TEMP). 취소 조건은 "아직 판매되지
     * 않음(ACTIVE)"뿐이다 — 고정가는 입찰 개념이 없어 경매의 "입찰 0건" 조건이 없다(shop-spec §4.3).
     *
     * @return 취소 결과 상태(CANCELLED)
     */
    @Transactional
    @ServiceLog
    public ShopStatus cancel(String publicId) {
        Long sellerId = currentUserId();
        Shop shop = shopRepository.findByPublicId(publicId)
            .orElseThrow(() -> new BusinessException(ShopErrorCode.SHOP_NOT_FOUND));
        // 타인 취소 차단(IDOR): 주체 ≠ 판매자면 403(미소유 통일 SEC-007). seller 는 lazy 지만 활성 TX 라 로딩된다.
        Preconditions.validate(
            shop.getSeller().getId().equals(sellerId), ShopErrorCode.SHOP_ITEM_NOT_SELLABLE);

        // ACTIVE→CANCELLED 조건부 CAS. 0행 = 이미 SOLD·EXPIRED·CANCELLED → 409(SHOP_004). 시간 조건 없음(§4.3).
        int affected = shopRepository.markShopCancelledIfActive(shop.getId());
        if (affected == 0) {
            throw new BusinessException(ShopErrorCode.SHOP_ALREADY_SOLD_OR_CLOSED);
        }

        // 에스크로 해제(별도 빈 경유 → 동일 TX 참여, self-invocation 아님). 실패 시 취소 CAS 까지 롤백.
        inventoryService.releaseFromListing(shop.getItemInstance());
        return ShopStatus.CANCELLED;
    }

    /**
     * 등록 시점 핵심 스펙 요약 스냅샷(D-045). live 값(현재 소유자 등)은 넣지 않고 인스턴스 스펙만 고정한다
     * (AuctionService.buildSpecSnapshot 선례 동형). 255자 이내로 방어적 절단한다.
     */
    private String buildSpecSnapshot(ItemInstance item) {
        String skill1 = item.getSkill1() == null ? "-" : String.valueOf(item.getSkill1().getSkillCode());
        String skill2 = item.getSkill2() == null ? "-" : String.valueOf(item.getSkill2().getSkillCode());
        String goldforce = item.getGfExpireAt() == null ? "-" : item.getGfExpireAt().toString();
        String snapshot = "Lv." + item.getLevel()
            + " / skill1=" + skill1 + "/skill2=" + skill2
            + " / " + item.getSkillPercent() + "%"
            + " / GF=" + goldforce;
        return snapshot.length() > SPEC_SNAPSHOT_MAX_LENGTH
            ? snapshot.substring(0, SPEC_SNAPSHOT_MAX_LENGTH) : snapshot;
    }

    /** 다음 페이지 커서를 정렬 필드 값 + id 로 인코딩한다. 이 에픽 정렬 필드는 전부 NOT NULL 이라 값이 항상 존재한다. */
    private String encodeNext(List<Shop> content, ShopSort sort) {
        Shop last = content.get(content.size() - 1);
        String sortValue = switch (sort) {
            case PRICE -> String.valueOf(last.getPrice());
            case END_AT -> last.getEndAt().toString();
            case CREATED_AT -> last.getCreatedAt().toString();
        };
        return ShopCursor.encode(sortValue, last.getId());
    }

    /** 인증 주체(내부 PK). 인증 필요 엔드포인트라 SecurityConfig 가 인증을 강제한다(B-009, IDOR 차단). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
