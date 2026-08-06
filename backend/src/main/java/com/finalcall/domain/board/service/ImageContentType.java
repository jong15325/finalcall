package com.finalcall.domain.board.service;

import java.util.Optional;

/**
 * 허용 이미지 형식과 매직바이트 판정(EPIC-BOARD, FC-200, board-spec §7.2·§7.3) — 서비스 내부 계산 VO(영속·직렬화 아님,
 * V2 §9.10 → {@code service/} 잔류).
 *
 * <p>MIME 은 클라가 보낸 확장자·헤더가 아니라 <b>실제 콘텐츠 매직바이트</b>로 판정한다(스푸핑 방지). 화이트리스트는 계약
 * §7.2 = jpeg·png·webp·gif. {@code extension} 은 storage_key(`board/{yyyy}/{MM}/{ulid}.{ext}`) 확장자 매핑이다.
 */
public enum ImageContentType {

    JPEG("image/jpeg", "jpg"),
    PNG("image/png", "png"),
    WEBP("image/webp", "webp"),
    GIF("image/gif", "gif");

    private final String mimeType;
    private final String extension;

    ImageContentType(String mimeType, String extension) {
        this.mimeType = mimeType;
        this.extension = extension;
    }

    public String mimeType() {
        return mimeType;
    }

    public String extension() {
        return extension;
    }

    /**
     * 콘텐츠 선두 바이트로 이미지 형식을 판정한다(매직바이트 sniff). 화이트리스트 밖·판정 불가면 empty →
     * 호출부가 {@code IMAGE_001}(422)로 거부한다.
     *
     * @param content 업로드 원본 바이트
     * @return 판정된 형식(화이트리스트 내) 또는 empty
     */
    public static Optional<ImageContentType> sniff(byte[] content) {
        if (content == null) {
            return Optional.empty();
        }
        if (isJpeg(content)) {
            return Optional.of(JPEG);
        }
        if (isPng(content)) {
            return Optional.of(PNG);
        }
        if (isGif(content)) {
            return Optional.of(GIF);
        }
        if (isWebp(content)) {
            return Optional.of(WEBP);
        }
        return Optional.empty();
    }

    /** JPEG: FF D8 FF. */
    private static boolean isJpeg(byte[] bytes) {
        return bytes.length >= 3 && unsigned(bytes[0]) == 0xFF && unsigned(bytes[1]) == 0xD8
            && unsigned(bytes[2]) == 0xFF;
    }

    /** PNG: 89 50 4E 47 0D 0A 1A 0A. */
    private static boolean isPng(byte[] bytes) {
        return bytes.length >= 8 && unsigned(bytes[0]) == 0x89 && unsigned(bytes[1]) == 0x50
            && unsigned(bytes[2]) == 0x4E && unsigned(bytes[3]) == 0x47 && unsigned(bytes[4]) == 0x0D
            && unsigned(bytes[5]) == 0x0A && unsigned(bytes[6]) == 0x1A && unsigned(bytes[7]) == 0x0A;
    }

    /** GIF: "GIF8" (47 49 46 38). */
    private static boolean isGif(byte[] bytes) {
        return bytes.length >= 4 && unsigned(bytes[0]) == 0x47 && unsigned(bytes[1]) == 0x49
            && unsigned(bytes[2]) == 0x46 && unsigned(bytes[3]) == 0x38;
    }

    /** WEBP: "RIFF"(0..3) .... "WEBP"(8..11). */
    private static boolean isWebp(byte[] bytes) {
        return bytes.length >= 12 && unsigned(bytes[0]) == 0x52 && unsigned(bytes[1]) == 0x49
            && unsigned(bytes[2]) == 0x46 && unsigned(bytes[3]) == 0x46 && unsigned(bytes[8]) == 0x57
            && unsigned(bytes[9]) == 0x45 && unsigned(bytes[10]) == 0x42 && unsigned(bytes[11]) == 0x50;
    }

    private static int unsigned(byte value) {
        return value & 0xFF;
    }
}
