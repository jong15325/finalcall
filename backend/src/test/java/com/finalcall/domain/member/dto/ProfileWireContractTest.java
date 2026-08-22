package com.finalcall.domain.member.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.board.dto.CommentResponse;
import com.finalcall.domain.board.dto.PostDetailResponse;
import com.finalcall.domain.board.dto.PostSummary;
import com.finalcall.domain.board.dto.ReplyResponse;
import com.finalcall.domain.board.entity.Comment;
import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.chat.dto.ChatMessageResponse;
import com.finalcall.domain.chat.dto.ChatRoomResponse;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.memo.dto.MemoResponse;
import com.finalcall.domain.memo.dto.MemoSummaryResponse;
import com.finalcall.domain.memo.entity.Memo;

class ProfileWireContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void 게시판_응답은_authorPrimaryCharacterId만_노출한다() {
        Post post = Post.builder().boardId(1L).authorId(2L).authorNickname("작성자")
            .title("제목").content("본문").build();
        Comment comment = Comment.builder().postId(1L).authorId(2L).authorNickname("작성자")
            .content("댓글").build();

        assertAuthorCharacter(PostSummary.from(post, null, 12));
        assertAuthorCharacter(PostDetailResponse.from(post, "free", false, java.util.List.of(), 12));
        assertAuthorCharacter(CommentResponse.fromRoot(comment, false, false, null, 12));
        assertAuthorCharacter(ReplyResponse.from(comment, false, false, null, 12));
    }

    @Test
    void tombstone_댓글은_작성자_캐릭터를_null로_마스킹한다() {
        Comment comment = Comment.builder().postId(1L).authorId(2L).authorNickname("작성자")
            .content("댓글").build();
        ReflectionTestUtils.setField(comment, "isDeleted", true);
        ReflectionTestUtils.setField(comment, "replyCount", 1);

        JsonNode json = value(CommentResponse.fromRoot(comment, true, true, "LIKE", 12));

        assertThat(json.path("authorPrimaryCharacterId").isNull()).isTrue();
        assertThat(json.path("authorNickname").isNull()).isTrue();
    }

    @Test
    void 채팅은_counterpart와_sender에_primaryCharacterId를_노출한다() {
        ChatRoomResponse.Counterpart counterpart = new ChatRoomResponse.Counterpart("member", "상대", 12);
        ChatMessage message = ChatMessage.builder().roomId(1L).roomSequence(1L).senderId(2L)
            .senderNicknameSnapshot("발신자").clientMessageId("client").body("본문").build();
        User sender = User.builder().loginId("sender").passwordHash("hash").nickname("발신자").build();
        sender.changePrimaryCharacter(25);
        ReflectionTestUtils.setField(sender, "id", 2L);

        assertThat(value(counterpart).path("primaryCharacterId").intValue()).isEqualTo(12);
        assertThat(value(ChatMessageResponse.from(message, sender, 1L)).path("sender")
            .path("primaryCharacterId").intValue()).isEqualTo(25);

        sender.delete();
        assertThat(value(ChatMessageResponse.from(message, sender, 1L)).path("sender")
            .path("primaryCharacterId").isNull()).isTrue();
    }

    @Test
    void 쪽지는_목록과_상세의_당사자_캐릭터_키를_노출한다() {
        Memo memo = Memo.builder().senderId(1L).senderNickname("발신자").receiverId(2L)
            .receiverNickname("수신자").memoType(Memo.TYPE_USER).body("본문").build();

        JsonNode received = value(MemoSummaryResponse.received(memo, 12));
        assertThat(received.path("senderPrimaryCharacterId").intValue()).isEqualTo(12);
        assertThat(received.has("receiverPrimaryCharacterId")).isFalse();
        assertThat(received.has("primaryCharacterId")).isFalse();
        assertThat(received.has("characterProfile")).isFalse();
        JsonNode sent = value(MemoSummaryResponse.sent(memo, 25));
        assertThat(sent.path("receiverPrimaryCharacterId").intValue()).isEqualTo(25);
        assertThat(sent.has("senderPrimaryCharacterId")).isFalse();
        assertThat(sent.has("primaryCharacterId")).isFalse();
        assertThat(sent.has("characterProfile")).isFalse();

        JsonNode deletedSender = value(MemoSummaryResponse.received(memo, null));
        assertThat(deletedSender.path("senderPrimaryCharacterId").isNull()).isTrue();
        assertThat(deletedSender.has("receiverPrimaryCharacterId")).isFalse();
        JsonNode deletedReceiver = value(MemoSummaryResponse.sent(memo, null));
        assertThat(deletedReceiver.path("receiverPrimaryCharacterId").isNull()).isTrue();
        assertThat(deletedReceiver.has("senderPrimaryCharacterId")).isFalse();
        JsonNode detail = value(MemoResponse.from(memo, 12, 25));
        assertThat(detail.path("senderPrimaryCharacterId").intValue()).isEqualTo(12);
        assertThat(detail.path("receiverPrimaryCharacterId").intValue()).isEqualTo(25);

        JsonNode deletedParty = value(MemoResponse.from(memo, null, null));
        assertThat(deletedParty.path("senderPrimaryCharacterId").isNull()).isTrue();
        assertThat(deletedParty.path("receiverPrimaryCharacterId").isNull()).isTrue();
    }

    private void assertAuthorCharacter(Object response) {
        JsonNode json = value(response);
        assertThat(json.path("authorPrimaryCharacterId").intValue()).isEqualTo(12);
        assertThat(json.has("primaryCharacterId")).isFalse();
    }

    private JsonNode value(Object response) {
        return objectMapper.valueToTree(response);
    }
}
