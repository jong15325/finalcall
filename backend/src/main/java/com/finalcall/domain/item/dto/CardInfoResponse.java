package com.finalcall.domain.item.dto;

import java.time.Instant;
import java.util.List;

import lombok.Builder;

@Builder
public record CardInfoResponse(
    int level,
    String shortName,
    String formalName,
    Category category,
    Kind kind,
    Element element,
    ChannelLimit channelLimit,
    Frame frame,
    List<Skill> skills,
    Instant calculatedAt,
    Instant validUntil) {

    public record Category(int code, String label) {
    }

    public record Kind(int code, String label, String abbreviation) {
    }

    public record Element(int code, String label, String abbreviation) {
    }

    public record ChannelLimit(String code, String label) {
    }

    public record Frame(String type, String label, int remainingGoldforceDays) {
    }

    public record Skill(int slot, Integer code, String name, Integer percent) {
    }
}
