package com.finalcall.domain.currency.service;

import java.math.BigDecimal;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.CurrencyErrorCode;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.currency.ExchangeProperties;
import com.finalcall.domain.currency.entity.ExchangeDirection;
import com.finalcall.domain.currency.entity.MoneyExchange;
import com.finalcall.domain.currency.repository.MoneyExchangeRepository;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 교환의 <b>원자 쓰기</b> 담당 빈(currency). {@link ExchangeService} 오케스트레이션에서 <b>별도 빈</b>으로 분리한 이유는
 * 두 가지다.
 *
 * <ol>
 *   <li><b>트랜잭션 경계</b>: 캐시 차감·게임머니 지급·원장 insert 를 <b>단일 트랜잭션</b>으로 묶어야 한다. 원장 insert 가
 *       UK 위반으로 실패하면 캐시 차감까지 통째로 롤백돼 <b>이중 차감이 없다</b>(불변식 2·3). AOP self-invocation
 *       (부록 C-1)을 피하려 오케스트레이터와 다른 빈으로 둬 프록시 트랜잭션이 실제로 걸리게 한다.</li>
 *   <li><b>롤백 격리</b>: UK 위반 시 이 트랜잭션만 롤백되고 예외가 밖으로 전파돼, 오케스트레이터가 승자 행을 <b>새 읽기</b>로
 *       재조회할 수 있다. 오케스트레이터에 장기 트랜잭션이 없어 재조회가 승자의 커밋을 본다.</li>
 * </ol>
 */
@Component
@RequiredArgsConstructor
class ExchangeWriter {

    private static final int RATE_SCALE = 6; // money_exchange.applied_rate DECIMAL(20,6) 스케일과 일치

    private final UserRepository userRepository;
    private final UserBalanceRepository userBalanceRepository;
    private final MoneyExchangeRepository moneyExchangeRepository;
    private final ExchangeProperties exchangeProperties;

    /**
     * 캐시→게임머니 교환을 원자적으로 수행하고 원장을 기록한다(단일 트랜잭션).
     *
     * <p>실패는 모두 트랜잭션 롤백으로 이어져 <b>원장에 남지 않고 멱등키를 소비하지 않는다</b>(불변식 3): 역방향
     * ({@code EXC_002})·캐시 부족({@code EXC_001})은 부수효과 전/중에 예외로 중단되고, 동시 중복 제출의 패자는
     * {@code saveAndFlush} 의 UK 위반({@code DataIntegrityViolationException})으로 캐시 차감까지 롤백된다.
     *
     * @return 커밋 대상 교환 원장(응답 변환용). 예외 시 반환하지 않는다.
     */
    @Transactional
    public MoneyExchange write(Long userId, ExchangeDirection direction, long cashAmount, String idempotencyKey) {
        // (1) 역방향 미지원 — 부수효과 전에 검증해 미persist 보장(EXC_002).
        Preconditions.validate(
            direction == ExchangeDirection.CASH_TO_GAME, CurrencyErrorCode.EXCHANGE_REVERSE_NOT_SUPPORTED);

        long rate = exchangeProperties.rate();
        long gameMoneyAmount = Math.multiplyExact(cashAmount, rate); // 오버플로면 ArithmeticException(비현실적 금액 방어)

        // (2) 캐시 차감 — FC-008 조건부 원자 UPDATE 재사용. 영향행 0 = 잔액 부족 → EXC_001(롤백, 미persist).
        int decreased = userBalanceRepository.decreaseCash(userId, cashAmount);
        Preconditions.validate(decreased == 1, CurrencyErrorCode.INSUFFICIENT_CASH);

        // (3) 게임머니 지급(증가만 — 항상 성공).
        userBalanceRepository.increaseGameMoney(userId, gameMoneyAmount);

        // (4) 원장 기록 + 즉시 flush — (user_id, key) UK 위반을 이 트랜잭션 안에서 표면화한다.
        //     동시 중복 제출의 패자는 여기서 DataIntegrityViolationException 을 맞고 (2) 차감까지 롤백된다.
        //     getReferenceById 로 불필요한 select 없이 FK 만 채운다.
        MoneyExchange exchange = MoneyExchange.builder()
            .user(userRepository.getReferenceById(userId))
            .cashAmount(cashAmount)
            .gameMoneyAmount(gameMoneyAmount)
            .appliedRate(BigDecimal.valueOf(rate).setScale(RATE_SCALE)) // 원장 컬럼과 스케일 통일(replay 응답과 일관)
            .idempotencyKey(idempotencyKey)
            .build();
        return moneyExchangeRepository.saveAndFlush(exchange);
    }
}
