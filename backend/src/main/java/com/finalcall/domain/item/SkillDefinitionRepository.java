package com.finalcall.domain.item;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 스킬 정의 리포지토리(item, FC-020). 조회 전용 마스터라 커스텀 쿼리는 두지 않는다(필요 시 QueryDSL 로 분리).
 */
public interface SkillDefinitionRepository extends JpaRepository<SkillDefinition, Long> {

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default SkillDefinition findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
