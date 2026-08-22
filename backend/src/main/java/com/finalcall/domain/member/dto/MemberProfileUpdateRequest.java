package com.finalcall.domain.member.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.AssertTrue;

/** 닉네임과 기본 캐릭터를 부분 수정하는 요청. 누락과 명시적 null을 구분한다. */
@JsonIgnoreProperties(ignoreUnknown = false)
public record MemberProfileUpdateRequest(JsonNode nickname, JsonNode primaryCharacterId) {

    @AssertTrue(message = "닉네임 또는 기본 캐릭터를 하나 이상 입력해야 합니다.")
    public boolean isValidPatch() {
        if (nickname == null && primaryCharacterId == null) {
            return false;
        }
        if (nickname != null && (!nickname.isTextual() || nickname.textValue().isBlank()
            || nickname.textValue().length() > 30)) {
            return false;
        }
        return primaryCharacterId == null || primaryCharacterId.isIntegralNumber();
    }

    public String nicknameValue() {
        return nickname == null ? null : nickname.textValue();
    }

    public Integer primaryCharacterIdValue() {
        if (primaryCharacterId == null) {
            return null;
        }
        // JsonNode.intValue()는 큰 정수를 하위 32비트로 잘라 유효 ID로 오인할 수 있다.
        // 정확한 int 변환이 불가능한 정수는 유효 집합 밖 sentinel로 서비스의 MEMBER_003 검증에 수렴시킨다.
        return primaryCharacterId.canConvertToInt() ? primaryCharacterId.intValue() : 0;
    }

    @JsonAnySetter
    public void rejectUnknown(String name, JsonNode value) {
        throw new IllegalArgumentException("알 수 없는 프로필 필드입니다: " + name);
    }
}
