package com.finalcall.common.util;

import java.security.SecureRandom;

/**
 * ULID(Universally Unique Lexicographically Sortable Identifier) 생성 유틸(auth 도입).
 *
 * <p>외부 노출 식별자 {@code public_id}(B-004) 생성에 쓴다. 26자 Crockford Base32 문자열이며,
 * 앞 10자는 밀리초 타임스탬프(48비트)·뒤 16자는 난수(80비트)라 <b>시간순 정렬 가능</b>하다.
 * 내부 PK({@code id BIGINT})는 여전히 auto-increment 를 쓰고, ULID 는 URL·응답용 외부 식별자 전용이다.
 *
 * <p>DB 컬럼은 {@code CHAR(26)}(erd 정합). 별도 라이브러리 없이 <a href="https://github.com/ulid/spec">ULID
 * 스펙</a>의 표준 인코딩을 직접 구현한다.
 */
public final class Ulid {

    /** Crockford Base32 인코딩 알파벳(가독성을 위해 I·L·O·U 제외). */
    private static final char[] ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();

    private static final SecureRandom RANDOM = new SecureRandom();

    private Ulid() {
    }

    /**
     * 새 ULID 문자열(26자)을 생성한다.
     *
     * @return Crockford Base32 로 인코딩된 26자 ULID
     */
    public static String generate() {
        long time = System.currentTimeMillis();

        byte[] bytes = new byte[10];
        RANDOM.nextBytes(bytes);
        int[] e = new int[10];
        for (int i = 0; i < 10; i++) {
            e[i] = bytes[i] & 0xFF;
        }

        char[] chars = new char[26];
        // 타임스탬프 48비트 → 앞 10자(시간순 정렬성의 근거).
        chars[0] = ENCODING[(int) ((time >>> 45) & 0x1F)];
        chars[1] = ENCODING[(int) ((time >>> 40) & 0x1F)];
        chars[2] = ENCODING[(int) ((time >>> 35) & 0x1F)];
        chars[3] = ENCODING[(int) ((time >>> 30) & 0x1F)];
        chars[4] = ENCODING[(int) ((time >>> 25) & 0x1F)];
        chars[5] = ENCODING[(int) ((time >>> 20) & 0x1F)];
        chars[6] = ENCODING[(int) ((time >>> 15) & 0x1F)];
        chars[7] = ENCODING[(int) ((time >>> 10) & 0x1F)];
        chars[8] = ENCODING[(int) ((time >>> 5) & 0x1F)];
        chars[9] = ENCODING[(int) (time & 0x1F)];
        // 난수 80비트 → 뒤 16자(5비트씩 재배열).
        chars[10] = ENCODING[e[0] >>> 3];
        chars[11] = ENCODING[((e[0] & 0x07) << 2) | (e[1] >>> 6)];
        chars[12] = ENCODING[(e[1] & 0x3E) >>> 1];
        chars[13] = ENCODING[((e[1] & 0x01) << 4) | (e[2] >>> 4)];
        chars[14] = ENCODING[((e[2] & 0x0F) << 1) | (e[3] >>> 7)];
        chars[15] = ENCODING[(e[3] & 0x7C) >>> 2];
        chars[16] = ENCODING[((e[3] & 0x03) << 3) | (e[4] >>> 5)];
        chars[17] = ENCODING[e[4] & 0x1F];
        chars[18] = ENCODING[e[5] >>> 3];
        chars[19] = ENCODING[((e[5] & 0x07) << 2) | (e[6] >>> 6)];
        chars[20] = ENCODING[(e[6] & 0x3E) >>> 1];
        chars[21] = ENCODING[((e[6] & 0x01) << 4) | (e[7] >>> 4)];
        chars[22] = ENCODING[((e[7] & 0x0F) << 1) | (e[8] >>> 7)];
        chars[23] = ENCODING[(e[8] & 0x7C) >>> 2];
        chars[24] = ENCODING[((e[8] & 0x03) << 3) | (e[9] >>> 5)];
        chars[25] = ENCODING[e[9] & 0x1F];

        return new String(chars);
    }
}
