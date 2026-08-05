package com.finalcall.domain.delivery.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.DeliveryErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.delivery.dto.DeliveryDetailResponse;
import com.finalcall.domain.delivery.dto.DeliverySummaryResponse;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.delivery.repository.DeliveryReadRepository;
import com.finalcall.domain.delivery.repository.ItemDeliveryRepository;
import com.finalcall.domain.item.entity.ItemInstance;

import lombok.RequiredArgsConstructor;

/**
 * 구매자 배송 상태 조회 서비스(delivery, FC-192) — {@code GET /me/deliveries}·{@code GET /me/deliveries/{id}}.
 * <b>읽기 전용</b>이다(FC-188 쓰기·상태전이 sweeper/reconciler 와 파일 분리 — delivery-domain-spec §10.1·§14).
 *
 * <h2>인가(IDOR — §10.1)</h2>
 * 주체는 SecurityContext 기준이다(B-009). 목록은 쿼리를 {@code recipient_user_id = 주체} 로 <b>스코프</b>해 타인
 * 배송을 애초에 노출하지 않는다({@link DeliveryReadRepository#findPageByRecipient}). 상세는 public_id 로 조회한 뒤
 * <b>수령자=주체</b> 를 검증한다 — 미존재·비당사자를 모두 {@code DELIVERY_001}(404)로 통일한다(ULID 라 열거 무해로 404
 * 통일, §10.3). {@code claimToken}·{@code claimedAt} 은 응답 DTO 자체가 담지 않아 미노출이다(§10.1).
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)}(CLAUDE.md §5) — 조회만 하므로 쓰기 오버라이드가 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliveryQueryService {

    private final DeliveryReadRepository deliveryReadRepository;
    private final ItemDeliveryRepository itemDeliveryRepository;

    /**
     * 내 배송 목록(계약 §4.6.1) — 수령자 스코프 + status 선택 필터 + cursor 페이지(created_at desc).
     *
     * @param statusFilter 상태 필터(null=전체). enum 화이트리스트로만 바인딩된다(컨트롤러)
     * @param cursorToken  커서 문자열(null=첫 페이지, 손상 시 400)
     * @param size         페이지 크기(호출 측이 경계로 정규화)
     * @return 배송 요약으로 매핑된 커서 페이지(nextCursor 는 opaque String)
     */
    @ServiceLog
    public CursorResponse<DeliverySummaryResponse, String> getMyDeliveries(
        DeliveryStatus statusFilter, String cursorToken, int size) {
        Long userId = currentUserId();
        DeliveryReadCursor cursor = DeliveryReadCursor.decode(cursorToken);
        List<ItemDelivery> fetched = deliveryReadRepository.findPageByRecipient(
            userId, statusFilter, cursor.createdAt(), cursor.id(), size);
        // 대상 item_instance 를 배치 로드해 표시 블록(displayName·스킬명·item public_id)을 채운다(N+1 없음).
        Map<Long, ItemInstance> instances = loadInstances(fetched);
        // 커서는 매핑 전 원본(ItemDelivery)의 마지막 항목(created_at + id)에서 추출해 형상(String opaque)을 보존한다.
        return CursorResponse.from(fetched, size,
            delivery -> DeliverySummaryResponse.from(delivery, requireInstance(instances, delivery)),
            delivery -> DeliveryReadCursor.encode(delivery.getCreatedAt(), delivery.getId()));
    }

    /**
     * 배송 상세(계약 §4.6.1) — public_id 조회 후 당사자(수령자=주체) 검증. 미존재·비당사자를 모두
     * {@code DELIVERY_001}(404)로 통일해 열거를 막는다(§10.3).
     *
     * @return 배송 상세(수령 닉 포함 — 당사자 조회라 마스킹 없음)
     * @throws BusinessException {@code DELIVERY_001}(404 — 미존재·비당사자 통일)
     */
    @ServiceLog
    public DeliveryDetailResponse getMyDelivery(String deliveryPublicId) {
        Long userId = currentUserId();
        // 미존재 OR 수령자≠주체 를 모두 empty 로 무너뜨려 404 로 통일한다(IDOR — 비당사자에게 존재를 드러내지 않음).
        ItemDelivery delivery = itemDeliveryRepository.findByPublicId(deliveryPublicId)
            .filter(found -> found.getRecipientUserId().equals(userId))
            .orElseThrow(() -> new BusinessException(DeliveryErrorCode.DELIVERY_NOT_FOUND));
        ItemInstance instance = deliveryReadRepository.findItemInstancesByIds(List.of(delivery.getItemInstanceId()))
            .stream().findFirst()
            // item_instance_id 는 NOT NULL FK 라 항상 존재한다(부재는 깨진 상태 → 500).
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        return DeliveryDetailResponse.from(delivery, instance);
    }

    /** 페이지의 배송들이 가리키는 item_instance 를 id→인스턴스 맵으로 배치 로드한다(표시 블록 구성용). */
    private Map<Long, ItemInstance> loadInstances(List<ItemDelivery> deliveries) {
        Set<Long> ids = deliveries.stream().map(ItemDelivery::getItemInstanceId).collect(Collectors.toSet());
        return deliveryReadRepository.findItemInstancesByIds(ids).stream()
            .collect(Collectors.toMap(ItemInstance::getId, Function.identity()));
    }

    /** 배송 대상 인스턴스를 맵에서 꺼낸다. NOT NULL FK 라 항상 존재하며, 부재는 깨진 상태(500)로 방어한다. */
    private ItemInstance requireInstance(Map<Long, ItemInstance> instances, ItemDelivery delivery) {
        ItemInstance instance = instances.get(delivery.getItemInstanceId());
        if (instance == null) {
            throw new BusinessException(CommonErrorCode.INTERNAL_ERROR);
        }
        return instance;
    }

    /** 인증 주체(내부 PK). {@code /me/deliveries/**} 는 SecurityConfig 가 인증을 강제한다(B-009, IDOR 차단). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
