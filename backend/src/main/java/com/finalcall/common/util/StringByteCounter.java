package com.finalcall.common.util;

/**
 * 게임 클라이언트 고정폭 렌더용 바이트 폭 계산기(memo, EPIC-MEMO §8.3). 레거시 {@code GetStringByteManager.getStringByte}
 * 규칙을 그대로 이식한다 — 게임 인게임 쪽지 팝업의 28바이트 자동 줄바꿈·닉 16바이트 폭과 <b>동일한 metric</b>이라야
 * 프론트 미리보기(FC-172)·향후 게임 boundary auto-wrap 이 게임 렌더와 일치한다.
 *
 * <p>문자별 폭: <b>숫자(코드 48~57)·ASCII 영문대역(코드 65~122) = 1바이트</b>, <b>그 외(한글 등) = 2바이트</b>.
 * 65~122 대역은 일부 기호([ \ ] ^ _ ` 등)를 포함하나 레거시 규칙을 형상 그대로 보존한다(게임 boundary 결과 일치가 목적).
 *
 * <p>이 클래스는 저장 형태가 아니라 표시 폭 계약만 계산한다 — finalcall 은 순수 원문을 저장하고(memo-domain-spec §8),
 * 웹 발신 입력폭을 {@code getStringByte ≤ 112}(=4×28)로 검증하는 데 쓴다.
 */
public final class StringByteCounter {

    /** 폭 1바이트로 세는 코드 하한(숫자 '0'). */
    private static final int DIGIT_LOWER = 48;
    /** 폭 1바이트로 세는 코드 상한(숫자 '9'). */
    private static final int DIGIT_UPPER = 57;
    /** 폭 1바이트로 세는 ASCII 영문대역 하한(레거시 규칙). */
    private static final int ASCII_LOWER = 65;
    /** 폭 1바이트로 세는 ASCII 영문대역 상한(레거시 규칙). */
    private static final int ASCII_UPPER = 122;

    private StringByteCounter() {
    }

    /**
     * 게임 렌더 폭(바이트)을 계산한다. 레거시 {@code getStringByte} 규칙과 동일하다.
     *
     * @param value 대상 문자열({@code null} 은 0으로 처리)
     * @return 게임 고정폭 metric 기준 바이트 폭 합
     */
    public static int getStringByte(String value) {
        if (value == null) {
            return 0;
        }
        int total = 0;
        for (int i = 0; i < value.length(); i++) {
            total += charByteWidth(value.charAt(i));
        }
        return total;
    }

    /**
     * 문자열을 게임 고정폭 metric(=이 클래스의 {@link #getStringByte} 폭)으로 {@code maxByteWidth} 이하까지만 남기고 절단한다
     * (memo-domain-spec §8.2 — 30자 닉 스냅샷 시 16바이트 절단으로 게임 {@code char(16)} 렌더 폭·저장 컬럼 폭 보존).
     *
     * <p>절단은 <b>글자 중간을 깨지 않는다</b>(§8.2·§8.3) — 한 글자를 더하면 상한을 넘길 때 그 글자부터 버린다(한글 2바이트가
     * 홀수 경계에 걸리면 그 글자를 통째로 제외). 보충문자(서로게이트 페어)도 한 글자로 취급해 페어 중간에서 자르지 않는다
     * (불완전 UTF-16 방지). 폭 metric 은 {@link #getStringByte} 와 동일하다.
     *
     * @param value        대상 문자열({@code null} 은 그대로 {@code null})
     * @param maxByteWidth 허용 최대 바이트 폭(음수면 빈 문자열)
     * @return 폭이 {@code maxByteWidth} 이하가 되도록 접미를 제거한 문자열
     */
    public static String truncateToByteWidth(String value, int maxByteWidth) {
        if (value == null) {
            return null;
        }
        int total = 0;
        int end = 0;
        while (end < value.length()) {
            char ch = value.charAt(end);
            boolean pair = Character.isHighSurrogate(ch) && end + 1 < value.length()
                && Character.isLowSurrogate(value.charAt(end + 1));
            int glyphWidth = charByteWidth(ch) + (pair ? charByteWidth(value.charAt(end + 1)) : 0);
            if (total + glyphWidth > maxByteWidth) {
                break;
            }
            total += glyphWidth;
            end += pair ? 2 : 1;
        }
        return value.substring(0, end);
    }

    /** 문자 1개의 게임 고정폭(숫자·ASCII 영문대역=1, 그 외=2). {@link #getStringByte}·{@link #truncateToByteWidth} 공통. */
    private static int charByteWidth(char ch) {
        boolean singleByte = (ch >= DIGIT_LOWER && ch <= DIGIT_UPPER) || (ch >= ASCII_LOWER && ch <= ASCII_UPPER);
        return singleByte ? 1 : 2;
    }
}
