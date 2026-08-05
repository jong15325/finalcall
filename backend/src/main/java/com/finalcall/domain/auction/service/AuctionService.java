package com.finalcall.domain.auction.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.AuctionErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.auction.dto.AuctionDetailResponse;
import com.finalcall.domain.auction.dto.AuctionRegisterRequest;
import com.finalcall.domain.auction.dto.AuctionRegisterResponse;
import com.finalcall.domain.auction.dto.AuctionSummaryResponse;
import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.entity.AuctionCancelState;
import com.finalcall.domain.auction.entity.AuctionCursor;
import com.finalcall.domain.auction.entity.AuctionSearchCondition;
import com.finalcall.domain.auction.entity.AuctionSort;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.auction.entity.AuctionWithBidCount;
import com.finalcall.domain.auction.repository.AuctionRepository;
import com.finalcall.domain.bid.config.BidIncrementProperties;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.repository.ItemDeliveryRepository;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.service.InventoryService;
import com.finalcall.domain.search.dto.ListingSearchHits;
import com.finalcall.domain.search.entity.ListingSearchCondition;
import com.finalcall.domain.search.entity.ListingType;
import com.finalcall.domain.search.service.ListingSearchService;

import lombok.RequiredArgsConstructor;

/**
 * 경매 서비스(auction, EPIC-AUCTION) — 등록·목록·상세·판매자 취소.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)}, 쓰기(register·cancel)만 오버라이드(CLAUDE.md §5).
 * 주체는 SecurityContext 기준이다(B-009, IDOR 방지 — X-User-Id 불신). 비즈니스 검증은 {@link Preconditions}.
 *
 * <p><b>동시성(concurrency-review):</b> 출품(INVENTORY→LISTED)·취소(→CANCELLED)는 모두 조건부 CAS 단일 승자다
 * (domain-spec §8 "정합성은 DB"). 앱락(@DistributedLock) 없이 DB 가 승자를 보증하므로, 영향행 0을 원인별 에러로
 * 매핑한다. 에스크로 전이(item location)는 취소 CAS 성공 후 동일 TX 에서 수행돼 실패 시 함께 롤백된다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuctionService {

    /** 소프트클로즈 기본값(domain-spec §4 "T-30초/+30초"). body 미지정 시 서버가 채운다(게이트2 c·G1). */
    private static final int DEFAULT_SOFT_CLOSE_SEC = 30;
    /** 소프트클로즈 window·extend 각 상한(초). 게이트2 c 예시값. 초과 시 AUCTION_008. */
    private static final int SOFT_CLOSE_MAX_SEC = 300;
    /** 총연장 상한(maxEndAt − endAt) 상한(초, 24시간). 게이트2 c "총연장 상한". 초과 시 AUCTION_008. */
    private static final long MAX_TOTAL_EXTENSION_SEC = 86_400L;
    /** 스펙 스냅샷 최대 길이(item_spec_snapshot VARCHAR(255), spec §2.1). */
    private static final int SPEC_SNAPSHOT_MAX_LENGTH = 255;

    private final AuctionRepository auctionRepository;
    private final ItemInstanceRepository itemInstanceRepository;
    private final ItemDeliveryRepository itemDeliveryRepository;
    private final InventoryService inventoryService;
    /** 최소 증분 정책의 단일 진실원(bid 도메인 소유). 상세 응답 파생값 산출에만 쓴다 — 정책을 복제하지 않는다. */
    private final BidIncrementProperties incrementProperties;
    /** 자유문 검색(EPIC-SEARCH) — {@code q} 매칭·랭킹·커서는 ES 가, 표시 데이터 하이드레이션은 MySQL(정본)이 담당. */
    private final ListingSearchService listingSearchService;

    /**
     * 경매를 등록한다(계약 §3.1 POST /auctions, 단일 TX). 소유·시간·가격 검증 후 item 을 INVENTORY→LISTED 로
     * 조건부 CAS 이동(중복 출품 차단)하고 auction 을 스냅샷과 함께 INSERT 한다. CAS 실패 시 auction INSERT 도 롤백된다.
     *
     * @return 등록된 경매의 public_id·상태·마감시각
     */
    @Transactional
    @ServiceLog
    public AuctionRegisterResponse register(AuctionRegisterRequest request) {
        Long sellerId = currentUserId();
        Instant now = Instant.now();

        // 미존재·미소유는 403(AUCTION_001)로 통일한다(게이트2 f, SEC-007 열거 방지). owner 는 detail 쿼리가 fetch join.
        ItemInstance item = itemInstanceRepository.findDetailByPublicId(request.itemInstancePublicId())
            .orElseThrow(() -> new BusinessException(AuctionErrorCode.AUCTION_ITEM_NOT_SELLABLE));
        Preconditions.validate(item.isOwnedBy(sellerId), AuctionErrorCode.AUCTION_ITEM_NOT_SELLABLE);

        // 재판매 차단(delivery-domain-spec §5.4·§6.1·D-F, FC-188) — FAILED 아닌 배송(PENDING/CLAIMED/DEFERRED/APPLIED)이
        //   있는 아이템은 게임으로 배송 중이거나 이미 전달됐으므로 출품 불가. location='INVENTORY' CAS 에 더한 검증으로
        //   웹↔게임 이중 존재·이중 배송을 원천 차단한다. ★ APPLIED 포함이 lag 창(게임 apply~웹 reconciler IN_GAME 전이
        //   사이, item_instance 아직 INVENTORY)을 봉쇄한다(D-F). IN_GAME 이관 완료 후엔 CAS 가 자동 배제(중복無).
        Preconditions.validate(
            !itemDeliveryRepository.existsByItemInstanceIdAndStatusIn(
                item.getId(), DeliveryStatus.LISTING_BLOCKING_STATUSES),
            AuctionErrorCode.AUCTION_ITEM_NOT_SELLABLE);

        int windowSec = request.softCloseWindowSec() != null ? request.softCloseWindowSec() : DEFAULT_SOFT_CLOSE_SEC;
        int extendSec = request.softCloseExtendSec() != null ? request.softCloseExtendSec() : DEFAULT_SOFT_CLOSE_SEC;
        validatePrice(request);
        validateTime(request, now, windowSec, extendSec);

        // CAS 전 초기 위치를 포착해 실패(0행) 원인을 분기한다(RR 스냅숏 staleness 회피, spec §4.1).
        ItemLocation initialLocation = item.getLocation();
        int affected = itemInstanceRepository.markListedIfInInventory(item.getId());
        if (affected == 0) {
            // TEMP=미보유(인벤토리에 없음)→403. 그 외(LISTED·동시 선점 패자)=이미 출품중→409.
            if (initialLocation == ItemLocation.TEMP) {
                throw new BusinessException(AuctionErrorCode.AUCTION_ITEM_NOT_SELLABLE);
            }
            throw new BusinessException(AuctionErrorCode.AUCTION_ALREADY_LISTED);
        }

        AuctionStatus status = resolveInitialStatus(request.startAt(), now);
        Auction auction = auctionRepository.save(Auction.builder()
            .seller(item.getOwner()) // owner == seller(검증 완료), fetch join 으로 초기화됨
            .itemInstance(item)
            .startPrice(request.startPrice())
            .buyNowPrice(request.buyNowPrice())
            .status(status)
            .startAt(request.startAt())
            .endAt(request.endAt())
            .maxEndAt(request.maxEndAt())
            .softCloseWindowSec(windowSec)
            .softCloseExtendSec(extendSec)
            .itemNameSnapshot(item.getTemplate().getDisplayName())
            .itemSpecSnapshot(buildSpecSnapshot(item))
            .build());
        return AuctionRegisterResponse.builder()
            .auctionPublicId(auction.getPublicId())
            .status(status)
            .endAt(auction.getEndAt())
            .build();
    }

    /** 경매 목록(계약 §3.1 GET /auctions) — 공통 필터 + keyset cursor. status 는 응답 매핑 시 lazy 파생한다. */
    @ServiceLog
    public CursorResponse<AuctionSummaryResponse, String> getList(
        AuctionSearchCondition condition, String cursor, int size) {
        Instant now = Instant.now();
        AuctionCursor decoded = AuctionCursor.decode(cursor);
        List<AuctionWithBidCount> fetched = auctionRepository.findByCursor(condition, decoded, size, now);
        // 커서는 매핑 전 원본(AuctionWithBidCount)의 마지막 항목에서 정렬 필드 값 + id 로 추출한다.
        return CursorResponse.from(fetched, size,
            row -> AuctionSummaryResponse.from(row, now),
            row -> encodeCursor(row, condition.sort()));
    }

    /**
     * 자유문 검색 목록(계약 C1~C3, EPIC-SEARCH). {@code q} 로 ES({@code listings} alias)를 질의해 관련도 순 public_id 를
     * 얻고, 표시 데이터는 MySQL(정본)에서 하이드레이션해 <b>MySQL 목록과 동일한 응답 형태</b>를 만든다(§12.8 "정확값은
     * DB"). 코드축 필터는 {@code q} 와 AND 결합된다(계약 C1). 정렬은 relevance(_score desc, publicId asc) 고정이다.
     *
     * <p>ES 가 준 순서를 보존하도록 하이드레이션 결과를 public_id 기준으로 재배열한다(IN 절은 순서를 보존하지 않는다).
     * ES 가 스테일해 DB 에 없는 public_id 는 조용히 제외한다(정본이 없으면 표시하지 않는다 — 유령 행 방지).
     */
    @ServiceLog
    public CursorResponse<AuctionSummaryResponse, String> search(
        AuctionSearchCondition condition, String query, String cursor, int size) {
        Instant now = Instant.now();
        ListingSearchCondition searchCondition = new ListingSearchCondition(
            ListingType.AUCTION, query,
            condition.mainCategory(), condition.subGroup(), condition.element(), condition.kind(),
            condition.minLevel(), condition.maxLevel(), condition.skill1(), condition.skill2(),
            condition.goldforceActive(), condition.minPrice(), condition.maxPrice(),
            auctionStatuses(condition.status()));
        ListingSearchHits hits = listingSearchService.search(searchCondition, cursor, size);

        Map<String, AuctionWithBidCount> byPublicId = auctionRepository
            .findSummariesByPublicIds(hits.publicIds()).stream()
            .collect(Collectors.toMap(row -> row.auction().getPublicId(), Function.identity(), (a, b) -> a));
        List<AuctionSummaryResponse> ordered = hits.publicIds().stream()
            .map(byPublicId::get)
            .filter(Objects::nonNull)
            .map(row -> AuctionSummaryResponse.from(row, now))
            .toList();
        // 커서·hasNext 는 ES 가 판정한 값을 그대로 보존한다(over-fetch 슬라이싱 아님).
        return CursorResponse.of(ordered, hits.nextCursor(), hits.hasNext());
    }

    /** 검색 노출 상태 화이트리스트 — MySQL 목록과 동일 규약(null=진행 가능 SCHEDULED·ACTIVE, 지정=해당 상태만). */
    private List<String> auctionStatuses(AuctionStatus status) {
        if (status == null) {
            return List.of(AuctionStatus.SCHEDULED.name(), AuctionStatus.ACTIVE.name());
        }
        return List.of(status.name());
    }

    /**
     * 경매 상세(계약 §3.1 GET /auctions/{id}). itemInstance·template·skill·seller·highestBidder 를 fetch join 해
     * 표현 계층 lazy 접근을 없앤다. status 의 lazy 활성화 파생은 응답 매핑 시
     * {@link Auction#displayStatus(Instant)}로 수행하고, 설정 의존 파생값({@code minNextBidAmount})은 여기서 채운다.
     */
    @ServiceLog
    public AuctionDetailResponse getDetail(String publicId) {
        AuctionWithBidCount row = auctionRepository.findDetailByPublicId(publicId)
            .orElseThrow(() -> new BusinessException(AuctionErrorCode.AUCTION_NOT_FOUND));
        return AuctionDetailResponse.from(
            row.auction(), row.bidCount(), minNextBidAmount(row.auction()), Instant.now());
    }

    /**
     * 다음 입찰 최소 금액(계약 v1.8 F3). 산출은 {@link BidIncrementProperties#minNextBidAmount(long, Long)}에
     * <b>위임</b>한다 — 입찰 검증({@code BID_001})이 쓰는 것과 동일한 메서드다. 여기서 구간표를 다시 구현하면
     * "화면이 안내한 금액으로 입찰했는데 거부되는" 드리프트가 생긴다.
     *
     * <p>종료 상태(SOLD·UNSOLD·CANCELLED)는 null 이다. 마감 시각이 지났지만 status 가 아직 진행 상태인 경매는
     * 값을 그대로 내린다 — 마감 판정은 status 가 아니라 시각으로 하며(bid-domain-spec §3.2), 그 판정의 정본은
     * 입찰 트랜잭션의 락 스냅샷이다. 조회 응답이 그 판정을 흉내 내면 두 진실이 생긴다.
     */
    private Long minNextBidAmount(Auction auction) {
        if (isClosed(auction.getStatus())) {
            return null;
        }
        return incrementProperties.minNextBidAmount(auction.getStartPrice(), auction.getHighestBidAmount());
    }

    /** 종료 상태(더 이상 입찰이 성립하지 않는 상태) 판정. */
    private boolean isClosed(AuctionStatus status) {
        return status == AuctionStatus.SOLD || status == AuctionStatus.UNSOLD || status == AuctionStatus.CANCELLED;
    }

    /**
     * 판매자 취소(계약 §3.1 POST /auctions/{id}/cancel, 단일 TX). 주체=판매자 검증 후 SCHEDULED|ACTIVE & 입찰0
     * 조건부 CAS 로 CANCELLED 전이하고, 성공 시 출품 아이템 에스크로를 해제한다(LISTED→INVENTORY/만실 TEMP).
     *
     * @return 취소 결과 상태(CANCELLED)
     */
    @Transactional
    @ServiceLog
    public AuctionStatus cancel(String publicId) {
        Long sellerId = currentUserId();
        Auction auction = auctionRepository.findDetailByPublicId(publicId)
            .map(AuctionWithBidCount::auction)
            .orElseThrow(() -> new BusinessException(AuctionErrorCode.AUCTION_NOT_FOUND));
        // 타인 취소 차단(IDOR): 주체 ≠ 판매자면 403(게이트2 f — 미소유 통일). seller 는 fetch join 됨.
        Preconditions.validate(
            auction.getSeller().getId().equals(sellerId), AuctionErrorCode.AUCTION_ITEM_NOT_SELLABLE);

        int affected = auctionRepository.cancelIfCancellable(auction.getId());
        if (affected == 0) {
            // 0행 원인 분기(bid-domain-spec §4.6, EPIC-BID 인계 정정). 위에서 로드한 엔티티로 판정하면 안 된다 —
            //   취소 로드 직후 첫 입찰이 커밋되는 경합에서 그 엔티티의 highest_bidder 는 아직 null 이라
            //   AUCTION_007(입찰 존재) 대신 AUCTION_006(이미 종료)을 반환하는 오분류가 난다.
            //   cancelIfCancellable 에 clearAutomatically 가 없어 findById 재조회도 같은 스테일 엔티티를 준다 →
            //   1차 캐시를 우회하는 스칼라 프로젝션 + 잠금 읽기(RR 일관읽기 스냅샷 우회)여야 최신 값을 본다.
            AuctionCancelState state = auctionRepository.findCancelStateForUpdate(auction.getId())
                .orElseThrow(() -> new BusinessException(AuctionErrorCode.AUCTION_NOT_FOUND));
            if (state.highestBidderId() != null) {
                throw new BusinessException(AuctionErrorCode.AUCTION_HAS_BIDS);
            }
            throw new BusinessException(AuctionErrorCode.AUCTION_ALREADY_CLOSED);
        }

        // 에스크로 해제(별도 빈 경유 → 동일 TX 참여, self-invocation 아님). 실패 시 취소 CAS 까지 롤백.
        inventoryService.releaseFromListing(auction.getItemInstance());
        return AuctionStatus.CANCELLED;
    }

    /** startAt 이 미래면 SCHEDULED, null 또는 도래(≤ now)면 ACTIVE 로 생성한다(spec §3·§9-a). */
    private AuctionStatus resolveInitialStatus(Instant startAt, Instant now) {
        if (startAt != null && startAt.isAfter(now)) {
            return AuctionStatus.SCHEDULED;
        }
        return AuctionStatus.ACTIVE;
    }

    /** 가격 검증(spec §5.1) — startPrice &gt; 0, buyNowPrice(있으면) &gt; startPrice. 위반 시 AUCTION_003(422). */
    private void validatePrice(AuctionRegisterRequest request) {
        Preconditions.validate(request.startPrice() > 0, AuctionErrorCode.AUCTION_INVALID_BUY_NOW_PRICE);
        Preconditions.validate(
            request.buyNowPrice() == null || request.buyNowPrice() > request.startPrice(),
            AuctionErrorCode.AUCTION_INVALID_BUY_NOW_PRICE);
    }

    /**
     * 시간 파라미터 검증(SEC-009 → AUCTION_008, 422). endAt &gt; now, startAt ≤ endAt, maxEndAt ≥ endAt,
     * window·extend 는 양수·상한 이내, maxEndAt−endAt 는 총연장 상한 이내(게이트2 c).
     */
    private void validateTime(AuctionRegisterRequest request, Instant now, int windowSec, int extendSec) {
        Instant endAt = request.endAt();
        Instant startAt = request.startAt();
        Instant maxEndAt = request.maxEndAt();
        Preconditions.validate(endAt.isAfter(now), AuctionErrorCode.AUCTION_INVALID_TIME_PARAM);
        Preconditions.validate(
            startAt == null || !startAt.isAfter(endAt), AuctionErrorCode.AUCTION_INVALID_TIME_PARAM);
        Preconditions.validate(!maxEndAt.isBefore(endAt), AuctionErrorCode.AUCTION_INVALID_TIME_PARAM);
        Preconditions.validate(
            windowSec > 0 && windowSec <= SOFT_CLOSE_MAX_SEC, AuctionErrorCode.AUCTION_INVALID_TIME_PARAM);
        Preconditions.validate(
            extendSec > 0 && extendSec <= SOFT_CLOSE_MAX_SEC, AuctionErrorCode.AUCTION_INVALID_TIME_PARAM);
        Preconditions.validate(
            Duration.between(endAt, maxEndAt).getSeconds() <= MAX_TOTAL_EXTENSION_SEC,
            AuctionErrorCode.AUCTION_INVALID_TIME_PARAM);
    }

    /**
     * 등록 시점 핵심 스펙 요약 스냅샷(D-045, spec §2.1). live 값(현재 소유자 등)은 넣지 않고 인스턴스 스펙만 고정한다.
     * 255자 이내로 방어적 절단한다(스킬 슬롯이 비면 "-").
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

    /**
     * 다음 페이지 커서를 정렬 필드 값 + id 로 인코딩한다. {@code highestBidAmount} 는 nullable 이라 입찰 없는
     * 경매가 경계 행이면 sortValue 가 null 로 인코딩되며, 디코드 측이 이를 "NULL 그룹 경계"로 해석한다
     * ({@code AuctionRepositoryImpl.highestBidKeyset}).
     */
    private String encodeCursor(AuctionWithBidCount row, AuctionSort sort) {
        Auction last = row.auction();
        String sortValue = switch (sort) {
            case PRICE -> String.valueOf(last.getStartPrice());
            case END_AT -> last.getEndAt().toString();
            case CREATED_AT -> last.getCreatedAt().toString();
            case HIGHEST_BID_AMOUNT ->
                last.getHighestBidAmount() == null ? null : String.valueOf(last.getHighestBidAmount());
        };
        return AuctionCursor.encode(sortValue, last.getId());
    }

    /** 인증 주체(내부 PK)를 해석한다. 인증 필요 엔드포인트라 SecurityConfig 가 인증을 강제한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
