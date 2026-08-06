package com.finalcall.domain.board.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.board.dto.BoardImageUploadResponse;
import com.finalcall.domain.board.service.PostImageService;

import lombok.RequiredArgsConstructor;

/**
 * 게시글 이미지 업로드 컨트롤러(EPIC-BOARD, FC-200, api §6.4) — {@code POST /api/v1/board-images}. 2단계 업로드의 1단계
 * (고아 업로드), 게시글 저장 시 {@code imagePublicIds[]} 로 귀속한다.
 *
 * <p>인증 필요(주체=SecurityContext) — SecurityConfig 의 {@code anyRequest().authenticated()} 가 강제한다(공개 GET
 * 화이트리스트에 없음, §6.5). multipart 파트 {@code file} 단일 이미지를 받아 검증·저장·presigned GET URL 을 반환한다.
 * 반환은 {@link ApiResponse}, try-catch 금지(전역 핸들러 — IMAGE_001/002 는 BusinessException 으로 매핑).
 */
@RestController
@RequiredArgsConstructor
public class BoardImageController {

    private final PostImageService postImageService;

    /** 이미지 업로드 — 인증 필요. 성공 201 {@code { imagePublicId, url }}. 미허용 형식 IMAGE_001·용량 초과 IMAGE_002(422). */
    @PostMapping("/api/v1/board-images")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<BoardImageUploadResponse> upload(@RequestParam("file") MultipartFile file) {
        return ApiResponse.success(postImageService.upload(file));
    }
}
