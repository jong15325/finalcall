package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * 실 오브젝트 스토리지(MinIO Testcontainer, S3 호환) 종단 검증(EPIC-BOARD, FC-200, board-spec §7.4·§7.6 · 게이트2 (a)).
 *
 * <p>{@code @MockBean} 이 아닌 <b>실제 {@link com.finalcall.infra.storage.S3StoragePort}</b> 로 MinIO 에 PUT 하고,
 * 응답의 presigned GET URL 을 실제 HTTP GET 해 바이트가 왕복 일치함을 확인한다 — 버킷 자동 생성(ensure-bucket)·SigV4
 * presign·비공개 버킷 접근을 한 번에 고정한다. MySQL/Redis 는 base(Testcontainers) 공유, MinIO 만 이 테스트가 띄운다.
 *
 * <p>{@code @DynamicPropertySource} 로 base 의 {@code ensure-bucket-on-startup=false} 를 {@code true} 로 덮어 부팅 시
 * 버킷을 생성하게 한다(DynamicPropertySource 가 @TestPropertySource 보다 우선). Docker 필요 — 헤드리스에서 무거우면
 * 이 클래스만 비활성화하고 나머지(단위·MockBean 통합)로 커버한다.
 */
@Testcontainers
class BoardImageStorageIntegrationTest extends IntegrationTest {

    @Container
    static final MinIOContainer MINIO = new MinIOContainer("minio/minio:RELEASE.2024-10-13T13-34-11Z");

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registry.add("board.image.storage.endpoint", MINIO::getS3URL);
        registry.add("board.image.storage.access-key", MINIO::getUserName);
        registry.add("board.image.storage.secret-key", MINIO::getPassword);
        registry.add("board.image.storage.region", () -> "us-east-1");
        registry.add("board.image.storage.bucket", () -> "finalcall-board-images");
        registry.add("board.image.storage.path-style", () -> "true");
        registry.add("board.image.storage.presign-ttl", () -> "PT10M");
        // base 의 false 를 덮어 부팅 시 버킷 idempotent 생성을 켠다(DynamicPropertySource 우선).
        registry.add("board.image.storage.ensure-bucket-on-startup", () -> "true");
    }

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Test
    void 업로드한_이미지를_presigned_GET으로_원본과_동일하게_받아온다() throws Exception {
        User uploader = userRepository.save(
            User.builder().loginId("minio_up").passwordHash("hash").nickname("MinIO업로더").build());
        byte[] content = pngBytes(256);

        MockMultipartFile file = new MockMultipartFile("file", "real.png", "image/png", content);
        MvcResult result = mockMvc.perform(
            multipart("/api/v1/board-images").file(file).with(user(String.valueOf(uploader.getId()))))
            .andExpect(status().isCreated())
            .andReturn();

        JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).path("data");
        String imagePublicId = data.path("imagePublicId").asText();
        String presignedUrl = data.path("url").asText();
        assertThat(imagePublicId).isNotBlank();
        assertThat(presignedUrl).contains("finalcall-board-images").contains("X-Amz-Signature");

        HttpResponse<byte[]> fetched = HttpClient.newHttpClient().send(
            HttpRequest.newBuilder(URI.create(presignedUrl)).GET().build(),
            HttpResponse.BodyHandlers.ofByteArray());
        assertThat(fetched.statusCode()).isEqualTo(200);
        assertThat(fetched.body()).isEqualTo(content);
    }

    /** 선두를 PNG 매직바이트로 채운 length 바이트 콘텐츠(sniff 통과용). */
    private byte[] pngBytes(int length) {
        byte[] png = new byte[length];
        byte[] magic = {(byte)0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        System.arraycopy(magic, 0, png, 0, Math.min(magic.length, length));
        return png;
    }
}
