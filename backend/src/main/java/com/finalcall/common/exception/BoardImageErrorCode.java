package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 게시글 이미지 도메인 에러 코드(EPIC-BOARD, FC-200) — 공통 {@link ErrorCode} 구현체. 네이밍 {@code IMAGE_{3자리}}.
 * 배치는 V2 중앙화 규약대로 {@code com.finalcall.common.exception}(feature 루트 아님). 코드 표 정본 = api-contract §6.4·§5.
 *
 * <p>업로드 검증(MIME 화이트리스트·용량 상한)만 도메인 코드로 둔다(계약 §6.4). 게시글 저장 시 {@code imagePublicIds}
 * 바인딩 실패(미존재·타인 이미지·이미 다른 글에 바인딩됨)는 계약상 "검증 400"({@link CommonErrorCode#INVALID_INPUT})으로
 * 수렴한다 — 계약에 없는 도메인 코드를 새로 만들지 않는다(enum↔계약 1:1).
 *
 * <ul>
 *   <li>{@code IMAGE_001} — 지원하지 않는 이미지 형식(jpeg·png·webp·gif 외, 422). MIME 은 확장자가 아니라 실제 콘텐츠
 *       매직바이트로 판정한다(board-spec §7.2).
 *   <li>{@code IMAGE_002} — 이미지 용량 초과(>5MB, 422).
 * </ul>
 */
@Getter
@RequiredArgsConstructor
public enum BoardImageErrorCode implements ErrorCode {

    IMAGE_UNSUPPORTED_TYPE("IMAGE_001", HttpStatus.UNPROCESSABLE_ENTITY, "지원하지 않는 이미지 형식입니다."),
    IMAGE_TOO_LARGE("IMAGE_002", HttpStatus.UNPROCESSABLE_ENTITY, "이미지 용량이 허용 범위를 초과했습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
