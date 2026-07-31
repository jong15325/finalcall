package com.finalcall.domain.memo.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseCreatedEntity;
import com.finalcall.common.util.Ulid;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 메모(쪽지) 엔티티(memo, EPIC-MEMO) — 게임 원본 {@code new_sp.user_memo} 계승 네이티브 도메인(erd §4.1, 테이블명 유지).
 *
 * <p>{@code @NoArgsConstructor(PROTECTED)} + 생성자 {@code @Builder}(private), {@code @Setter} 금지 → 상태 변경은
 * 도메인 메서드({@link #markRead}·{@link #delete})로만. soft delete 단일 플래그({@code isDeleted}, 게임 {@code memo_del}
 * 계승 — 한쪽 삭제가 양쪽 박스에서 사라짐, §4.2). 본문 불변·상태 단방향 전이라 {@link BaseCreatedEntity}(created_at)만 상속한다.
 *
 * <p>발신·수신 회원은 FK 컬럼({@code senderId}·{@code receiverId})으로만 참조한다 — 표시 데이터(닉·레벨·성별)는 발신
 * 시점 스냅샷(R1 닉 변경 대비)이라 조회 시 user 로 내비게이션할 필요가 없어 연관 매핑을 두지 않는다(당사자 인가는 id 비교로 충분).
 * {@code senderLevel}/{@code senderGender} 는 분해 저장(게임 boundary 가 {@code 레벨×100+성별} 재합성, §8.1). {@code memoType}
 * 은 게임 코드값 원형 보존(5=USER·0/14=SYSTEM — 문자열 enum 변환 금지, §3.3).
 */
@Entity
@Getter
@Table(name = "user_memo")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Memo extends BaseCreatedEntity {

    /** 웹 발신 유저 메모 타입 코드(게임 계약 5=USER 고정, §3·I-2). */
    public static final int TYPE_USER = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    @Column(name = "sender_id", updatable = false)
    private Long senderId;

    @Column(name = "sender_nickname", nullable = false, updatable = false, length = 16)
    private String senderNickname;

    @Column(name = "sender_level", updatable = false)
    private Integer senderLevel;

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "sender_gender", updatable = false)
    private Integer senderGender;

    @Column(name = "receiver_id", updatable = false)
    private Long receiverId;

    @Column(name = "receiver_nickname", nullable = false, updatable = false, length = 16)
    private String receiverNickname;

    @Column(name = "memo_type", nullable = false, updatable = false)
    private int memoType;

    @Column(name = "body", nullable = false, updatable = false, length = 120)
    private String body;

    @Column(name = "is_read", nullable = false)
    private boolean isRead;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Builder
    private Memo(String publicId, Long senderId, String senderNickname, Integer senderLevel, Integer senderGender,
        Long receiverId, String receiverNickname, int memoType, String body) {
        this.publicId = publicId != null ? publicId : Ulid.generate();
        this.senderId = senderId;
        this.senderNickname = senderNickname;
        this.senderLevel = senderLevel;
        this.senderGender = senderGender;
        this.receiverId = receiverId;
        this.receiverNickname = receiverNickname;
        this.memoType = memoType;
        this.body = body;
        this.isRead = false;
        this.isDeleted = false;
    }

    /** 주체가 이 메모의 당사자(발신자 또는 수신자)인지(IDOR 가드, I-5). */
    public boolean isParticipant(Long userId) {
        return userId != null && (userId.equals(senderId) || userId.equals(receiverId));
    }

    /** 주체가 수신자인지 — 열람 읽음 전이 조건(§4.1, 보낸함 열람은 전이 없음). */
    public boolean isReceiver(Long userId) {
        return userId != null && userId.equals(receiverId);
    }

    /**
     * 열람 읽음 전이(§4.1) — 미열람일 때 1회만 {@code isRead=true}·{@code readAt=now}. 재열람은 no-op(단방향 I-7).
     *
     * @return 실제로 전이됐으면 true(이미 열람이면 false)
     */
    public boolean markRead(Instant now) {
        if (isRead) {
            return false;
        }
        this.isRead = true;
        this.readAt = now;
        return true;
    }

    /** soft delete(§4.2) — 단일 플래그. 이미 삭제면 no-op. */
    public void delete(Instant now) {
        if (isDeleted) {
            return;
        }
        this.isDeleted = true;
        this.deletedAt = now;
    }
}
