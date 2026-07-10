package com.finalcall.domain.sample;

import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.util.Preconditions;
import org.springframework.stereotype.Service;

/**
 * 샘플 도메인 서비스 — Stage 1 수직 슬라이스 + Stage 3 예외/검증 데모용.
 *
 * <p>controller → service 흐름만 성립하면 된다(DB/Redis 없음).
 * 실제 도메인 서비스 컨벤션(@Transactional, @ServiceLog 등)은 Stage D 이후 적용한다.
 */
@Service
public class SampleService {

    public String getMessage() {
        return "Hello, FinalCall!";
    }

    /**
     * Preconditions 사용 예시(Stage 3): 조건이 거짓이면 BusinessException(NOT_FOUND).
     * 도메인별 ErrorCode 는 아직 없으므로 공통 코드로 시연한다.
     */
    public void ensureExists(boolean exists) {
        Preconditions.validate(exists, CommonErrorCode.NOT_FOUND);
    }
}
