package com.finalcall.infra.storage;

import java.net.URI;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * 게시글 이미지 스토리지 인프라 조립(EPIC-BOARD, FC-200, board-domain-spec §7.5·§7.6).
 *
 * <p>{@link S3Client}(PUT/DELETE)·{@link S3Presigner}(presigned GET) 빈을 endpoint/자격증명/path-style 설정으로 만든다.
 * endpoint override 지정 시 로컬 MinIO, 미지정 시 운영 S3(region 기본 엔드포인트)를 커버한다. 자격증명은 정적 키가 있으면
 * 그것을, 없으면 SDK 기본 자격증명 체인(운영 IAM 역할)을 쓴다(시크릿 fail-fast — 공통 설정에 키 기본값 없음).
 *
 * <p>버킷 준비는 앱 부팅 시 idempotent 확인·생성({@link #ensureBoardImageBucket})으로 한다(런북 단순, §7.6). MinIO 미기동
 * (예: 스토리지 무관 통합 테스트)에서도 부팅을 막지 않도록 실패는 <b>경고 로깅으로 흡수</b>한다 — 실제 업로드 시점에
 * 스토리지가 없으면 그때 500 으로 드러난다. 통합 테스트 base 는 {@code ensure-bucket-on-startup=false} 로 이 러너를 끈다.
 */
@Slf4j
@Configuration
public class BoardImageStorageConfig {

    /** 부팅 시 버킷 확인·생성 러너 활성 플래그(설정 키). 통합 테스트 base 는 false 로 이 러너를 끈다. */
    private static final String ENSURE_BUCKET_PROPERTY = "board.image.storage.ensure-bucket-on-startup";

    @Bean
    public S3Client boardImageS3Client(BoardImageStorageProperties properties) {
        var builder = S3Client.builder()
            .region(Region.of(properties.region()))
            .credentialsProvider(credentialsProvider(properties))
            .serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(properties.pathStyle())
                .build());
        if (properties.hasEndpoint()) {
            builder.endpointOverride(URI.create(properties.endpoint()));
        }
        return builder.build();
    }

    @Bean
    public S3Presigner boardImageS3Presigner(BoardImageStorageProperties properties) {
        var builder = S3Presigner.builder()
            .region(Region.of(properties.region()))
            .credentialsProvider(credentialsProvider(properties))
            .serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(properties.pathStyle())
                .build());
        if (properties.hasEndpoint()) {
            builder.endpointOverride(URI.create(properties.endpoint()));
        }
        return builder.build();
    }

    /** 정적 키가 있으면 그것을(로컬 MinIO 더미), 없으면 SDK 기본 자격증명 체인(운영 IAM 역할)을 쓴다. */
    private AwsCredentialsProvider credentialsProvider(BoardImageStorageProperties properties) {
        if (properties.hasStaticCredentials()) {
            return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.accessKey(), properties.secretKey()));
        }
        return DefaultCredentialsProvider.create();
    }

    /**
     * 부팅 시 버킷을 idempotent 하게 확인·생성한다(§7.6, 앱 부팅 자동 생성이 런북 단순). 이미 있으면 no-op, 없으면 생성한다.
     * MinIO 미기동 등 스토리지 접근 실패는 흡수(경고 로깅)해 부팅을 막지 않는다 — 스토리지 무관 컨텍스트(통합 테스트)에서도
     * 컨텍스트가 뜬다({@code ensure-bucket-on-startup=false} 로 아예 끌 수도 있다).
     */
    @Bean
    @ConditionalOnProperty(name = ENSURE_BUCKET_PROPERTY, havingValue = "true", matchIfMissing = true)
    public ApplicationRunner ensureBoardImageBucket(S3Client s3Client, BoardImageStorageProperties properties) {
        return args -> {
            String bucket = properties.bucket();
            try {
                s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
                log.info("[board-image] 스토리지 버킷 확인됨: {}", bucket);
            } catch (NoSuchBucketException notFound) {
                s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
                log.info("[board-image] 스토리지 버킷 생성됨: {}", bucket);
            } catch (Exception ex) {
                log.warn("[board-image] 스토리지 버킷 확인/생성 실패(부팅은 계속) - bucket={} : {}", bucket, ex.getMessage());
            }
        };
    }
}
