package com.finalcall.domain.search.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.SearchErrorCode;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.domain.search.service.SearchReindexJob;
import com.finalcall.domain.search.service.SearchReindexMode;
import com.finalcall.domain.search.service.SearchReindexService;
import com.finalcall.infra.config.GatewayInternalProperties;
import com.finalcall.infra.config.SecurityConfig;
import com.finalcall.infra.security.JwtAccessDeniedHandler;
import com.finalcall.infra.security.JwtAuthenticationEntryPoint;

@WebMvcTest(AdminSearchController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class,
    AdminSearchControllerTest.SecurityTestBeans.class})
class AdminSearchControllerTest {

    private static final String URL = "/api/v1/admin/search/reindex";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SearchReindexService searchReindexService;

    @MockBean
    private TokenProvider tokenProvider;

    @Test
    void 미인증은_401_일반회원은_403_관리자는_202다() throws Exception {
        when(searchReindexService.start(any()))
            .thenReturn(SearchReindexJob.pending("01TEST", SearchReindexMode.IN_PLACE));

        mockMvc.perform(post(URL)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(URL).with(user("member"))).andExpect(status().isForbidden());
        mockMvc.perform(post(URL).with(user("admin")
            .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.data.jobId").value("01TEST"));
    }

    @Test
    void 잘못된_mode는_400이다() throws Exception {
        mockMvc.perform(post(URL)
            .with(user("admin").authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"mode\":\"UNKNOWN\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void 없는_job은_search_003_404다() throws Exception {
        when(searchReindexService.get("missing"))
            .thenThrow(new BusinessException(SearchErrorCode.SEARCH_REINDEX_JOB_NOT_FOUND));

        mockMvc.perform(get(URL + "/missing")
            .with(user("admin").authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("SEARCH_003"));
    }

    @TestConfiguration
    static class SecurityTestBeans {

        @Bean
        GatewayInternalProperties gatewayInternalProperties() {
            return new GatewayInternalProperties("test-secret", null, false);
        }
    }
}
