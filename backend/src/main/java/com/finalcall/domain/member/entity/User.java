package com.finalcall.domain.member.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.finalcall.common.entity.BaseTimeEntity;
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
 * 회원 계정 엔티티(member). 관리자 여부는 별도 서비스가 아닌 {@code isAdmin} 플래그로 표현한다(erd §4.1).
 *
 * <p>컨벤션(CLAUDE.md §5): {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}·{@code @Setter} 금지
 * → 상태 변경은 도메인 메서드로만. soft delete({@code isDeleted}/{@code deletedAt}, B-003).
 *
 * <p>식별자 이원화(B-002·B-004): 내부 PK {@code id}(BIGINT auto-increment)는 노출 금지,
 * 외부 노출은 {@code publicId}(ULID, {@code CHAR(26)} UK). {@code publicId}는 생성 시 {@link Ulid}로 채운다.
 */
@Entity
@Getter
@Table(name = "user")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // erd 정합: ULID 는 고정 길이 CHAR(26). 기본 VARCHAR 매핑을 CHAR 로 바꿔 validate 를 통과시킨다.
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "public_id", nullable = false, unique = true, updatable = false, length = 26)
    private String publicId;

    // 유일성은 V4 login_id_active 생성 컬럼 UK로 강제(D-081). 원본 컬럼 UK 미부여.
    @Column(name = "login_id", nullable = false, length = 50)
    private String loginId;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    // 유일성은 V4 nickname_active 생성 컬럼 UK로 강제(D-081). 원본 컬럼 UK 미부여.
    @Column(nullable = false, length = 30)
    private String nickname;

    // 정규화(lowercase+trim) 저장 전제, 미설정이면 NULL(V17). 유일성은 생성 컬럼 email_active UK로 강제,
    // 원본 email 컬럼 UK 미부여(login_id/nickname 패턴 동형, D-081). email_active 는 DB 생성 컬럼이라 미매핑.
    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "is_admin", nullable = false)
    private boolean isAdmin;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Builder
    private User(String loginId, String passwordHash, String nickname, boolean isAdmin) {
        this.publicId = Ulid.generate();
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.nickname = nickname;
        this.isAdmin = isAdmin;
        this.isDeleted = false;
    }

    /** 닉네임 변경(도메인 메서드). @Setter 대신 사용. */
    public void changeNickname(String nickname) {
        this.nickname = nickname;
    }

    /** 비밀번호(해시) 변경(도메인 메서드). 해싱은 호출 측 책임. */
    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    /** 이메일 설정/변경(도메인 메서드). 정규화는 호출 측 책임 · emailVerified 를 false 로 (재)초기화. */
    public void assignEmail(String normalizedEmail) {
        this.email = normalizedEmail;
        this.emailVerified = false;
    }

    /** 이메일 인증 성공 처리(도메인 메서드). */
    public void markEmailVerified() {
        this.emailVerified = true;
    }

    /** soft delete — 삭제 플래그와 삭제 시각을 기록한다. */
    public void delete() {
        this.isDeleted = true;
        this.deletedAt = Instant.now();
    }
}
