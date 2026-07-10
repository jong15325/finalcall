package com.finalcall.domain.sample;

import org.springframework.stereotype.Service;

/**
 * 샘플 도메인 서비스 — Stage 1 수직 슬라이스 검증용.
 *
 * <p>controller → service 흐름만 성립하면 된다(DB/Redis 없음).
 * 실제 도메인 서비스 컨벤션(@Transactional, @ServiceLog 등)은 Stage D 이후 적용한다.
 */
@Service
public class SampleService {

    public String getMessage() {
        return "Hello, FinalCall!";
    }
}
