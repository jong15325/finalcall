package com.finalcall.domain.notice.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 공지 유형(Stage D) — Enum 컨벤션 시연(@Getter @RequiredArgsConstructor + 한국어 description).
 * 저장은 {@code @Enumerated(EnumType.STRING)} 으로 이름을 저장한다.
 */
@Getter
@RequiredArgsConstructor
public enum NoticeType {

    GENERAL("일반"),
    EVENT("이벤트"),
    URGENT("긴급");

    private final String description;
}
