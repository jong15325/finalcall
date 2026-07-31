package com.finalcall.common.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * 바이트 폭 계산기 단위 테스트(memo, §8.3) — 레거시 {@code GetStringByteManager.getStringByte} 규칙 이식 검증.
 *
 * <p>규칙: 숫자(48~57)·ASCII 영문대역(65~122) = 1바이트, 그 외(한글 등) = 2바이트. 이 metric 이 게임 boundary·프론트
 * 미리보기와 일치해야 하므로 경계 코드값·혼합 문자열·112바이트 상한을 못 박는다.
 */
class StringByteCounterTest {

    @Test
    void null_과_빈문자열은_0바이트다() {
        assertThat(StringByteCounter.getStringByte(null)).isZero();
        assertThat(StringByteCounter.getStringByte("")).isZero();
    }

    @Test
    void 숫자와_영문은_각_1바이트다() {
        assertThat(StringByteCounter.getStringByte("12345")).isEqualTo(5);
        assertThat(StringByteCounter.getStringByte("abcXYZ")).isEqualTo(6);
    }

    @Test
    void 한글은_각_2바이트다() {
        assertThat(StringByteCounter.getStringByte("가나다")).isEqualTo(6);
    }

    @Test
    void 한영숫자_혼합은_규칙대로_합산된다() {
        // 'a'(1) + '1'(1) + '가'(2) = 4
        assertThat(StringByteCounter.getStringByte("a1가")).isEqualTo(4);
        // "안녕hi12"(2+2+1+1+1+1) = 8
        assertThat(StringByteCounter.getStringByte("안녕hi12")).isEqualTo(8);
    }

    /**
     * 레거시 코드 범위 경계 — 48~57·65~122 만 1바이트, 그 밖의 ASCII 기호는 2바이트로 센다(형상 보존).
     */
    @ParameterizedTest(name = "[{0}] = {1}바이트")
    @CsvSource({
        "'/', 2", // 47 — 숫자 대역 직전
        "'0', 1", // 48 — 숫자 하한
        "'9', 1", // 57 — 숫자 상한
        "':', 2", // 58 — 숫자 대역 직후
        "'@', 2", // 64 — 영문 대역 직전
        "'A', 1", // 65 — 영문 대역 하한
        "'z', 1", // 122 — 영문 대역 상한
        "'{', 2", // 123 — 영문 대역 직후
        "' ', 2", // 공백(32) — 2바이트
    })
    void 경계_코드값별_폭(String ch, int expected) {
        assertThat(StringByteCounter.getStringByte(ch)).isEqualTo(expected);
    }

    @Test
    void 한글_56자는_정확히_112바이트로_상한과_같다() {
        String body = "가".repeat(56);
        assertThat(StringByteCounter.getStringByte(body)).isEqualTo(112);
    }

    @Test
    void 한글_57자는_114바이트로_상한을_넘는다() {
        String body = "가".repeat(57);
        assertThat(StringByteCounter.getStringByte(body)).isEqualTo(114);
    }

    @Test
    void 상한이하_문자열은_절단없이_원문을_반환한다() {
        assertThat(StringByteCounter.truncateToByteWidth("가나다", 16)).isEqualTo("가나다"); // 6바이트 ≤ 16
        assertThat(StringByteCounter.truncateToByteWidth("abcdefgh", 16)).isEqualTo("abcdefgh"); // 8바이트 ≤ 16
    }

    @Test
    void null_은_그대로_null이다() {
        assertThat(StringByteCounter.truncateToByteWidth(null, 16)).isNull();
    }

    @Test
    void 한글은_16바이트_경계에서_글자단위로_절단된다() {
        // 20자 한글(40바이트) → 16바이트 = 8자에서 끊긴다(글자 중간 절단 없음, §8.2)
        String result = StringByteCounter.truncateToByteWidth("가".repeat(20), 16);
        assertThat(result).isEqualTo("가".repeat(8));
        assertThat(StringByteCounter.getStringByte(result)).isEqualTo(16);
    }

    @Test
    void 홀수경계에_한글이_걸리면_그_글자를_통째로_제외한다() {
        // "a"(1) + 한글×8(16) = 17바이트. 상한 16 → 'a' 뒤 한글 7자(14)까지만, 8번째 한글은 15→17 초과라 제외
        String value = "a" + "가".repeat(8);
        String result = StringByteCounter.truncateToByteWidth(value, 16);
        assertThat(result).isEqualTo("a" + "가".repeat(7)); // 폭 15, 한글 반토막 없음
        assertThat(StringByteCounter.getStringByte(result)).isEqualTo(15);
    }

    @Test
    void 영문은_16바이트_경계에서_16자로_절단된다() {
        assertThat(StringByteCounter.truncateToByteWidth("a".repeat(30), 16)).isEqualTo("a".repeat(16));
    }
}
