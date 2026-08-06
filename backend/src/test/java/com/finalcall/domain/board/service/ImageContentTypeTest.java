package com.finalcall.domain.board.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * 이미지 매직바이트 판정 단위 검증(EPIC-BOARD, FC-200, board-spec §7.2). MIME 은 확장자·헤더가 아니라 실제 콘텐츠
 * 선두 바이트로 판정한다(스푸핑 방지) — 화이트리스트(jpeg·png·webp·gif)만 통과하고 그 외는 empty(→ IMAGE_001).
 */
class ImageContentTypeTest {

    @Test
    void JPEG_매직바이트를_판정한다() {
        byte[] jpeg = {(byte)0xFF, (byte)0xD8, (byte)0xFF, (byte)0xE0, 0, 0};
        assertThat(ImageContentType.sniff(jpeg)).contains(ImageContentType.JPEG);
        assertThat(ImageContentType.JPEG.mimeType()).isEqualTo("image/jpeg");
        assertThat(ImageContentType.JPEG.extension()).isEqualTo("jpg");
    }

    @Test
    void PNG_매직바이트를_판정한다() {
        byte[] png = {(byte)0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
        assertThat(ImageContentType.sniff(png)).contains(ImageContentType.PNG);
        assertThat(ImageContentType.PNG.extension()).isEqualTo("png");
    }

    @Test
    void GIF_매직바이트를_판정한다() {
        byte[] gif = {0x47, 0x49, 0x46, 0x38, 0x39, 0x61};
        assertThat(ImageContentType.sniff(gif)).contains(ImageContentType.GIF);
        assertThat(ImageContentType.GIF.extension()).isEqualTo("gif");
    }

    @Test
    void WEBP_매직바이트를_판정한다() {
        byte[] webp = {0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50};
        assertThat(ImageContentType.sniff(webp)).contains(ImageContentType.WEBP);
        assertThat(ImageContentType.WEBP.extension()).isEqualTo("webp");
    }

    @Test
    void 화이트리스트_밖_콘텐츠는_판정불가다() {
        assertThat(ImageContentType.sniff("plain text".getBytes())).isEmpty();
        assertThat(ImageContentType.sniff(new byte[0])).isEmpty();
        assertThat(ImageContentType.sniff(null)).isEmpty();
        // RIFF 이지만 WEBP 가 아닌(예: WAV) 콘텐츠는 거부.
        byte[] wav = {0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45};
        assertThat(ImageContentType.sniff(wav)).isEmpty();
    }

    @Test
    void 선두바이트가_짧으면_판정불가다() {
        Optional<ImageContentType> result = ImageContentType.sniff(new byte[] {(byte)0xFF, (byte)0xD8});
        assertThat(result).isEmpty();
    }
}
