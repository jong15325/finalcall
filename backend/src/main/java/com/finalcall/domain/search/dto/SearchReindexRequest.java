package com.finalcall.domain.search.dto;

import jakarta.validation.constraints.Pattern;

/** 관리자 검색 재색인 요청. mode 생략 시 IN_PLACE다. */
public record SearchReindexRequest(
    @Pattern(regexp = "IN_PLACE|REBUILD", message = "mode는 IN_PLACE 또는 REBUILD여야 합니다.") String mode) {
}
