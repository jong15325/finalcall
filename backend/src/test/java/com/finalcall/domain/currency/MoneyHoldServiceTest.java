package com.finalcall.domain.currency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.domain.bid.BidErrorCode;
import com.finalcall.domain.bid.BidRepository;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;

/**
 * {@link MoneyHoldService} 단위 테스트 — 스프링 컨텍스트 없이 협력자 모의(가장 빠른 계층).
 *
 * <p>여기서 검증하는 것은 <b>호출 순서와 실패 매핑</b>이다. 값의 정합(잔액·원장 합계)은 실제 DB 가 있어야 의미가
 * 있어 슬라이스/동시성 테스트가 맡고, 순서 규칙은 DB 로는 결정론적으로 관측할 수 없어 여기서만 잡을 수 있다:
 * <ul>
 *   <li><b>{@code user_id} 오름차순 잔액 갱신</b>(bid-domain-spec §4.4) — 교차 outbid 데드락 회피의 유일한 근거.
 *       순서가 뒤집히면 부하 상황에서만 데드락으로 드러나므로 단위 테스트로 고정해 둔다.</li>
 *   <li><b>잔액 갱신 → 원장 기록 순서</b>(§4.2) — 잔액 UPDATE 가 영속성 컨텍스트를 clear 하므로 뒤집히면
 *       원장 쓰기가 조용히 유실될 수 있다.</li>
 *   <li>실패 매핑 — 잔액 부족은 정상 실패({@code BID_005}), 해제 불변식 위반은 {@code COMMON_999}(롤백 유도).</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class MoneyHoldServiceTest {

    private static final long AMOUNT = 5_000L;
    private static final long PREV_AMOUNT = 3_000L;
    private static final Long BID_ID = 100L;
    private static final Long PREV_BID_ID = 99L;
    private static final Long PREV_HOLD_ID = 55L;

    @Mock
    private MoneyHoldRepository moneyHoldRepository;

    @Mock
    private UserBalanceRepository userBalanceRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BidRepository bidRepository;

    @InjectMocks
    private MoneyHoldService moneyHoldService;

    @Test
    void 첫_입찰은_해제없이_홀드만_기록한다() {
        givenHoldSucceeds();
        givenLedgerInsertSucceeds();

        moneyHoldService.placeHold(10L, BID_ID, AMOUNT, null);

        verify(userBalanceRepository).hold(10L, AMOUNT);
        verify(userBalanceRepository, never()).release(anyLong(), anyLong());
        verify(moneyHoldRepository, never()).releaseIfHeld(anyLong(), any());
        verify(moneyHoldRepository).saveAndFlush(any(MoneyHold.class));
    }

    @Test
    void 입찰자_id가_더_작으면_홀드를_먼저_수행한다() {
        givenPreviousHold(20L); // 직전 입찰자 20 > 신규 입찰자 10
        givenHoldSucceeds();
        givenReleaseSucceeds();
        givenLedgerReleaseSucceeds();
        givenLedgerInsertSucceeds();

        moneyHoldService.placeHold(10L, BID_ID, AMOUNT, PREV_BID_ID);

        InOrder order = inOrder(userBalanceRepository);
        order.verify(userBalanceRepository).hold(10L, AMOUNT); // user_id 10 먼저
        order.verify(userBalanceRepository).release(20L, PREV_AMOUNT);
    }

    @Test
    void 입찰자_id가_더_크면_해제를_먼저_수행한다() {
        givenPreviousHold(5L); // 직전 입찰자 5 < 신규 입찰자 10
        givenHoldSucceeds();
        givenReleaseSucceeds();
        givenLedgerReleaseSucceeds();
        givenLedgerInsertSucceeds();

        moneyHoldService.placeHold(10L, BID_ID, AMOUNT, PREV_BID_ID);

        InOrder order = inOrder(userBalanceRepository);
        order.verify(userBalanceRepository).release(5L, PREV_AMOUNT); // user_id 5 먼저
        order.verify(userBalanceRepository).hold(10L, AMOUNT);
    }

    @Test
    void 잔액_갱신을_모두_끝낸_뒤에_원장을_기록한다() {
        givenPreviousHold(20L);
        givenHoldSucceeds();
        givenReleaseSucceeds();
        givenLedgerReleaseSucceeds();
        givenLedgerInsertSucceeds();

        moneyHoldService.placeHold(10L, BID_ID, AMOUNT, PREV_BID_ID);

        // 잔액 UPDATE 는 영속성 컨텍스트를 clear 하므로, 원장 쓰기가 그 뒤에 와야 유실되지 않는다(§4.2).
        InOrder order = inOrder(userBalanceRepository, moneyHoldRepository);
        order.verify(userBalanceRepository).hold(10L, AMOUNT);
        order.verify(userBalanceRepository).release(20L, PREV_AMOUNT);
        order.verify(moneyHoldRepository).releaseIfHeld(eq(PREV_HOLD_ID), any());
        order.verify(moneyHoldRepository).saveAndFlush(any(MoneyHold.class));
    }

    @Test
    void 가용잔액이_부족하면_BID_005로_거절한다() {
        when(userBalanceRepository.hold(10L, AMOUNT)).thenReturn(0); // 조건부 UPDATE 영향행 0 = 가용 부족

        assertThatThrownBy(() -> moneyHoldService.placeHold(10L, BID_ID, AMOUNT, null))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getErrorCode())
            .isEqualTo(BidErrorCode.BID_INSUFFICIENT_BALANCE);

        verify(moneyHoldRepository, never()).saveAndFlush(any(MoneyHold.class)); // 원장에 흔적을 남기지 않는다
    }

    @Test
    void 직전_홀드의_잔액_해제가_0행이면_불변식_위반으로_올린다() {
        givenPreviousHold(20L);
        givenHoldSucceeds();
        when(userBalanceRepository.release(20L, PREV_AMOUNT)).thenReturn(0); // 홀드 초과 해제 시도

        assertThatThrownBy(() -> moneyHoldService.placeHold(10L, BID_ID, AMOUNT, PREV_BID_ID))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(CommonErrorCode.INTERNAL_ERROR);
    }

    @Test
    void 직전_홀드의_원장_해제가_0행이면_불변식_위반으로_올린다() {
        givenPreviousHold(20L);
        givenHoldSucceeds();
        givenReleaseSucceeds();
        when(moneyHoldRepository.releaseIfHeld(eq(PREV_HOLD_ID), any())).thenReturn(0); // 이중 해제 시도

        assertThatThrownBy(() -> moneyHoldService.placeHold(10L, BID_ID, AMOUNT, PREV_BID_ID))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(CommonErrorCode.INTERNAL_ERROR);

        verify(moneyHoldRepository, never()).saveAndFlush(any(MoneyHold.class));
    }

    @Test
    void 직전_입찰에_유효홀드가_없으면_불변식_위반으로_올린다() {
        when(moneyHoldRepository.findHeldByBidId(PREV_BID_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> moneyHoldService.placeHold(10L, BID_ID, AMOUNT, PREV_BID_ID))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getErrorCode())
            .isEqualTo(CommonErrorCode.INTERNAL_ERROR);

        // 잔액에 손대기 전에 중단된다 — 근거가 불확실한 상태로 금전을 움직이지 않는다.
        verify(userBalanceRepository, never()).hold(anyLong(), anyLong());
    }

    @Test
    void 단독_해제는_잔액과_원장을_함께_되돌린다() {
        givenPreviousHold(20L);
        givenReleaseSucceeds();
        givenLedgerReleaseSucceeds();

        moneyHoldService.release(PREV_BID_ID);

        InOrder order = inOrder(userBalanceRepository, moneyHoldRepository);
        order.verify(userBalanceRepository).release(20L, PREV_AMOUNT);
        order.verify(moneyHoldRepository).releaseIfHeld(eq(PREV_HOLD_ID), any());
    }

    @Test
    void 단독_해제_대상이_HELD가_아니면_불변식_위반으로_올린다() {
        when(moneyHoldRepository.findHeldByBidId(PREV_BID_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> moneyHoldService.release(PREV_BID_ID))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getErrorCode())
            .isEqualTo(CommonErrorCode.INTERNAL_ERROR);

        verify(userBalanceRepository, never()).release(anyLong(), anyLong());
    }

    private void givenPreviousHold(long previousUserId) {
        when(moneyHoldRepository.findHeldByBidId(PREV_BID_ID))
            .thenReturn(Optional.of(new MoneyHoldSnapshot(PREV_HOLD_ID, previousUserId, PREV_AMOUNT)));
    }

    private void givenHoldSucceeds() {
        when(userBalanceRepository.hold(10L, AMOUNT)).thenReturn(1);
    }

    private void givenReleaseSucceeds() {
        when(userBalanceRepository.release(anyLong(), eq(PREV_AMOUNT))).thenReturn(1);
    }

    private void givenLedgerReleaseSucceeds() {
        when(moneyHoldRepository.releaseIfHeld(eq(PREV_HOLD_ID), any())).thenReturn(1);
    }

    private void givenLedgerInsertSucceeds() {
        when(moneyHoldRepository.saveAndFlush(any(MoneyHold.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void 홀드_원장은_입찰액과_동일한_금액으로_기록된다() {
        givenHoldSucceeds();
        givenLedgerInsertSucceeds();

        MoneyHold created = moneyHoldService.placeHold(10L, BID_ID, AMOUNT, null);

        // money_hold.amount 와 bid.amount 가 갈라지는 경로를 만들지 않는다(불변식 I3).
        assertThat(created.getAmount()).isEqualTo(AMOUNT);
        assertThat(created.getStatus()).isEqualTo(MoneyHoldStatus.HELD);
    }
}
