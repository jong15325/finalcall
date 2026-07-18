package com.finalcall.domain.item;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;

import lombok.RequiredArgsConstructor;

/**
 * 아이템 인스턴스 상세 서비스(item, FC-021) — 계약 §4.1 GET /items/{id}.
 *
 * <p>인증 optional 이라 주체를 nullable 로 해석한다: 인증 시 소유 여부를 판정해 소유자 전용 필드(slot_no) 노출을
 * 결정하고(spec §5.2), 비인증이면 공개 필드만 내린다. 소유 판정은 SecurityContext 기준이다(IDOR 방지 — X-User-Id
 * 불신, D-065). 조회 전용이라 클래스 레벨 {@code @Transactional(readOnly = true)}만 둔다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ItemInstanceService {

    private final ItemInstanceRepository itemInstanceRepository;

    @ServiceLog
    public ItemInstanceView getDetail(String publicId) {
        ItemInstance instance = itemInstanceRepository.findDetailByPublicId(publicId)
            .orElseThrow(() -> new BusinessException(ItemErrorCode.ITEM_NOT_FOUND));
        Long viewerId = currentUserIdOrNull();
        boolean viewerIsOwner = viewerId != null && instance.isOwnedBy(viewerId);
        return new ItemInstanceView(instance, viewerIsOwner);
    }

    /**
     * 인증 주체(내부 PK)를 nullable 로 해석한다. 비인증·익명 컨텍스트면 null 이다(인증 optional 엔드포인트).
     * JWT 필터가 subject=userId 로 적재하므로 인증 시 name 은 숫자다.
     */
    private Long currentUserIdOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
            || !authentication.isAuthenticated()
            || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
