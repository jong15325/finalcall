package com.finalcall.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 통합 테스트용 Testcontainers 설정(Stage F2).
 *
 * <p>MySQL/Redis 컨테이너를 {@code @ServiceConnection} 으로 자동 연결한다(접속정보 주입).
 * {@code @Bean} 컨테이너는 Spring 컨텍스트 캐싱으로 재사용되어, 이 설정을 공유하는 테스트들이 컨테이너를 한 번만 띄운다.
 *
 * <p>[INCLUDE_REUSE_HINT] 로컬 반복 속도는 {@code withReuse(true)} + {@code ~/.testcontainers.properties} 의
 * {@code testcontainers.reuse.enable=true} 로 JVM 종료 후에도 컨테이너를 재사용해 높일 수 있다(CI 에서는 보통 끔).
 * reuse 미활성 시 withReuse 는 무시되고 컨테이너는 정상 정리된다.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    MySQLContainer<?> mysqlContainer() {
        return new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
                .withReuse(true);
    }

    @Bean
    @ServiceConnection(name = "redis")
    GenericContainer<?> redisContainer() {
        return new GenericContainer<>(DockerImageName.parse("redis:7"))
                .withExposedPorts(6379)
                .withReuse(true);
    }
}
