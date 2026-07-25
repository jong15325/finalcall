package com.finalcall.domain.item.dto;

import com.finalcall.domain.item.entity.ItemInstance;

/**
 * 인스턴스 상세 조회 결과(item, 도메인 반환 타입) — 공개 필드 + 소유자 전용 필드 이원화를 위해
 * 요청 주체의 소유 여부를 함께 담는다(spec §5.2). api 계층이 이 값으로 slot_no 노출을 결정한다.
 *
 * <p>소유 여부는 SecurityContext 주체(내부 PK)로 판정한다(IDOR 방지 — X-User-Id 불신). 비인증 조회는
 * {@code viewerIsOwner=false} 로 공개 필드만 노출한다.
 *
 * @param instance      fetch join 으로 연관(template·skill·owner)이 초기화된 인스턴스
 * @param viewerIsOwner 요청 주체가 현재 소유자인지 여부
 */
public record ItemInstanceView(ItemInstance instance, boolean viewerIsOwner) {
}
