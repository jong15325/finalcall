package com.finalcall.domain.bid.entity;

/**
 * 현재 최고 입찰(= {@code status=ACTIVE}) 스칼라 스냅샷(bid).
 *
 * <p>엔티티가 아니라 <b>프로젝션</b>인 이유: 입찰 트랜잭션은 잔액 조건부 UPDATE 호출로 영속성 컨텍스트가
 * clear 되므로(bid-domain-spec §4.2), 관리 엔티티를 들고 다니면 detach 된 스테일 객체를 근거로 판단하게 된다.
 * 값 타입으로 복사해 두면 clear 의 영향을 받지 않는다.
 *
 * @param bidId    직전 최고 입찰의 PK — 홀드 해제·OUTBID 전이 대상 식별자
 * @param bidderId 직전 최고 입찰자 PK — 잔액 해제 대상이자 {@code user_id} 오름차순 락 순서의 정렬 키(§4.4)
 * @param amount   직전 최고 입찰액
 */
public record BidSnapshot(Long bidId, Long bidderId, long amount) {
}
