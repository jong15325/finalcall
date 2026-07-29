package com.finalcall.domain.member.entity;

import com.finalcall.common.entity.BaseCreatedEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 소셜 신원 연결 엔티티(member, erd §4.1 — EPIC-OAUTH 방식 B). 한 {@link User} 가 provider 별 소셜 신원을
 * 갖는다({@code @ManyToOne}). 신원 키 = (provider, provider_user_id) 복합 UK 이며 이메일은 신원이 아니다(결정 2).
 *
 * <p>컨벤션(CLAUDE.md §5): 생성자 {@code @Builder}·{@code @NoArgsConstructor(PROTECTED)}·{@code @Setter} 금지.
 * 생성 후 갱신 생애주기가 없는 <b>불변 연결 행</b>이라 도메인 변경 메서드를 두지 않으며, {@code updated_at} 없이
 * {@link BaseCreatedEntity}(created_at 만)를 상속한다(erd §4.1 "갱신 대상만 updated_at" · platform_revenue_ledger 선례).
 *
 * <p>식별자: 외부 미노출 내부 연결 테이블이라 {@code public_id} 를 두지 않는다(erd §4.1). soft delete 미보유 —
 * 연결 회수는 이 에픽 범위 밖이다. 인가코드 교환·userinfo 조회 등 provider 연동은 FC-154 소유.
 */
@Entity
@Getter
@Table(name = "user_social_account")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SocialAccount extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20, updatable = false)
    private SocialProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 255, updatable = false)
    private String providerUserId;

    @Builder
    private SocialAccount(User user, SocialProvider provider, String providerUserId) {
        this.user = user;
        this.provider = provider;
        this.providerUserId = providerUserId;
    }
}
