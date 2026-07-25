package com.finalcall.domain.search.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;

/**
 * 검색 커서 코덱 단위 검증(search, 계약 C2 · search-spec §12.7). encode↔decode 라운드트립과 손상 커서 400 을 확인한다
 * (Testcontainers 불요 — 순수 코덱). relevance 정렬의 안정 타이브레이커 {@code (score, publicId)} 를 opaque 문자열로
 * 실어 나르는지 검증한다.
 */
class SearchCursorTest {

    @Test
    void 첫_페이지_커서는_경계가_없다() {
        SearchCursor first = SearchCursor.first();
        assertThat(first.isFirstPage()).isTrue();
        assertThat(first.publicId()).isNull();
        assertThat(first.score()).isNull();
    }

    @Test
    void null_이나_빈문자열은_첫_페이지로_해석한다() {
        assertThat(SearchCursor.decode(null).isFirstPage()).isTrue();
        assertThat(SearchCursor.decode("").isFirstPage()).isTrue();
        assertThat(SearchCursor.decode("   ").isFirstPage()).isTrue();
    }

    @Test
    void encode_한_커서를_decode_하면_score_와_publicId_가_복원된다() {
        String encoded = SearchCursor.encode(3.5d, "01H8XABCDEF01H8XABCDEF0123");

        SearchCursor decoded = SearchCursor.decode(encoded);

        assertThat(decoded.isFirstPage()).isFalse();
        assertThat(decoded.score()).isEqualTo(3.5d);
        assertThat(decoded.publicId()).isEqualTo("01H8XABCDEF01H8XABCDEF0123");
    }

    @Test
    void 손상된_커서는_COMMON_001_로_거부한다() {
        assertThatThrownBy(() -> SearchCursor.decode("!!!not-base64!!!"))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(CommonErrorCode.INVALID_INPUT);
    }

    @Test
    void 구분자가_없는_커서는_COMMON_001_로_거부한다() {
        String noDelimiter = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString("nodelimiter".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertThatThrownBy(() -> SearchCursor.decode(noDelimiter))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(CommonErrorCode.INVALID_INPUT);
    }
}
