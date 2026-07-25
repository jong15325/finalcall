package com.finalcall.domain.currency.service;

import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.currency.entity.ExchangeDirection;
import com.finalcall.domain.currency.entity.MoneyExchange;
import com.finalcall.domain.currency.repository.MoneyExchangeRepository;

import lombok.RequiredArgsConstructor;

/**
 * 화폐 교환 서비스(currency) — 캐시→게임머니 교환(계약 §4.4 POST /api/v1/exchanges).
 *
 * <p>이 클래스는 <b>멱등 오케스트레이션</b>만 담당하고, 원자 쓰기는 {@link ExchangeWriter}(별도 빈·트랜잭션)에 위임한다.
 * 클래스 레벨 {@code @Transactional} 을 두지 <b>않는다</b>: replay 선검사와 경쟁 승자 재조회가 <b>각각 자동커밋(개별
 * 스냅샷)</b>으로 돌아야 승자의 커밋을 볼 수 있고, 쓰기 트랜잭션이 {@link ExchangeWriter} 안에서 독립적으로 롤백돼야
 * 이중 차감이 없기 때문이다. 오케스트레이터가 장기 트랜잭션을 쥐면 재조회가 스냅샷에 갇혀 승자 행을 놓친다.
 *
 * <p>인증 주체는 SecurityContext 의 userId(내부 PK)다(B-009) — {@code X-User-Id} 헤더는 신뢰하지 않는다(D-065).
 */
@Service
@RequiredArgsConstructor
public class ExchangeService {

    private final MoneyExchangeRepository moneyExchangeRepository;
    private final ExchangeWriter exchangeWriter;

    /**
     * 캐시→게임머니 교환을 멱등하게 처리한다(SEC-004).
     *
     * <p>멱등 불변식:
     * <ol>
     *   <li><b>replay</b>: 동일 {@code (userId, key)} 재요청은 선검사에서 최초 원장을 찾아 <b>재차감 없이</b> 최초 결과를
     *       그대로 반환한다.</li>
     *   <li><b>동시 중복 제출</b>: 선검사를 함께 통과한 두 요청은 UK 로 하나만 커밋된다. 진 쪽은 쓰기 트랜잭션이 통째로
     *       롤백돼 <b>캐시 이중 차감이 없고</b>, 아래 catch 에서 승자 행을 재조회해 최초 결과를 반환한다(오류 아님).</li>
     *   <li><b>실패 미소비</b>: 캐시 부족(EXC_001)·역방향(EXC_002)은 {@link ExchangeWriter} 트랜잭션 롤백으로 원장에
     *       남지 않아 멱등키를 소비하지 않는다 — 충전 후 같은 key 재시도가 정상 진행된다.</li>
     * </ol>
     *
     * @return 표현 변환 전 {@link MoneyExchange} 원장(엔티티→응답 DTO 변환은 api 계층 담당)
     */
    @ServiceLog
    public MoneyExchange exchange(ExchangeDirection direction, long cashAmount, String idempotencyKey) {
        Long userId = currentUserId();

        // (1) replay 선검사 — 이미 처리된 (userId, key)면 재차감 없이 최초 결과 반환(대다수 재요청을 빠르게 처리).
        Optional<MoneyExchange> replay = moneyExchangeRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
        if (replay.isPresent()) {
            return replay.get();
        }

        try {
            // (2) 원자 처리(캐시 차감 + 게임머니 지급 + 원장 insert)를 단일 트랜잭션에 위임.
            return exchangeWriter.write(userId, direction, cashAmount, idempotencyKey);
        } catch (DataIntegrityViolationException e) {
            // (3) 동시 중복 제출 경쟁: 선검사를 함께 통과한 뒤 UK 를 뺏긴 트랜잭션. write 가 통째로 롤백돼 '이 요청의'
            //     캐시 차감도 되돌려졌다(이중 차감 없음). 승자 행을 새 읽기(자동커밋)로 재조회해 최초 결과를 반환한다.
            //     승자 행이 없다면(정상적으로 도달 불가) 깨진 불변식이므로 500 으로 드러낸다.
            return moneyExchangeRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        }
    }

    /** 인증 주체(principal)를 userId(내부 PK)로 해석한다. JWT 필터가 subject=userId 로 적재한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
