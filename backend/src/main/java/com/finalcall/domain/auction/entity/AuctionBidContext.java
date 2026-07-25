package com.finalcall.domain.auction.entity;

import java.time.Instant;

/**
 * 입찰 직렬화 구간에서 경매 행 배타 락과 함께 읽는 <b>값 스냅샷</b>(bid-domain-spec §4.1 1단계).
 *
 * <p>엔티티가 아니라 스칼라 프로젝션인 이유는 두 가지다.
 * <ol>
 *   <li><b>PC clear 함정 차단(§4.2)</b> — 입찰 트랜잭션은 잔액 조건부 UPDATE({@code UserBalanceRepository})를
 *       거치는데 그것이 {@code clearAutomatically} 라 영속성 컨텍스트를 통째로 비운다. 관리 엔티티를 들고 있으면
 *       detach 되어 이후 dirty-checking 갱신이 <b>예외 없이 조용히 유실</b>된다. 값으로 복사해 두면 애초에 그
 *       실수를 할 수 없다.</li>
 *   <li><b>지연 로딩 제거</b> — 판정에 필요한 건 {@code seller_id}·{@code highest_bidder_id} 두 FK 값뿐이라
 *       연관 프록시를 만들 이유가 없다. JPQL {@code a.seller.id} 는 조인 없이 FK 컬럼을 그대로 읽으므로
 *       {@code FOR UPDATE} 가 단일 테이블 잠금으로 유지된다.</li>
 * </ol>
 *
 * <p>여기 담긴 값이 §3.1 검증 2~7의 <b>유일한 판정 근거</b>다. 락 밖에서 읽은 값으로 판정하면 TOCTOU 다.
 *
 * @param id                  경매 PK
 * @param sellerId            판매자 PK — 자기 경매 입찰 차단(BID_003) 근거
 * @param status              영속 상태 — 개시·마감 판정(BID_006·BID_007)과 ACTIVE 승격 판단 근거
 * @param startAt             예약 개시 시각(null 이면 즉시 개시)
 * @param endAt               현재 마감 시각 — 소프트클로즈 연장 전 값
 * @param maxEndAt            연장 상한 시각
 * @param softCloseWindowSec  연장 트리거 윈도우(초)
 * @param softCloseExtendSec  연장 폭(초)
 * @param extensionCount      현재까지 실제 연장 횟수
 * @param startPrice          시작가 — 첫 입찰의 하한(F5)
 * @param buyNowPrice         즉시구매가(nullable) — 입찰 상한(BID_002)
 * @param highestBidAmount    현재 최고가(nullable = 입찰 없음) — 최소 증분(BID_001) 기준
 * @param highestBidderId     현재 최고 입찰자 PK(nullable) — 연속 입찰 차단(BID_004) 앵커(§13-e)
 */
public record AuctionBidContext(
    Long id,
    Long sellerId,
    AuctionStatus status,
    Instant startAt,
    Instant endAt,
    Instant maxEndAt,
    int softCloseWindowSec,
    int softCloseExtendSec,
    int extensionCount,
    long startPrice,
    Long buyNowPrice,
    Long highestBidAmount,
    Long highestBidderId) {
}
