package com.finalcall.domain.mail.entity;

import java.util.Set;

/**
 * 메일 템플릿 자연키(mail feature). enum name = DB {@code email_template.template_key}(대문자 스네이크).
 *
 * <p>문자열 자연키를 enum으로 못박아 소비자가 오타 없이 타입 안전하게 참조한다(문자열 리터럴 산발 방지, spec §4.1).
 * 각 값은 <b>필수 변수 이름 집합</b>을 코드로 선언한다(단일 진실원 = enum, DB엔 변수 스키마 없음, spec §4.2).
 * 렌더링(FC-135)은 이 계약으로 누락·잔여 placeholder를 판정한다. 여기선 선언만 둔다.
 */
public enum EmailTemplateKey {

    /** 회원가입 이메일 인증 코드. 변수: code, expiryMinutes. */
    EMAIL_VERIFICATION(Set.of("code", "expiryMinutes"));

    private final Set<String> requiredVariables;

    EmailTemplateKey(Set<String> requiredVariables) {
        this.requiredVariables = requiredVariables;
    }

    /** 렌더 시 반드시 주입돼야 하는 변수 이름 집합(불변). */
    public Set<String> requiredVariables() {
        return requiredVariables;
    }
}
