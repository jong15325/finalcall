package com.finalcall.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

import com.finalcall.support.IntegrationTest;

/**
 * 게시판 조회 API 통합 검증(EPIC-BOARD, FC-197) — 실제 MySQL(Testcontainers) + Flyway V22 시드 3건 + Security 필터.
 * 계약 api §6.1. 목록 정렬순·응답 형상·공개 접근(인증 불요)·slug 미존재/비활성 {@code BOARD_001}(404)을 고정한다.
 *
 * <p>시드(V22)는 Flyway 가 심으므로 별도 픽스처가 없다. 읽기 전용이라 {@code @Transactional} 롤백으로 격리된다.
 */
class BoardApiIntegrationTest extends IntegrationTest {

    private static final String BOARDS_URL = "/api/v1/boards";

    @Test
    void 게시판_목록은_인증없이_활성_시드3건을_정렬순으로_반환한다() throws Exception {
        mockMvc.perform(get(BOARDS_URL))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.boards.length()").value(3))
            // sort_order asc: notice(0) → community(1) → event(2)
            .andExpect(jsonPath("$.data.boards[0].slug").value("notice"))
            .andExpect(jsonPath("$.data.boards[0].boardType").value("NOTICE"))
            .andExpect(jsonPath("$.data.boards[0].writePolicy").value("ADMIN_ONLY"))
            .andExpect(jsonPath("$.data.boards[0].allowComments").value(false))
            .andExpect(jsonPath("$.data.boards[1].slug").value("community"))
            .andExpect(jsonPath("$.data.boards[1].writePolicy").value("AUTHENTICATED"))
            .andExpect(jsonPath("$.data.boards[1].allowComments").value(true))
            .andExpect(jsonPath("$.data.boards[2].slug").value("event"))
            .andExpect(jsonPath("$.data.boards[2].boardType").value("EVENT"))
            // 활성 게이팅 필드(is_active)는 응답에 노출하지 않는다.
            .andExpect(jsonPath("$.data.boards[0].isActive").doesNotExist());
    }

    @Test
    void 게시판_단건은_slug로_공개조회된다() throws Exception {
        mockMvc.perform(get(BOARDS_URL + "/community"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.slug").value("community"))
            .andExpect(jsonPath("$.data.name").value("커뮤니티"))
            .andExpect(jsonPath("$.data.boardType").value("GENERAL"))
            .andExpect(jsonPath("$.data.writePolicy").value("AUTHENTICATED"))
            .andExpect(jsonPath("$.data.allowComments").value(true));
    }

    @Test
    void 존재하지않는_slug는_404_BOARD_001이다() throws Exception {
        mockMvc.perform(get(BOARDS_URL + "/nonexistent"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("BOARD_001"));
    }
}
