package com.finalcall.common.util;

/**
 * 닉네임 마스킹 규약(SEC-007 회원 열거 방지) — <b>앞 2자 + {@code ***}</b>.
 *
 * <p>계약 §3.3 은 {@code highestBidderMasked} 와 {@code BidSummary.bidderMasked} 를 "동일 규약"으로 못 박는다.
 * 규약이 두 곳에 복제되면 한쪽만 바뀌는 드리프트가 생기고, 그 드리프트는 곧 <b>식별정보 노출</b>이라 조용히
 * 위험해진다 — 그래서 표현 계층이 아니라 공용 유틸에 단일 구현으로 둔다.
 *
 * <p>프레임워크 의존 없는 순수 Java 다(CLAUDE.md 섹션 4 — common 은 최소 의존).
 */
public final class NicknameMasker {

    /** 마스킹 접미사. 원문 길이를 노출하지 않도록 고정 길이다. */
    private static final String SUFFIX = "***";
    /** 노출 허용 접두 길이. */
    private static final int PREFIX_LENGTH = 2;

    private NicknameMasker() {
    }

    /**
     * 닉네임을 마스킹한다. 1자 닉네임은 1자 + {@code ***} 가 되며, null·빈 문자열은 {@code ***} 로 접는다
     * (분기 결과가 "값 없음"과 구분되지 않게 해 존재 여부 누설을 막는다).
     *
     * @param nickname 원문 닉네임(null 허용)
     * @return 마스킹된 표시 문자열
     */
    public static String mask(String nickname) {
        if (nickname == null || nickname.isEmpty()) {
            return SUFFIX;
        }
        return nickname.substring(0, Math.min(PREFIX_LENGTH, nickname.length())) + SUFFIX;
    }
}
