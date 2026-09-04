package com.finalcall.infra.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.member.entity.AccountType;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

class DemoRiskyWriteFilterTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void demo의_위험_쓰기는_AUTH_011이고_조회는_허용한다() throws Exception {
        UserRepository users = mock(UserRepository.class);
        User demo = mock(User.class);
        when(demo.getAccountType()).thenReturn(AccountType.DEMO);
        when(users.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(demo));
        DemoRiskyWriteFilter filter = new DemoRiskyWriteFilter(users,
            new ObjectMapper().findAndRegisterModules());
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("1", null));
        MockHttpServletResponse denied = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest("POST", "/api/v1/auctions"), denied,
            (request, response) -> {
                throw new AssertionError("위험 쓰기가 통과했습니다.");
            });
        assertThat(denied.getContentAsString()).contains("AUTH_011");

        MockHttpServletResponse allowed = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/api/v1/auctions"), allowed,
            (request, response) -> ((jakarta.servlet.http.HttpServletResponse)response).setStatus(204));
        assertThat(allowed.getStatus()).isEqualTo(204);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/me", "/api/v1/me/email", "/api/v1/me/money/charge",
        "/api/v1/me/temp-storage/item/relocate", "/api/v1/me/memos", "/api/v1/me/chat-rooms/direct/messages",
        "/api/v1/auctions", "/api/v1/auctions/a/bids", "/api/v1/auctions/a/purchase",
        "/api/v1/shops", "/api/v1/shops/s/purchase", "/api/v1/boards/b/posts",
        "/api/v1/posts/p/comments", "/api/v1/board-images", "/api/v1/admin/users", "/api/v1/exchanges"})
    void 계약의_위험_쓰기_경로는_모두_차단한다(String path) throws Exception {
        assertThat(invoke("POST", path)).contains("AUTH_011");
    }

    @ParameterizedTest
    @CsvSource({"POST,/api/v1/auth/refresh", "POST,/api/v1/auth/logout", "GET,/api/v1/exchanges",
        "PUT,/api/v1/me/chat-rooms/room/read"})
    void refresh_logout_조회와_읽음전이는_허용한다(String method, String path) throws Exception {
        assertThat(invoke(method, path)).isEmpty();
    }

    private String invoke(String method, String path) throws Exception {
        UserRepository users = mock(UserRepository.class);
        User demo = mock(User.class);
        when(demo.getAccountType()).thenReturn(AccountType.DEMO);
        when(users.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(demo));
        DemoRiskyWriteFilter filter = new DemoRiskyWriteFilter(users,
            new ObjectMapper().findAndRegisterModules());
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("1", null));
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest(method, path), response, (request, servletResponse) -> {
            // 허용 경로는 빈 응답으로 체인 통과 여부를 표현한다.
        });
        return response.getContentAsString();
    }
}
