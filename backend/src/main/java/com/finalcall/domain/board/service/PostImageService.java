package com.finalcall.domain.board.service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.finalcall.common.exception.BoardImageErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.common.util.Ulid;
import com.finalcall.domain.board.dto.BoardImageUploadResponse;
import com.finalcall.domain.board.dto.PostDetailResponse;
import com.finalcall.domain.board.entity.PostImage;
import com.finalcall.domain.board.repository.PostImageRepository;
import com.finalcall.infra.storage.BoardImageStorageProperties;
import com.finalcall.infra.storage.StoragePort;

import lombok.RequiredArgsConstructor;

/**
 * 게시글 이미지 서비스(EPIC-BOARD, FC-200) — 2단계 업로드(오브젝트 스토리지 PUT + 고아 PostImage 생성)·게시글 바인딩
 * (업로더 인가·고아만·재귀속 금지)·읽기 시점 presigned GET 렌더링(상세 갤러리·목록 썸네일). board-spec §7 · api §6.4·§6.2.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기(upload·bind)만 오버라이드(CLAUDE.md §5). 바인딩은
 * 게시글 저장 서비스({@link PostService})가 <b>같은 TX 에서</b> 외부 빈으로 호출한다(자기호출 아님 → 프록시·TX 정상 적용).
 * 주체는 SecurityContext 기준이다(B-009, IDOR 차단). presigned URL 생성은 로컬 서명 연산이라 네트워크 호출이 없다(§7.4).
 *
 * <p><b>인가 불변식(board-spec I-1 이미지):</b> 바인딩은 업로더==주체·고아(post_id NULL)만 허용하고, 이미 다른 글에
 * 바인딩된 이미지의 재귀속은 금지한다. 계약에 이미지 바인딩 전용 도메인 코드가 없어 위반은 "검증 400"
 * ({@link CommonErrorCode#INVALID_INPUT})으로 수렴한다(enum↔계약 1:1 — 새 코드 미발명).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PostImageService {

    /** 이미지 최대 크기(계약 §7.2 = 5MB). 프레임워크 multipart 상한(10MB)보다 낮아 서비스가 IMAGE_002 로 판정한다. */
    private static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    /** original_filename 컬럼 폭(erd §4.5 = VARCHAR(255)). 초과분은 잘라 저장한다(메타·표시용). */
    private static final int MAX_FILENAME_LENGTH = 255;

    private final PostImageRepository postImageRepository;
    private final StoragePort storagePort;
    private final BoardImageStorageProperties storageProperties;

    /**
     * 이미지 업로드(api §6.4). MIME 화이트리스트(매직바이트 sniff)·용량(≤5MB) 검증 → 오브젝트 스토리지 PUT → 고아
     * PostImage 생성(post_id NULL·uploader=주체) → presigned GET URL 반환. 용량 초과 {@code IMAGE_002}, 미허용 형식
     * {@code IMAGE_001}(둘 다 422).
     */
    @Transactional
    @ServiceLog
    public BoardImageUploadResponse upload(MultipartFile file) {
        Long uploaderId = currentUserId();
        byte[] content = readBytes(file);
        Preconditions.validate(content.length <= MAX_IMAGE_BYTES, BoardImageErrorCode.IMAGE_TOO_LARGE);
        ImageContentType type = ImageContentType.sniff(content)
            .orElseThrow(() -> new BusinessException(BoardImageErrorCode.IMAGE_UNSUPPORTED_TYPE));

        String publicId = Ulid.generate();
        String storageKey = objectKey(publicId, type.extension());
        storagePort.store(content, type.mimeType(), storageKey);

        PostImage saved = postImageRepository.save(PostImage.builder()
            .publicId(publicId)
            .postId(null)
            .uploaderId(uploaderId)
            .storageKey(storageKey)
            .originalFilename(truncateFilename(file.getOriginalFilename()))
            .contentType(type.mimeType())
            .fileSize(content.length)
            .sortOrder(0)
            .build());

        String url = storagePort.presignedGetUrl(storageKey, storageProperties.presignTtl());
        return BoardImageUploadResponse.builder().imagePublicId(saved.getPublicId()).url(url).build();
    }

    /**
     * 게시글에 이미지들을 바인딩한다(작성·수정 공용, api §6.2). {@code imagePublicIds} 는 <b>최종 이미지 집합</b>이다 —
     * 현재 바인딩됐지만 최종 집합에 없는 이미지는 언바인딩(고아로 환원), 최종 집합의 이미지는 배열 순서대로 sort_order 를
     * 세팅한다. 각 이미지는 (a) 이미 이 글에 바인딩됐거나(재정렬) (b) 업로더==주체인 고아여야 한다 — 그 외(미존재·타인
     * 고아·다른 글에 바인딩)는 {@code INVALID_INPUT}(400, board-spec I-1 재귀속 금지). 작성 시에는 현재 바인딩이 없어
     * 순수 신규 바인딩이 된다. 호출자(PostService)의 TX 에 합류한다.
     *
     * @param postId         대상 게시글 내부 PK
     * @param imagePublicIds 최종 귀속 이미지 public_id 목록(null·빈 = 전부 언바인딩)
     * @param subjectUserId  현재 주체(업로더 인가 대조)
     */
    @Transactional
    public void bind(Long postId, List<String> imagePublicIds, Long subjectUserId) {
        List<String> desired = imagePublicIds == null ? List.of() : imagePublicIds;
        Preconditions.validate(isDistinct(desired), CommonErrorCode.INVALID_INPUT);

        Set<String> desiredSet = new HashSet<>(desired);
        for (PostImage current : postImageRepository.findByPostIdOrderBySortOrderAsc(postId)) {
            if (!desiredSet.contains(current.getPublicId())) {
                current.unbind(); // 최종 집합에서 누락 → 고아로 환원(물리 정리는 sweeper)
            }
        }

        for (int order = 0; order < desired.size(); order++) {
            String publicId = desired.get(order);
            PostImage image = postImageRepository.findByPublicId(publicId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.INVALID_INPUT));
            if (image.isBoundTo(postId)) {
                image.assignToPost(postId, order); // 이미 이 글의 이미지 → 재정렬
            } else if (image.isOrphan()) {
                Preconditions.validate(image.isUploadedBy(subjectUserId), CommonErrorCode.INVALID_INPUT);
                image.assignToPost(postId, order); // 고아 + 업로더==주체 → 신규 바인딩
            } else {
                throw new BusinessException(CommonErrorCode.INVALID_INPUT); // 다른 글에 바인딩 → 재귀속 금지
            }
        }
    }

    /** 게시글 상세 갤러리(api §6.2 {@code images[]}) — sort 순, url=읽기 시점 재생성 presigned GET(§7.4). */
    public List<PostDetailResponse.ImageResponse> imagesOf(Long postId) {
        Duration ttl = storageProperties.presignTtl();
        return postImageRepository.findByPostIdOrderBySortOrderAsc(postId).stream()
            .map(image -> new PostDetailResponse.ImageResponse(
                image.getPublicId(), storagePort.presignedGetUrl(image.getStorageKey(), ttl), image.getSortOrder()))
            .toList();
    }

    /**
     * 목록 썸네일(api §6.2 {@code thumbnailUrl}) — 글당 첫 이미지(min sort_order)의 presigned GET URL 을 배치로 만든다.
     * 첫 이미지가 없는 글은 맵에 없다(→ 썸네일 null). 글당 1건만 presign 해 N+1·불필요 서명을 피한다.
     */
    public Map<Long, String> thumbnailsOf(Collection<Long> postIds) {
        if (postIds == null || postIds.isEmpty()) {
            return Map.of();
        }
        Duration ttl = storageProperties.presignTtl();
        Map<Long, String> thumbnails = new HashMap<>();
        for (PostImage image : postImageRepository.findByPostIdInOrderByPostIdAscSortOrderAsc(postIds)) {
            // postId asc·sortOrder asc 정렬이라 각 글의 첫 등장이 곧 썸네일. computeIfAbsent 로 첫 건만 presign.
            thumbnails.computeIfAbsent(image.getPostId(),
                key -> storagePort.presignedGetUrl(image.getStorageKey(), ttl));
        }
        return thumbnails;
    }

    /** object key = {@code board/{yyyy}/{MM}/{imagePublicId}.{ext}}(UTC 기준, board-spec §7.3). */
    private String objectKey(String publicId, String extension) {
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        return "board/%d/%02d/%s.%s".formatted(now.getYear(), now.getMonthValue(), publicId, extension);
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new UncheckedIOException("업로드 파일을 읽을 수 없습니다.", ex);
        }
    }

    private String truncateFilename(String filename) {
        if (filename == null) {
            return null;
        }
        return filename.length() <= MAX_FILENAME_LENGTH ? filename : filename.substring(0, MAX_FILENAME_LENGTH);
    }

    private boolean isDistinct(List<String> values) {
        return values.size() == new HashSet<>(values).size();
    }

    /** 인증 주체(내부 PK)를 해석한다. 업로드는 인증 필수라 SecurityConfig 가 인증을 강제한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
