package com.finalcall.common.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

import com.finalcall.support.TestcontainersConfiguration;

/**
 * {@link ServiceLogAspect} 검증(Stage 4, F2에서 Testcontainers 기반으로 전환).
 *
 * <p>@ServiceLog 부착 메서드가 AOP 프록시로 가로채져, slowMs 초과 시 WARN 으로 로깅되는지 확인한다.
 */
// FC-084: 로컬 데모 시드 러너(LocalDemoSeeder)는 default 프로파일(local)에서 뜨므로 이 전체-컨텍스트 테스트에서 끈다.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "demo.seed.enabled=false")
@ExtendWith(OutputCaptureExtension.class)
class ServiceLogAspectTest {

    @Autowired
    private SlowTarget slowTarget;

    @Test
    void slowMs를_초과하면_WARN으로_로깅된다(CapturedOutput output) {
        slowTarget.doSlowWork();

        assertThat(output).contains("[ServiceLog][SLOW]");
        assertThat(output).contains("SlowTarget.doSlowWork");
    }

    @TestConfiguration
    static class TestBeans {
        @Bean
        SlowTarget slowTarget() {
            return new SlowTarget();
        }
    }

    /** 외부 빈으로 주입되어 프록시를 타야 AOP 가 적용된다(self-invocation 회피). */
    static class SlowTarget {

        @ServiceLog(slowMs = 5)
        public void doSlowWork() {
            try {
                Thread.sleep(30); // slowMs(5) 를 확실히 초과 → WARN 유도
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
