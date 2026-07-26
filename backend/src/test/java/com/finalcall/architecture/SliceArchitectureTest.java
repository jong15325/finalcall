package com.finalcall.architecture;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAnyPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.Architectures;

/**
 * feature-first 슬라이스 규율(EPIC-RESTRUCTURE, proposal v0.2 §10)을 test 코드로 강제한다.
 *
 * <p>Phase 3(FC-122)에서 구 최상위-레이어 규칙 파일(구 {@code LayerDependencyTest})을 통째로 삭제하고,
 * 이 클래스에 신 규칙 3종만 남긴다 — (a) 슬라이스 내부 계층방향, (b) top-level 슬라이스 비순환,
 * (c) 커널 격리(common·infra). 구 {@code api → domain → infra → common} 레이어 규칙은
 * FC-121로 {@code com.finalcall.api.*}가 소멸해 죽은 참조가 되었으므로 제거되었다(proposal §10-d).
 *
 * <p>이름 기반 규칙이라 신규 feature가 늘어도 규칙이 불변이며, 빈 레이어/빈 결과를 허용한다
 * ({@code withOptionalLayers(true)}·{@code allowEmptyShould(true)}).
 */
@AnalyzeClasses(packages = "com.finalcall", importOptions = ImportOption.DoNotIncludeTests.class)
class SliceArchitectureTest {

    /**
     * (a) 슬라이스 내부 계층방향 — 이름 기반, 전 feature 한 벌로 적용.
     *
     * <p>{@code ..controller..} → {@code ..service..}·{@code ..dto..},
     * {@code ..service..} → {@code ..repository..}·{@code ..entity..}·{@code ..dto..} 단방향.
     * entity/repository의 controller/service 역참조는 자동 차단된다(Repository가 Controller를 참조하면
     * "Controller가 접근됨"이 되어 {@code Controller.mayNotBeAccessedByAnyLayer()} 위반으로 잡힌다).
     *
     * <p>feature 간(예: {@code member.controller}→{@code item.service})은 막지 않는다 — 둘 다 전역
     * Controller/Service 레이어라 허용된다. feature 간 경계는 (b) 비순환이 담당한다.
     * {@code ..controller..} 등 패턴은 common/infra 어떤 패키지와도 겹치지 않으므로 커널에 무영향이다.
     */
    @ArchTest
    static final ArchRule 슬라이스_내부_계층방향 = Architectures.layeredArchitecture()
        .consideringOnlyDependenciesInLayers()
        .withOptionalLayers(true)
        .layer("Controller").definedBy("com.finalcall..controller..")
        .layer("Dto").definedBy("com.finalcall..dto..")
        .layer("Service").definedBy("com.finalcall..service..")
        .layer("Repository").definedBy("com.finalcall..repository..")
        .layer("Entity").definedBy("com.finalcall..entity..")
        .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
        .whereLayer("Dto").mayOnlyBeAccessedByLayers("Controller", "Service")
        .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller")
        .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service")
        .whereLayer("Entity").mayOnlyBeAccessedByLayers("Controller", "Dto", "Service", "Repository");

    /**
     * (c) 커널 격리 — common은 common 밖 어떤 {@code com.finalcall}도 의존하지 않는다.
     *
     * <p>feature명을 하드코딩하지 않고 "커널 밖 전체"를 부정 조건으로 표현한다(신규 feature가 늘어도 규칙 불변).
     * 구 규칙 {@code common_은_상위계층을_의존하지_않는다}의 feature-first 재표현이다.
     * {@code domain/common}(BaseEntity 3종)의 최종 위치가 {@code com.finalcall.common.*}이면 자동 포섭된다(§9.6).
     */
    @ArchTest
    static final ArchRule common_커널_격리 = noClasses()
        .that().resideInAPackage("com.finalcall.common..")
        .should().dependOnClassesThat(
            resideInAPackage("com.finalcall..")
                .and(not(resideInAPackage("com.finalcall.common.."))))
        .allowEmptyShould(true);

    /**
     * (c) 커널 격리 — infra는 infra·common 밖 어떤 {@code com.finalcall}도 의존하지 않는다.
     *
     * <p>infra는 common 의존만 허용하고 전 feature 의존을 차단한다.
     * 구 규칙 {@code infra_는_상위계층을_의존하지_않는다}의 feature-first 재표현이다.
     */
    @ArchTest
    static final ArchRule infra_커널_격리 = noClasses()
        .that().resideInAPackage("com.finalcall.infra..")
        .should().dependOnClassesThat(
            resideInAPackage("com.finalcall..")
                .and(not(resideInAnyPackage("com.finalcall.infra..", "com.finalcall.common.."))))
        .allowEmptyShould(true);

    /**
     * (b) 슬라이스 비순환 — 최상위 슬라이스(common·domain·infra·support) 간 순환 참조 금지.
     *
     * <p>패턴은 top-level {@code com.finalcall.(*)..}로 <b>유지</b>한다. proposal §10 (b)의 목표 형태는
     * feature 단위 슬라이스({@code com.finalcall.domain.(*)..})이나, 현재 레거시 도메인(auction↔bid,
     * auction↔search↔shop↔settlement)이 엔티티 상호참조 등 <b>실제 런타임 결합</b>으로 순환을 이루므로
     * feature 단위 순환검사는 이 결합을 먼저 끊기 전까지 red가 된다(로직 변경 필요, EPIC-RESTRUCTURE 후속·별도 티켓).
     * 따라서 feature 단위 승격은 레거시 순환 해소 이후로 보류한다. 현 top-level 패턴은 커널·도메인·support
     * 슬라이스 간 순환을 막는 유효 규칙이다.
     */
    @ArchTest
    static final ArchRule 슬라이스_비순환 = slices()
        .matching("com.finalcall.(*)..")
        .should().beFreeOfCycles();
}
