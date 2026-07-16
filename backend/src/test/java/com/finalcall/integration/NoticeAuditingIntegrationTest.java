package com.finalcall.integration;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.support.IntegrationTest;

/**
 * 작성자 Auditing(createdBy) 통합 검증(Stage F2, F1 연계).
 *
 * <p>인증 컨텍스트에서는 createdBy 가 기록되고, 비인증(익명)에서는 null 임을 실제 DB(Testcontainers)로 확인한다.
 * MockMvc 로 전체 스택(컨트롤러→서비스→커밋)을 거치므로 @Transactional 롤백은 쓰지 않는다(생성 id 로만 조회).
 */
class NoticeAuditingIntegrationTest extends IntegrationTest {

    private static final String CREATE_BODY = "{\"title\":\"감사 테스트\",\"content\":\"내용\",\"type\":\"GENERAL\"}";

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser(username = "author-1")
    void 인증_컨텍스트에서_createdBy_기록() throws Exception {
        long id = createNotice();
        mockMvc.perform(get("/notices/" + id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.createdBy").value("author-1"));
    }

    @Test
    void 비인증_생성시_createdBy_는_null() throws Exception {
        long id = createNotice();
        mockMvc.perform(get("/notices/" + id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.createdBy").value(nullValue()));
    }

    private long createNotice() throws Exception {
        String response = mockMvc.perform(post("/notices")
            .contentType(MediaType.APPLICATION_JSON)
            .content(CREATE_BODY))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        return node.get("data").asLong();
    }
}
