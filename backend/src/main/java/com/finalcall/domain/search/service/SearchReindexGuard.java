package com.finalcall.domain.search.service;

import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.stereotype.Component;

/** 관리자 재색인과 화해 보정이 공유하는 단일 실행 permit. */
@Component
public class SearchReindexGuard {

    private final AtomicBoolean occupied = new AtomicBoolean();

    public boolean tryAcquire() {
        return occupied.compareAndSet(false, true);
    }

    public void release() {
        occupied.set(false);
    }
}
