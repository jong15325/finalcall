package com.finalcall.domain.search.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.search.dto.SearchReindexAcceptedResponse;
import com.finalcall.domain.search.dto.SearchReindexRequest;
import com.finalcall.domain.search.dto.SearchReindexResponse;
import com.finalcall.domain.search.service.SearchReindexJob;
import com.finalcall.domain.search.service.SearchReindexMode;
import com.finalcall.domain.search.service.SearchReindexService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** 관리자 전용 검색 재색인 API. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/search")
public class AdminSearchController {

    private final SearchReindexService searchReindexService;

    @PostMapping("/reindex")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ApiResponse<SearchReindexAcceptedResponse> reindex(
        @Valid @RequestBody(required = false) SearchReindexRequest request) {
        SearchReindexMode mode = request == null || request.mode() == null
            ? SearchReindexMode.IN_PLACE
            : SearchReindexMode.valueOf(request.mode());
        SearchReindexJob job = searchReindexService.start(mode);
        return ApiResponse.success(new SearchReindexAcceptedResponse(job.jobId()));
    }

    @GetMapping("/reindex/{jobId}")
    public ApiResponse<SearchReindexResponse> status(@PathVariable String jobId) {
        SearchReindexJob job = searchReindexService.get(jobId);
        return ApiResponse.success(SearchReindexResponse.builder()
            .jobId(job.jobId())
            .mode(job.mode().name())
            .state(job.state().name())
            .startedAt(job.startedAt())
            .finishedAt(job.finishedAt())
            .targetIndex(job.targetIndex())
            .indexedCount(job.indexedCount())
            .aliasSwitched(job.aliasSwitched())
            .error(job.error())
            .build());
    }
}
