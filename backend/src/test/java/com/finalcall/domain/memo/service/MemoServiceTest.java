package com.finalcall.domain.memo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.MemoErrorCode;
import com.finalcall.common.util.StringByteCounter;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.domain.memo.entity.Memo;
import com.finalcall.domain.memo.repository.MemoRepository;

/**
 * {@link MemoService} 단위 테스트 — 스프링 컨텍스트 없이 협력자 모의(member 서비스 슬라이스 컨벤션).
 *
 * <p>authz·상태전이·경계를 검증한다: 당사자 아님 차단(MEMO_003·I-5), 읽음 전이의 수신자 한정(§4.1), 자기 발신 차단
 * (MEMO_004), 발신 폭 상한(≤112바이트 초과 400), 그리고 발신자 닉 스냅샷의 16바이트 절단(§8.2, FC-171 재작업 MAJOR-2 회귀가드).
 * 주체는 JWT 필터와 동일하게 principal=userId 로 SecurityContext 에 적재한다(B-009).
 */
@ExtendWith(MockitoExtension.class)
class MemoServiceTest {

    @Mock
    private MemoRepository memoRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private MemoService memoService;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 자기_자신에게_발신하면_MEMO_004로_차단한다() {
        authenticateAs("10");
        User sender = userWith(10L, "나자신");
        when(userRepository.findByIdAndIsDeletedFalse(10L)).thenReturn(Optional.of(sender));
        when(userRepository.findByNicknameAndIsDeletedFalse("나자신")).thenReturn(Optional.of(sender));

        assertThatThrownBy(() -> memoService.send("나자신", "본문"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MemoErrorCode.MEMO_SELF_SEND);

        verify(memoRepository, never()).save(any());
    }

    @Test
    void 발신_본문폭이_112바이트를_초과하면_COMMON_001로_차단한다() {
        authenticateAs("10");
        // 한글 57자 = 114바이트(>112). 폭 검증은 send() 최선두라 user 조회 이전에 튕긴다.
        String tooWide = "가".repeat(57);

        assertThatThrownBy(() -> memoService.send("수신자", tooWide))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(CommonErrorCode.INVALID_INPUT);

        verify(userRepository, never()).findByNicknameAndIsDeletedFalse(any());
        verify(memoRepository, never()).save(any());
    }

    @Test
    void 닉이_16바이트를_초과하는_발신자도_정상_발신하고_스냅샷을_16바이트로_절단한다() {
        authenticateAs("10");
        String longNickname = "가나다라마바사아자차카타파하거너더러"; // 20자 한글 = 40바이트(>16)
        User sender = userWith(10L, longNickname);
        User receiver = userWith(20L, "받는이");
        when(userRepository.findByIdAndIsDeletedFalse(10L)).thenReturn(Optional.of(sender));
        when(userRepository.findByNicknameAndIsDeletedFalse("받는이")).thenReturn(Optional.of(receiver));
        when(memoRepository.save(any(Memo.class))).thenAnswer(inv -> inv.getArgument(0));

        memoService.send("받는이", "거래 문의드립니다");

        ArgumentCaptor<Memo> captor = ArgumentCaptor.forClass(Memo.class);
        verify(memoRepository).save(captor.capture());
        String snapshot = captor.getValue().getSenderNickname();
        // 컬럼 VARCHAR(16)·게임 char(16) 폭 보존
        assertThat(StringByteCounter.getStringByte(snapshot)).isLessThanOrEqualTo(16);
        assertThat(longNickname).startsWith(snapshot); // 글자 중간 절단 없이 접두 보존
        assertThat(snapshot).hasSizeLessThan(longNickname.length()); // 실제로 절단됨
    }

    @Test
    void 당사자가_아닌_주체의_상세열람은_MEMO_003으로_차단한다() {
        authenticateAs("99"); // sender(10)·receiver(20) 어느 쪽도 아님
        Memo memo = memoBetween(10L, 20L);
        when(memoRepository.findByPublicIdAndIsDeletedFalse("PUB")).thenReturn(Optional.of(memo));

        assertThatThrownBy(() -> memoService.getDetail("PUB"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MemoErrorCode.MEMO_NOT_PARTICIPANT);
    }

    @Test
    void 당사자가_아닌_주체의_삭제는_MEMO_003으로_차단한다() {
        authenticateAs("99");
        Memo memo = memoBetween(10L, 20L);
        when(memoRepository.findByPublicIdAndIsDeletedFalse("PUB")).thenReturn(Optional.of(memo));

        assertThatThrownBy(() -> memoService.delete("PUB"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MemoErrorCode.MEMO_NOT_PARTICIPANT);

        assertThat(memo.isDeleted()).isFalse(); // 인가 실패 시 상태 불변
    }

    @Test
    void 수신자가_상세를_열람하면_읽음으로_전이한다() {
        authenticateAs("20"); // 수신자
        Memo memo = memoBetween(10L, 20L);
        when(memoRepository.findByPublicIdAndIsDeletedFalse("PUB")).thenReturn(Optional.of(memo));

        memoService.getDetail("PUB");

        assertThat(memo.isRead()).isTrue();
        assertThat(memo.getReadAt()).isNotNull();
    }

    @Test
    void 발신자가_보낸메모를_열람해도_읽음전이하지_않는다() {
        authenticateAs("10"); // 발신자(보낸함 열람)
        Memo memo = memoBetween(10L, 20L);
        when(memoRepository.findByPublicIdAndIsDeletedFalse("PUB")).thenReturn(Optional.of(memo));

        memoService.getDetail("PUB");

        assertThat(memo.isRead()).isFalse(); // 보낸함 열람은 전이 없음(§4.1)
        assertThat(memo.getReadAt()).isNull();
    }

    /** JWT 필터가 적재하는 형태와 동일하게 principal=userId 로 SecurityContext 를 세팅한다(B-009). */
    private void authenticateAs(String userId) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    /** PK(id)가 채워진 활성 User — 발신 경로가 주체 PK·수신자 PK 로 비교하므로 id 를 리플렉션으로 세팅한다. */
    private User userWith(long id, String nickname) {
        User user = User.builder().loginId("u" + id).passwordHash("hash").nickname(nickname).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Memo memoBetween(long senderId, long receiverId) {
        return Memo.builder()
            .publicId("PUB")
            .senderId(senderId)
            .senderNickname("발신자")
            .senderLevel(1)
            .senderGender(0)
            .receiverId(receiverId)
            .receiverNickname("수신자")
            .memoType(Memo.TYPE_USER)
            .body("본문")
            .build();
    }
}
