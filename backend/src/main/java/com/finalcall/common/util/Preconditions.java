package com.finalcall.common.util;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 비즈니스 규칙 검증 유틸(Stage 3).
 *
 * <p>{@code if (!condition) throw new BusinessException(...)} 보일러플레이트를 한 줄로 줄인다.
 * 서비스 계층의 비즈니스 검증에 사용한다(예: {@code Preconditions.validate(post.isOwner(userId), POST_FORBIDDEN)}).
 *
 * <p>Bean Validation({@code @Valid}, 형식 검증)과 역할이 다르다: 이건 "비즈니스 규칙" 검증용이다.
 */
public final class Preconditions {

    private Preconditions() {
    }

    /**
     * 조건이 거짓이면 {@link BusinessException} 을 던진다.
     *
     * @param condition 참이어야 하는 비즈니스 조건
     * @param errorCode 조건 위반 시 사용할 에러 코드
     */
    public static void validate(boolean condition, ErrorCode errorCode) {
        if (!condition) {
            throw new BusinessException(errorCode);
        }
    }
}
