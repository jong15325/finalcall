package com.finalcall.domain.item.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.domain.item.entity.TempStorage;

/**
 * 임시보관 리포지토리(item, FC-022). cursor 목록 조회는 {@link TempStorageRepositoryCustom}(QueryDSL).
 */
public interface TempStorageRepository
    extends JpaRepository<TempStorage, Long>, TempStorageRepositoryCustom {

    /** 인스턴스 PK 로 임시보관 행 조회(relocate 시 삭제 대상). instance_id 는 UK 라 최대 1건. */
    Optional<TempStorage> findByInstanceId(Long instanceId);
}
