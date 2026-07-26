package com.finalcall.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.finalcall.common.exception.ErrorCode;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * V2 어휘·위치 규약(EPIC-CONVENTION-V2, proposal §9.7~§9.9)을 test 코드로 기계 강제한다.
 *
 * <p>구조 규율(슬라이스 계층방향·비순환·커널 격리)은 {@link SliceArchitectureTest}(§10 (a)(b)(c))가 맡고,
 * 이 클래스는 §10 (e)(f)(g)의 <b>어휘·위치</b> 규약 3종을 담당한다 — DTO 접미사 어휘(§9.7),
 * ErrorCode 중앙화(§9.8), Properties 소비범위 위치(§9.9). 두 클래스로 §10 최종 6규칙이 완성된다.
 *
 * <p>이름·패키지 패턴 기반이라 신규 feature가 늘어도 규칙이 불변이다. 코드 이전(FC-124~126: ErrorCode
 * 중앙화·Properties 분리·DTO 어휘 축약)이 완료된 시점의 강제 규칙이므로 전 규칙이 초록이어야 한다.
 */
@AnalyzeClasses(packages = "com.finalcall", importOptions = ImportOption.DoNotIncludeTests.class)
class ConventionArchitectureTest {

    /**
     * (e-1) DTO 어휘 — 도메인 feature {@code ..dto..}에 {@code *View}·{@code *Detail}·{@code *Slice}
     * 접미사 금지(§9.7).
     *
     * <p>웹 표현 DTO 허용 접미사는 {@code Request}·{@code Response}·{@code CursorResponse<T>} 3종뿐이다.
     * 중첩 read 모델은 상위 {@code *Response}의 내부 record로, 커서 목록은 공용 {@code CursorResponse<T>}로
     * 표현한다. 마지막 단어가 {@code Response}인 타입({@code *DetailResponse}·{@code *CursorResponse})은
     * 허용되며 이 규칙에 미매칭이다(금지 대상은 타입명 <b>마지막 단어</b>가 View/Detail/Slice인 타입).
     *
     * <p>스코프를 {@code com.finalcall.domain..dto..}로 한정하므로 공용 커널의
     * {@code common.response.FieldErrorDetail}(검증 에러 record — 도메인 DTO 아님)은 자연히 대상에서 빠진다.
     */
    @ArchTest
    static final ArchRule dto_어휘_금지접미사_없음 = noClasses()
        .that().resideInAPackage("com.finalcall.domain..dto..")
        .should().haveSimpleNameEndingWith("View")
        .orShould().haveSimpleNameEndingWith("Detail")
        .orShould().haveSimpleNameEndingWith("Slice")
        .allowEmptyShould(true);

    /**
     * (e-2) 서비스 계약 DTO 어휘 — {@code *Command}·{@code *Result}는 bid·settlement feature에서만 허용(§9.7).
     *
     * <p>On-Race 정본은 Command 0개(서비스가 웹 DTO를 직접 수령·반환)다. finalcall은 동시성·금전 정합의 핵심인
     * bid·settlement 두 feature에서만 서비스 입출력 계약으로 {@code *Command}·{@code *Result}를 유지하고,
     * 그 외 feature에서는 폐지한다. 전 패키지의 {@code *Command}/{@code *Result} 타입이 두 feature 밖에
     * 존재하면 위반이다.
     */
    @ArchTest
    static final ArchRule command_result_는_bid_settlement_에만 = classes()
        .that().haveSimpleNameEndingWith("Command")
        .or().haveSimpleNameEndingWith("Result")
        .should().resideInAnyPackage(
            "com.finalcall.domain.bid..",
            "com.finalcall.domain.settlement..")
        .allowEmptyShould(true);

    /**
     * (f) ErrorCode 중앙화 — {@code ErrorCode}를 구현한 enum은 {@code com.finalcall.common.exception}에만 존재(§9.8).
     *
     * <p>v0.2의 "ErrorCode=feature 루트"를 번복해 모든 도메인 {@code *ErrorCode} enum을 커널
     * {@code common.exception}으로 중앙화한다(도메인별 enum 분리는 유지). 전역 예외 핸들러가 각 feature를
     * 역참조하지 않아 커널 격리(§10-c)와도 정합한다.
     *
     * <p><b>예외 = {@code infra.security.GatewayErrorCode}</b>: 게이트웨이 엣지 발생 코드(계약 [1.6], D-068)로,
     * 모든 요청에 걸리는 보안 파이프라인의 인프라 코드이지 도메인 코드가 아니다 → §9.8·§10-f 결정대로 infra 잔류를
     * 명시 예외한다(On-Race {@code InfraErrorCode} 대응군). 이 한 건만 FQN으로 제외한다.
     */
    @ArchTest
    static final ArchRule errorcode_enum_중앙화 = classes()
        .that().implement(ErrorCode.class)
        .and().areEnums()
        .and().doNotHaveFullyQualifiedName("com.finalcall.infra.security.GatewayErrorCode")
        .should().resideInAPackage("com.finalcall.common.exception")
        .allowEmptyShould(true);

    /**
     * (g) Properties 위치 — {@code @ConfigurationProperties} 타입은 커널({@code common}·{@code infra}) 또는
     * feature의 {@code config} 하위패키지에만 존재하고, feature 루트 직속을 금지한다(§9.9).
     *
     * <p>소비범위 분리 원칙: 단일 feature 전용 Properties는 {@code com.finalcall.domain.<feature>.config}로,
     * 인프라 어댑터 종속 cross-cutting은 {@code infra}로, 계층중립 cross-cutting은 {@code common}으로 둔다.
     * {@code com.finalcall.domain.*.config..}의 {@code *}는 feature 세그먼트 하나를 매칭하므로 feature 루트
     * 직속({@code com.finalcall.domain.<feature>.XProperties})은 허용 패키지에서 빠져 위반으로 잡힌다.
     *
     * <p>common vs infra 판정은 소비자 기반(§9.9)이라 완전 기계강제가 어렵다 — 이 규칙은 "허용 3위치(커널 2 +
     * feature config)"만 강제하고, common/infra 간 배치는 리뷰가 §9.9 원칙으로 확인한다. 이름 기반이라
     * {@code *Properties} 접미사를 정본으로 삼는다(현행 전 Properties 클래스가 이 접미사를 사용).
     */
    @ArchTest
    static final ArchRule properties_위치_강제 = classes()
        .that().haveSimpleNameEndingWith("Properties")
        .should().resideInAnyPackage(
            "com.finalcall.common..",
            "com.finalcall.infra..",
            "com.finalcall.domain.*.config..")
        .allowEmptyShould(true);
}
