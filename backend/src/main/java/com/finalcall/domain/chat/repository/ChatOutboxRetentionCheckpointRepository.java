package com.finalcall.domain.chat.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.finalcall.domain.chat.entity.ChatOutboxRetentionCheckpoint;

/** CDC 소비 checkpoint와 MySQL binlog 보존 여유를 함께 조회하는 retention 안전 저장소. */
public interface ChatOutboxRetentionCheckpointRepository
    extends JpaRepository<ChatOutboxRetentionCheckpoint, Long> {

    /** 현재 MySQL binlog 보존 초. 조회 실패도 삭제 허용으로 해석하지 않고 서비스가 fail-safe로 건너뛴다. */
    @Query(value = "SELECT @@GLOBAL.binlog_expire_logs_seconds", nativeQuery = true)
    long findBinlogExpireSeconds();
}
