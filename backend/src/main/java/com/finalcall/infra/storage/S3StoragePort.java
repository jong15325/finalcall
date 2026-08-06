package com.finalcall.infra.storage;

import java.time.Duration;

import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

/**
 * {@link StoragePort} 의 S3 호환 단일 구현(EPIC-BOARD, FC-200, board-domain-spec §7.5 · 게이트2 (a)).
 *
 * <p>AWS SDK v2 {@link S3Client}(PUT/DELETE)와 {@link S3Presigner}(presigned GET)만 쓴다 — 두 빈은
 * {@link BoardImageStorageConfig} 가 endpoint/자격증명/path-style 설정으로 조립한다. endpoint override 로 로컬 MinIO,
 * 미지정으로 운영 S3 를 커버한다(코드 단일, MinIO 는 SigV4 호환).
 *
 * <p>버킷명은 설정({@link BoardImageStorageProperties#bucket()})에서 읽는다. presigned URL 은 서명이 로컬 연산이라
 * 네트워크 호출 없이 즉시 만들어진다(읽기 시점 재생성 — 클라 저장 금지, §7.4).
 */
@Component
@RequiredArgsConstructor
public class S3StoragePort implements StoragePort {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final BoardImageStorageProperties properties;

    @Override
    public void store(byte[] content, String contentType, String key) {
        PutObjectRequest request = PutObjectRequest.builder()
            .bucket(properties.bucket())
            .key(key)
            .contentType(contentType)
            .contentLength((long)content.length)
            .build();
        s3Client.putObject(request, RequestBody.fromBytes(content));
    }

    @Override
    public String presignedGetUrl(String key, Duration ttl) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
            .bucket(properties.bucket())
            .key(key)
            .build();
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
            .signatureDuration(ttl)
            .getObjectRequest(getObjectRequest)
            .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    @Override
    public void delete(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
            .bucket(properties.bucket())
            .key(key)
            .build();
        s3Client.deleteObject(request);
    }
}
