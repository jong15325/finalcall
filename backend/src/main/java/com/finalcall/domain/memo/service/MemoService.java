package com.finalcall.domain.memo.service;

import java.time.Instant;
import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.MemoErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.common.util.Preconditions;
import com.finalcall.common.util.StringByteCounter;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.domain.memo.dto.MemoResponse;
import com.finalcall.domain.memo.dto.MemoSendResponse;
import com.finalcall.domain.memo.dto.MemoSummaryResponse;
import com.finalcall.domain.memo.entity.Memo;
import com.finalcall.domain.memo.entity.MemoCursor;
import com.finalcall.domain.memo.repository.MemoRepository;

import lombok.RequiredArgsConstructor;

/**
 * 메모(쪽지) 서비스(memo, EPIC-MEMO) — 발신·받은함/보낸함(커서)·열람(+읽음 전이)·삭제(soft)·미열람 개수.
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)}, 쓰기(send·getDetail 읽음 전이·delete)만 오버라이드(CLAUDE.md §5).
 * 주체는 SecurityContext 기준이다(B-009, IDOR 방지 — X-User-Id 불신). 비즈니스 검증은 {@link Preconditions}.
 *
 * <p><b>발신 고정(I-1·I-2):</b> {@code memoType} 은 서버가 {@link Memo#TYPE_USER}(5)로, {@code senderId} 는 토큰
 * 주체로만 취한다(요청 바디 발신자 필드 불신 — 시스템 메모 0/14 사칭 차단). 레벨·성별은 현재 기본값
 * {@code senderLevel=1}·{@code senderGender=0}(user 게임필드 부재, 게이트2 a) — 저장은 분해, 게임 boundary 가 재합성한다(§8.1).
 * {@code body} 는 패딩·개행 없는 <b>순수 원문</b>으로 저장하고(§8.3·게이트2 b), 입력폭만 {@code getStringByte ≤ 112}(=4×28)로 검증한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemoService {

    /** 웹 발신 입력폭 상한(바이트, =4×28) — 게임 팝업 3헤더+꼬리 용량과 정합, auto-wrap·패딩 후 char(120) 이내 보장(§8.3). */
    private static final int MAX_BODY_BYTE_WIDTH = 112;
    /** 발신자 닉 스냅샷 폭 상한(바이트) — 게임 {@code char(16)}·컬럼 VARCHAR(16) 보존. 30자 닉은 여기서 절단(§8.2). */
    private static final int SENDER_NICKNAME_BYTE_WIDTH = 16;
    /** 발신 레벨 스냅샷 기본값(user 게임레벨 부재, 게이트2 a — 향후 실값 교체). */
    private static final int DEFAULT_SENDER_LEVEL = 1;
    /** 발신 성별 스냅샷 기본값(0=남, user 성별 부재, 게이트2 a). */
    private static final int DEFAULT_SENDER_GENDER = 0;

    private final MemoRepository memoRepository;
    private final UserRepository userRepository;

    /**
     * 메모를 발신한다(계약 §2.6 POST /me/memos). 발신자=주체, {@code memo_type}=5 고정. 수신자는 활성 회원 닉네임을
     * {@code receiver_id} 로 정규화(R1·MEMO_001)하고, 닉·레벨·성별을 발신 시점 스냅샷으로 저장한다.
     *
     * @return 생성된 메모의 public_id·발신 시각
     */
    @Transactional
    @ServiceLog
    public MemoSendResponse send(String receiverNickname, String body) {
        Preconditions.validate(
            StringByteCounter.getStringByte(body) <= MAX_BODY_BYTE_WIDTH, CommonErrorCode.INVALID_INPUT);

        Long senderId = currentUserId();
        User sender = userRepository.findByIdAndIsDeletedFalse(senderId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
        User receiver = userRepository.findByNicknameAndIsDeletedFalse(receiverNickname)
            .orElseThrow(() -> new BusinessException(MemoErrorCode.MEMO_RECEIVER_NOT_FOUND));
        Preconditions.validate(!receiver.getId().equals(senderId), MemoErrorCode.MEMO_SELF_SEND);

        Memo saved = memoRepository.save(Memo.builder()
            .senderId(senderId)
            // 닉 30자 정책(회원 도메인) vs 스냅샷 VARCHAR(16)·게임 char(16) 폭 — 저장 전 16바이트 절단(§8.2, 오버플로 500 방지)
            .senderNickname(StringByteCounter.truncateToByteWidth(sender.getNickname(), SENDER_NICKNAME_BYTE_WIDTH))
            .senderLevel(DEFAULT_SENDER_LEVEL)
            .senderGender(DEFAULT_SENDER_GENDER)
            .receiverId(receiver.getId())
            .receiverNickname(receiver.getNickname())
            .memoType(Memo.TYPE_USER)
            .body(body)
            .build());
        return MemoSendResponse.from(saved);
    }

    /** 받은함(계약 §2.6, 커서) — receiver=주체 AND 미삭제, id DESC. */
    @ServiceLog
    public CursorResponse<MemoSummaryResponse, String> getReceived(String cursor, int size) {
        Long userId = currentUserId();
        List<Memo> fetched = memoRepository.findReceivedByCursor(userId, MemoCursor.decode(cursor), size);
        return CursorResponse.from(fetched, size, MemoSummaryResponse::received, m -> MemoCursor.encode(m.getId()));
    }

    /** 보낸함(계약 §2.6, 커서) — sender=주체 AND 미삭제, id DESC. */
    @ServiceLog
    public CursorResponse<MemoSummaryResponse, String> getSent(String cursor, int size) {
        Long userId = currentUserId();
        List<Memo> fetched = memoRepository.findSentByCursor(userId, MemoCursor.decode(cursor), size);
        return CursorResponse.from(fetched, size, MemoSummaryResponse::sent, m -> MemoCursor.encode(m.getId()));
    }

    /** 미열람 개수(계약 §2.6, 뱃지) — receiver=주체 AND 미삭제 AND 미열람. */
    @ServiceLog
    public long getUnreadCount() {
        return memoRepository.countByReceiverIdAndIsDeletedFalseAndIsReadFalse(currentUserId());
    }

    /**
     * 상세 열람(계약 §2.6 GET /me/memos/{id}). 당사자만(IDOR 가드 I-5·MEMO_003). 호출자가 수신자이고 미열람이면
     * {@code is_read=true}·{@code read_at=now} 로 1회 전이한다(§4.1, 보낸함 열람은 전이 없음). 전이는 dirty checking 으로 반영된다.
     */
    @Transactional
    @ServiceLog
    public MemoResponse getDetail(String publicId) {
        Long userId = currentUserId();
        Memo memo = memoRepository.findByPublicIdAndIsDeletedFalse(publicId)
            .orElseThrow(() -> new BusinessException(MemoErrorCode.MEMO_NOT_FOUND));
        Preconditions.validate(memo.isParticipant(userId), MemoErrorCode.MEMO_NOT_PARTICIPANT);
        if (memo.isReceiver(userId)) {
            memo.markRead(Instant.now());
        }
        return MemoResponse.from(memo);
    }

    /**
     * 삭제(계약 §2.6 DELETE /me/memos/{id}, soft delete). 당사자만(MEMO_003). 게임 {@code memo_del} 단일 플래그 계승 —
     * 한쪽 삭제가 양쪽 박스에서 사라진다(§4.2). 이미 삭제된 메모는 {@code findByPublicIdAndIsDeletedFalse} 에서 빠져 MEMO_002 로 수렴한다.
     */
    @Transactional
    @ServiceLog
    public void delete(String publicId) {
        Long userId = currentUserId();
        Memo memo = memoRepository.findByPublicIdAndIsDeletedFalse(publicId)
            .orElseThrow(() -> new BusinessException(MemoErrorCode.MEMO_NOT_FOUND));
        Preconditions.validate(memo.isParticipant(userId), MemoErrorCode.MEMO_NOT_PARTICIPANT);
        memo.delete(Instant.now());
    }

    /** 인증 주체(내부 PK)를 해석한다. 전 엔드포인트 인증 필요라 SecurityConfig 가 인증을 강제한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
