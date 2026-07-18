package com.finalcall.domain.currency;

/**
 * 해제 대상 홀드({@code status=HELD})의 스칼라 스냅샷(currency).
 *
 * <p>엔티티가 아니라 <b>프로젝션</b>인 이유: 잔액 조건부 UPDATE 호출이 영속성 컨텍스트를 clear 하므로
 * (bid-domain-spec §4.2) 관리 엔티티는 detach 된 스테일 객체가 된다. 값으로 복사해 두면 영향을 받지 않는다.
 *
 * <p>해제액을 호출 인자가 아니라 <b>원장에서 읽은 값</b>으로 쓰기 위한 캐리어이기도 하다 — 잔액 해제액이
 * 원장의 홀드액과 갈라질 수 있는 코드 경로를 만들지 않는다(불변식 I4 방어).
 *
 * @param holdId 홀드 행 PK
 * @param userId 홀드 보유자 PK — 잔액 해제 대상이자 {@code user_id} 오름차순 락 순서의 정렬 키(§4.4)
 * @param amount 홀드액(= 대응 입찰액, I3)
 */
public record MoneyHoldSnapshot(Long holdId, Long userId, long amount) {
}
