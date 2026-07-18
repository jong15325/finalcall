package com.finalcall.domain.item;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.logging.ServiceLog;

import lombok.RequiredArgsConstructor;

/**
 * 아이템 템플릿(카탈로그) 서비스(item, FC-020).
 *
 * <p>조회 전용 마스터 도메인이라 클래스 레벨 {@code @Transactional(readOnly = true)}만 둔다(쓰기 경로 없음 —
 * 진입은 시드-only, 게이트2). 검증은 없다(빈 결과는 정상 200, spec §6).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ItemTemplateService {

    private final ItemTemplateRepository itemTemplateRepository;

    @ServiceLog
    public Page<ItemTemplate> getCatalog(ItemTemplateSearchCondition condition, Pageable pageable) {
        return itemTemplateRepository.search(condition, pageable);
    }
}
