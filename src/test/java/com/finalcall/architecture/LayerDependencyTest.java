package com.finalcall.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.Architectures;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

/**
 * 레이어 의존 방향 규율(Stage 1)을 test 코드로 강제한다.
 *
 * <p>허용 방향: api → domain → infra → common (왼→오 단방향). 역방향 절대 금지.
 * 프로덕션 코드만 검사(test 클래스 제외).
 */
@AnalyzeClasses(packages = "com.finalcall", importOptions = ImportOption.DoNotIncludeTests.class)
class LayerDependencyTest {

    /**
     * 레이어드 아키텍처 전체 규율.
     * 각 레이어는 자신보다 상위(진입점 방향) 레이어에서만 접근 가능하다.
     * consideringOnlyDependenciesInLayers: 정의된 레이어 간 의존만 검사(프레임워크/JDK 노이즈 제외).
     */
    @ArchTest
    static final ArchRule 레이어_의존_방향_규율 = Architectures.layeredArchitecture()
            .consideringOnlyDependenciesInLayers()
            // common/infra 는 Stage 1 에서 아직 비어 있다(package-info 만). 빈 레이어 허용.
            // 의존 방향 검사 자체는 그대로 강제되며, 클래스가 채워지면 자동으로 검증된다.
            .withOptionalLayers(true)
            .layer("common").definedBy("com.finalcall.common..")
            .layer("infra").definedBy("com.finalcall.infra..")
            .layer("domain").definedBy("com.finalcall.domain..")
            .layer("api").definedBy("com.finalcall.api..")
            .whereLayer("api").mayNotBeAccessedByAnyLayer()
            .whereLayer("domain").mayOnlyBeAccessedByLayers("api")
            .whereLayer("infra").mayOnlyBeAccessedByLayers("api", "domain")
            .whereLayer("common").mayOnlyBeAccessedByLayers("api", "domain", "infra");

    /** 1. common 은 infra/domain/api 를 의존하지 못한다. (Stage 1 에선 비어 있어 allowEmptyShould) */
    @ArchTest
    static final ArchRule common_은_상위계층을_의존하지_않는다 = noClasses()
            .that().resideInAPackage("com.finalcall.common..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "com.finalcall.infra..",
                    "com.finalcall.domain..",
                    "com.finalcall.api..")
            .allowEmptyShould(true);

    /** 2. infra 는 domain/api 를 의존하지 못한다. (Stage 1 에선 비어 있어 allowEmptyShould) */
    @ArchTest
    static final ArchRule infra_는_상위계층을_의존하지_않는다 = noClasses()
            .that().resideInAPackage("com.finalcall.infra..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "com.finalcall.domain..",
                    "com.finalcall.api..")
            .allowEmptyShould(true);

    /** 3. domain 은 api 를 의존하지 못한다. */
    @ArchTest
    static final ArchRule domain_은_api를_의존하지_않는다 = noClasses()
            .that().resideInAPackage("com.finalcall.domain..")
            .should().dependOnClassesThat().resideInAnyPackage("com.finalcall.api..");

    /** 4. 레이어(최상위 패키지) 간 순환 참조 금지. */
    @ArchTest
    static final ArchRule 레이어_순환참조_금지 = slices()
            .matching("com.finalcall.(*)..")
            .should().beFreeOfCycles();
}
