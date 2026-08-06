package com.finalcall.infra.storage;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 게시글 이미지 오브젝트 스토리지 설정(EPIC-BOARD, FC-200, board-domain-spec §7.5·§7.7 · 게이트2 (a)).
 *
 * <p>스토리지는 S3 API 호환 단일 구현({@link S3StoragePort})이 endpoint 설정만으로 로컬 MinIO·운영 S3 를 모두 커버한다.
 * 인프라 어댑터(AWS SDK) 종속 설정이라 feature {@code config/} 가 아니라 커널 {@code infra} 에 둔다(CLAUDE.md §5·§9.9 —
 * cross-cutting Properties 는 인프라 종속=infra). 바인딩은 {@code @ConfigurationProperties}+{@code @Validated}(CLAUDE.md §4).
 *
 * <p>시크릿 fail-fast(CLAUDE.md §4): {@code accessKey}·{@code secretKey} 는 <b>선택</b>이다(공통 application.yml 에
 * 기본값을 두지 않음). 로컬은 application-local.yml 더미, 운영 S3 는 미주입(빈 값) → {@link S3StoragePort} 가 SDK 기본
 * 자격증명 체인(IAM 역할)을 쓴다. {@code region}·{@code bucket}·{@code presignTtl} 은 필수({@code @NotBlank}/{@code @NotNull}).
 *
 * @param endpoint    S3 API 엔드포인트(로컬 MinIO=http://localhost:9000). 비면 SDK region 기본 엔드포인트(운영 S3)
 * @param region      AWS region(SigV4 서명·엔드포인트 결정). MinIO 는 임의값이라도 서명 정합에만 쓰인다
 * @param bucket      비공개 버킷명(finalcall-board-images)
 * @param accessKey   액세스 키(선택 — 비면 SDK 기본 자격증명 체인=IAM 역할)
 * @param secretKey   시크릿 키(선택 — accessKey 와 쌍)
 * @param presignTtl  presigned GET 만료(ISO-8601 Duration, 기본 PT1H). 공개 콘텐츠라 넉넉히(캐시 친화)
 * @param pathStyle   path-style 접근(MinIO=true, 운영 S3=false 권장 virtual-hosted)
 */
@Validated
@ConfigurationProperties(prefix = "board.image.storage")
public record BoardImageStorageProperties(
    String endpoint,
    @NotBlank String region,
    @NotBlank String bucket,
    String accessKey,
    String secretKey,
    @NotNull Duration presignTtl,
    boolean pathStyle) {

    /** endpoint 가 지정됐는지(로컬 MinIO 는 지정·운영 S3 는 미지정 시 SDK region 기본 엔드포인트). */
    public boolean hasEndpoint() {
        return endpoint != null && !endpoint.isBlank();
    }

    /** 정적 자격증명(accessKey/secretKey)이 주어졌는지 — 아니면 SDK 기본 자격증명 체인(IAM 역할)을 쓴다. */
    public boolean hasStaticCredentials() {
        return accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank();
    }
}
