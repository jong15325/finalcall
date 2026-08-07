package com.finalcall.domain.search.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.PositiveOrZero;

/** 내부 검색 재색인 수명주기 설정. */
@Validated
@ConfigurationProperties(prefix = "search.reindex")
public record SearchReindexProperties(
    @PositiveOrZero long retainOldIndexMinutes) {
}
