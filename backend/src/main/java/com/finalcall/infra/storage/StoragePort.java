package com.finalcall.infra.storage;

import java.time.Duration;

/**
 * 오브젝트 스토리지 추상화(EPIC-BOARD, FC-200, board-domain-spec §7.5) — 게시글 이미지 원본을 비공개 버킷에 저장하고
 * presigned GET URL 로만 노출한다.
 *
 * <p><b>레이어 규율(infra→domain 금지)</b>: 도메인 타입을 참조하지 않고 원시 바이트·MIME·object key 만 주고받는다
 * ({@link com.finalcall.infra.mail.EmailSender} 선례). 도메인(board feature)은 이 인터페이스에만 의존한다.
 *
 * <p><b>단일 S3 호환 구현</b>({@link S3StoragePort}, AWS SDK v2)이 endpoint 설정만으로 로컬 MinIO·운영 S3 를 모두
 * 커버한다(로컬 디스크 구현 없음, 게이트2 (a) B). 최소 인터페이스만 노출한다(put·presignGet·delete).
 */
public interface StoragePort {

    /**
     * 원본 바이트를 object key 로 저장한다(PUT). 같은 key 로 다시 저장하면 덮어쓴다.
     *
     * @param content     저장할 원본 바이트
     * @param contentType 저장 시 기록할 MIME(예: image/webp) — presigned GET 응답 Content-Type 에 반영
     * @param key         버킷 내 object key(board-domain-spec §7.3 규약, 예: {@code board/2026/08/<ulid>.webp})
     */
    void store(byte[] content, String contentType, String key);

    /**
     * object key 에 대한 시간제한 presigned GET URL 을 생성한다(클라 노출용). 서명은 로컬 연산이라 네트워크 호출이 없다.
     *
     * @param key object key
     * @param ttl 만료 기간(board-domain-spec §7.4, 기본 1시간)
     * @return 시간제한 presigned GET URL
     */
    String presignedGetUrl(String key, Duration ttl);

    /**
     * object 를 삭제한다(고아·게시글 삭제 정리용, board-domain-spec §7.5). 존재하지 않는 key 삭제는 무해(idempotent).
     *
     * @param key object key
     */
    void delete(String key);
}
