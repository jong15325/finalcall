package com.finalcall.domain.shop;

import java.util.List;
import java.util.Optional;

/**
 * 고정가 커스텀 쿼리 계약(shop, QueryDSL). 목록/상세는 item 표시 블록(template·skill live join)과 seller 를 함께
 * 노출하므로 to-one fetch join 으로 N+1 을 제거한다(표현 계층 lazy 접근 없음, OSIV off).
 */
public interface ShopRepositoryCustom {

    /** 상세 조회(fetch join item·template·skill·seller). 없으면 비어 있다(→ SHOP_003). */
    Optional<Shop> findDetailByPublicId(String publicId);

    /** keyset cursor 목록(fetch join item·template·skill·seller). hasNext 판단을 위해 size+1 건을 읽는다. */
    List<Shop> findByCursor(ShopSearchCondition condition, ShopCursor cursor, int size);

    /**
     * 판매자 본인 스코프 keyset cursor 목록(계약 §3.2 GET /me/shops). 공개 {@link #findByCursor} 와 정렬·keyset
     * 기계는 공유하되 필터를 {@code seller_id = sellerId} + status 로 좁힌다(아이템 분류 필터 없음). 인덱스
     * {@code ix_shop_seller_status (seller_id, status)} 가 커버한다(V15 실재).
     *
     * <p><b>status 규약이 공개 경로와 다르다:</b> 여기서 {@code status == null} 은 <b>ALL(상태 predicate 없음)</b>을
     * 뜻한다 — '내 판매' 는 기본값(ACTIVE) 해석을 컨트롤러({@code resolveStatus})가 이미 마치므로 repo 도달 시 null
     * 은 전 상태 조회 의도다. 공개 {@link #findByCursor} 의 {@code statusScope}(null→ACTIVE)와 대비된다.
     *
     * @param sellerId  판매자 = 인증 주체 내부 PK(IDOR 스코프)
     * @param status    상태 필터. {@code null} = ALL(무필터), 지정 = 해당 영속 상태만
     * @param sort      정렬 필드(화이트리스트)
     * @param ascending 오름차순 여부(false=내림차순, /me/shops 기본 createdAt desc)
     * @param cursor    keyset 경계(첫 페이지면 경계 없음)
     * @param size      페이지 크기(hasNext 판단을 위해 size+1 건을 읽는다)
     */
    List<Shop> findBySellerCursor(
        Long sellerId, ShopStatus status, ShopSort sort, boolean ascending, ShopCursor cursor, int size);
}
