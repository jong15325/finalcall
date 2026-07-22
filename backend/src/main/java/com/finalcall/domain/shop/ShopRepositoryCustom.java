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
}
