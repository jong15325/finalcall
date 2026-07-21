package com.finalcall.domain.currency;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.bid.BidErrorCode;
import com.finalcall.domain.bid.BidRepository;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 게임머니 홀드(에스크로) 서비스(currency) — 입찰에 수반하는 <b>금전 이동을 한 빈에 응집</b>시킨다.
 *
 * <p>응집시킨 이유는 보안·정합 표면을 좁히기 위해서다. 잔액({@code user_balance})과 원장({@code money_hold})은
 * 항상 함께 움직여야 하는데(불변식 I4: 사용자별 {@code game_money_held} == {@code SUM(HELD amount)}), 호출처마다
 * 두 갱신을 따로 조합하면 한쪽만 성공하는 코드 경로가 쉽게 생긴다. 이 빈이 유일한 진입점이면 검증할 곳이 하나다.
 *
 * <h2>설계 규칙 3가지</h2>
 * <ol>
 *   <li><b>{@code Propagation.MANDATORY}</b> — 반드시 호출자의 트랜잭션에 참여한다. 홀드가 자체 트랜잭션으로
 *       독립 커밋되면 입찰이 롤백돼도 자금이 묶인 채 남는다(최악 시나리오 = 자금 동결). 트랜잭션 없이 호출하면
 *       런타임에 즉시 실패하므로 그런 배선이 배포까지 가지 못한다.</li>
 *   <li><b>잔액 갱신 → 원장 기록 순서 고정</b> — {@link UserBalanceRepository} 의 조건부 UPDATE 는
 *       {@code clearAutomatically}라 영속성 컨텍스트를 통째로 비운다(bid-domain-spec §4.2). 잔액을 먼저 끝내고
 *       그 뒤에 원장을 쓰면, 원장 쓰기가 clear 의 사정권에 들어가지 않는다. 순서를 뒤집으면 갱신이
 *       <b>예외 없이 조용히 유실</b>될 수 있다.</li>
 *   <li><b>{@code user_id} 오름차순 락 순서</b> — {@link #placeHold} 는 서로 다른 두 사용자의 잔액 행에 배타 락을
 *       건다. 두 사용자가 서로 다른 두 경매에서 교차로 상대를 밀어내면 락 순서가 역전돼 데드락이 성립한다.
 *       전역 순서를 {@code user_id} 오름차순 하나로 고정해 순환 대기를 원천 차단한다(§4.4).</li>
 * </ol>
 *
 * <p><b>이중 해제·미해제가 불가능한 근거(§4.5)</b>: 해제는 원장 CAS({@code WHERE status='HELD'})와 잔액 CAS
 * ({@code WHERE game_money_held >= amount})의 이중 조건을 모두 통과해야 하고, 어느 한쪽이라도 영향행 0이면
 * 무시하지 않고 예외로 올려 트랜잭션 전체를 롤백한다. 따라서 (a) 같은 홀드를 두 번 해제하면 두 번째가 반드시
 * 실패하고, (b) 해제가 부분적으로만 반영된 상태는 커밋되지 않는다.
 */
@Service
@RequiredArgsConstructor
public class MoneyHoldService {

    private final MoneyHoldRepository moneyHoldRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final UserRepository userRepository;
    private final BidRepository bidRepository;

    /**
     * 입찰 성립에 수반하는 금전 이동을 한 번에 수행한다 — 신규 입찰자 홀드 + 직전 최고 입찰자 홀드 즉시 해제(P-008).
     *
     * <p>두 잔액 갱신을 <b>하나의 메서드 안에서</b> 처리하는 것이 핵심이다. 호출 측이 홀드와 해제를 따로 호출할 수
     * 있게 열어두면 {@code user_id} 오름차순 규칙이 호출 측 규율에 의존하게 되고, 규율은 언젠가 깨진다. 여기서는
     * 순서가 구조적으로 강제된다.
     *
     * <p>실패 처리: 신규 홀드가 가용 잔액을 넘으면 {@code BID_005}로 거절한다(정상적인 비즈니스 실패). 반면 직전
     * 홀드 해제 실패는 이미 성립한 불변식이 깨졌다는 뜻이라 {@code COMMON_999}(500)로 드러낸다 — 조용히 넘기면
     * 자금 드리프트가 누적된다.
     *
     * @param bidderId      신규 입찰자 PK(= SecurityContext 주체, 요청 본문에서 받지 않는다)
     * @param bidId         신규 입찰 행 PK — 호출 전에 {@code bid} 행이 존재해야 한다(FK+UK)
     * @param amount        홀드액(= 입찰액, I3 — 두 값이 갈라지는 경로를 만들지 않는다)
     * @param previousBidId 직전 최고 입찰 PK. 첫 입찰이면 {@code null}
     * @return 생성된 홀드 원장(HELD)
     * @throws BusinessException {@code BID_005} 가용 게임머니 부족 / {@code COMMON_999} 홀드액이 양수가 아니거나
     *                           직전 홀드 해제 불변식 위반
     */
    @ServiceLog
    @Transactional(propagation = Propagation.MANDATORY)
    public MoneyHold placeHold(Long bidderId, Long bidId, long amount, Long previousBidId) {
        // ★ 부호 검증(심층방어). 홀드 CAS 조건은 `가용 잔액 >= :amount` 라 amount 가 음수면 조건이 자명하게 참이 되고
        //   game_money_held 가 오히려 줄어든다 — 영향행이 1이라 BID_005 가드도 통과해 무자본 획득이 성립한다.
        //   호출 측(BidService)도 최소 증분(BID_001)으로 걸러내지만, "유일한 진입점이라 검증할 곳이 하나"라는 이 빈의
        //   전제를 스스로 지키려면 여기에도 못이 박혀 있어야 한다. DB CHECK(amount > 0)가 세 번째 방어선이다.
        //   비즈니스 실패가 아니라 호출 계약 위반이므로 500(COMMON_999) — 사용자에게 재시도를 안내할 성질이 아니다.
        Preconditions.validate(amount > 0, CommonErrorCode.INTERNAL_ERROR);

        MoneyHoldSnapshot previous = findPreviousHold(previousBidId);

        // (1) 잔액 갱신 — user_id 오름차순 강제(§4.4). 여기서만 두 잔액 행에 락이 걸린다.
        if (previous == null || bidderId < previous.userId()) {
            holdBalance(bidderId, amount);
            releaseBalance(previous);
        } else {
            releaseBalance(previous);
            holdBalance(bidderId, amount);
        }

        // (2) 원장 기록 — 잔액 갱신이 영속성 컨텍스트를 clear 한 뒤에 수행한다(설계 규칙 2).
        releaseLedger(previous);
        return insertHold(bidderId, bidId, amount);
    }

    /**
     * 입찰 1건의 홀드를 해제한다(잔액 복원 + 원장 RELEASED). 단일 사용자의 잔액만 건드리므로 락 순서 이슈가 없다.
     *
     * <p>{@link #placeHold} 의 즉시 해제 경로와 별개로, 경매 유찰·강제 취소 등 <b>상위 입찰 없이</b> 홀드만 푸는
     * 경로를 위해 둔다. 해제 대상이 HELD 가 아니면(이미 해제·낙찰 차감됨) 예외로 롤백한다.
     *
     * @param bidId 해제 대상 입찰 PK
     * @throws BusinessException {@code COMMON_999} 해제 대상이 HELD 가 아님(이중 해제 시도)
     */
    @ServiceLog
    @Transactional(propagation = Propagation.MANDATORY)
    public void release(Long bidId) {
        MoneyHoldSnapshot held = moneyHoldRepository.findHeldByBidId(bidId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        releaseBalance(held);
        releaseLedger(held);
    }

    /**
     * 낙찰 홀드 확정 차감(HELD→CAPTURED + 실차감, closing-domain-spec §4.3) — 낙찰자의 홀드된 게임머니를 실제
     * 계정에서 뺀다. 지금까지 {@code game_money_held} 에 잠겨 있던 금액이 잔액과 홀드에서 동시에 빠진다.
     *
     * <p>{@link #release}(잔액 복원 + 원장 RELEASED)의 낙찰측 대칭이다. 원장 스냅샷을 단일 진실원으로 삼아 차감액을
     * 원장에서 읽고(호출 인자로 받지 않는다 — I4 드리프트 방지), 잔액 실차감({@code capture})과 원장 전이
     * ({@code captureIfHeld})의 이중 조건을 모두 통과해야 한다. 어느 한쪽이라도 영향행 0이면 이미 성립한 정합이
     * 깨졌다는 뜻이라 무시하지 않고 500(롤백)으로 올린다 — 조용히 넘기면 자금 드리프트가 누적된다.
     *
     * @param bidId       낙찰 입찰 PK(경매당 ACTIVE→WON 전이 대상)
     * @param capturedAt  차감 확정 시각(원장 released_at 에 기록)
     * @throws BusinessException {@code COMMON_999} 차감 대상이 HELD 가 아니거나 홀드/잔액 불일치(불변식 위반)
     */
    @ServiceLog
    @Transactional(propagation = Propagation.MANDATORY)
    public void capture(Long bidId, Instant capturedAt) {
        MoneyHoldSnapshot held = moneyHoldRepository.findHeldByBidId(bidId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        // 잔액 실차감(balance·held 동시 감소). 영향행 0 = 홀드/잔액 불일치 = 불변식 위반(→ 500, 롤백).
        int balanceAffected = userBalanceRepository.capture(held.userId(), held.amount());
        Preconditions.validate(balanceAffected == 1, CommonErrorCode.INTERNAL_ERROR);
        // 원장 HELD→CAPTURED. 잔액 갱신이 영속성 컨텍스트를 clear 한 뒤 조건부 CAS 로 전이한다(설계 규칙 2).
        int ledgerAffected = moneyHoldRepository.captureIfHeld(held.holdId(), capturedAt);
        Preconditions.validate(ledgerAffected == 1, CommonErrorCode.INTERNAL_ERROR);
    }

    /**
     * 직전 최고 입찰의 유효 홀드를 읽는다. 직전 입찰이 있는데 HELD 홀드가 없으면 I3 위반이라 진행하지 않는다.
     *
     * <p>해제액을 호출 인자가 아니라 원장에서 읽는다 — 잔액에서 빼는 금액과 원장이 갈라지는 경로를 없앤다(I4).
     */
    private MoneyHoldSnapshot findPreviousHold(Long previousBidId) {
        if (previousBidId == null) {
            return null;
        }
        return moneyHoldRepository.findHeldByBidId(previousBidId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
    }

    /** 가용 잔액(= 잔액 − 홀드) 이내에서만 성공하는 조건부 UPDATE. 영향행 0 = 잔액 부족(정상 실패 → BID_005). */
    private void holdBalance(Long userId, long amount) {
        int affected = userBalanceRepository.hold(userId, amount);
        Preconditions.validate(affected == 1, BidErrorCode.BID_INSUFFICIENT_BALANCE);
    }

    /** 현재 홀드 이내에서만 성공하는 조건부 UPDATE. 영향행 0 = 홀드 초과 해제 = 불변식 위반(→ 500, 롤백). */
    private void releaseBalance(MoneyHoldSnapshot target) {
        if (target == null) {
            return;
        }
        int affected = userBalanceRepository.release(target.userId(), target.amount());
        Preconditions.validate(affected == 1, CommonErrorCode.INTERNAL_ERROR);
    }

    /** 원장 HELD→RELEASED 조건부 CAS. 영향행 0 = 이중 해제 시도 = 불변식 위반(→ 500, 롤백). */
    private void releaseLedger(MoneyHoldSnapshot target) {
        if (target == null) {
            return;
        }
        int affected = moneyHoldRepository.releaseIfHeld(target.holdId(), Instant.now());
        Preconditions.validate(affected == 1, CommonErrorCode.INTERNAL_ERROR);
    }

    /**
     * 홀드 원장을 기록한다. {@code saveAndFlush} 로 {@code bid_id} UK 위반을 이 메서드 안에서 표면화한다 —
     * 커밋 시점까지 미루면 원인 추적이 어렵다({@code ExchangeWriter} 선례).
     *
     * <p>연관은 {@code getReferenceById} 프록시로 채운다: 앞선 잔액 UPDATE 가 영속성 컨텍스트를 비운 뒤라
     * 관리 엔티티를 재사용할 수 없고, FK 값만 필요해 추가 select 도 불필요하다.
     */
    private MoneyHold insertHold(Long bidderId, Long bidId, long amount) {
        return moneyHoldRepository.saveAndFlush(MoneyHold.builder()
            .user(userRepository.getReferenceById(bidderId))
            .bid(bidRepository.getReferenceById(bidId))
            .amount(amount)
            .build());
    }
}
