package com.finalcall.domain.notice;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;

import lombok.RequiredArgsConstructor;

/**
 * 공지 서비스(Stage D) — 서비스 컨벤션 참조 구현.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)} 기본, 쓰기 메서드만 {@code @Transactional} 오버라이드.
 * {@code @ServiceLog} 부착, 비즈니스 검증은 {@link Preconditions}.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NoticeService {

    private final NoticeRepository noticeRepository;

    @Transactional
    @ServiceLog
    public Long create(String title, String content, NoticeType type) {
        Notice saved = noticeRepository.save(Notice.builder()
            .title(title)
            .content(content)
            .type(type)
            .build());
        return saved.getId();
    }

    @ServiceLog
    public Notice getActive(Long id) {
        return noticeRepository.findActiveByIdOrThrow(id, NoticeErrorCode.NOTICE_NOT_FOUND);
    }

    @ServiceLog
    public Page<Notice> getPage(Pageable pageable) {
        return noticeRepository.findActivePage(pageable);
    }

    @ServiceLog
    public NoticeCursorSlice getByCursor(Long cursor, int size) {
        List<Notice> fetched = noticeRepository.findActiveByCursor(cursor, size);
        boolean hasNext = fetched.size() > size;
        List<Notice> content = hasNext ? fetched.subList(0, size) : fetched;
        Long nextCursor = content.isEmpty() ? null : content.get(content.size() - 1).getId();
        return new NoticeCursorSlice(content, nextCursor, hasNext);
    }

    @Transactional
    @ServiceLog
    public void update(Long id, String title, String content, NoticeType type) {
        // findByIdOrThrow(삭제 포함)로 조회 후, 이미 삭제됐는지 비즈니스 검증(Preconditions 데모).
        Notice notice = noticeRepository.findByIdOrThrow(id, NoticeErrorCode.NOTICE_NOT_FOUND);
        Preconditions.validate(!notice.isDeleted(), NoticeErrorCode.NOTICE_ALREADY_DELETED);
        notice.update(title, content, type); // dirty checking 으로 flush 시 반영
    }

    @Transactional
    @ServiceLog
    public void delete(Long id) {
        Notice notice = noticeRepository.findByIdOrThrow(id, NoticeErrorCode.NOTICE_NOT_FOUND);
        Preconditions.validate(!notice.isDeleted(), NoticeErrorCode.NOTICE_ALREADY_DELETED);
        notice.delete(); // soft delete
    }
}
