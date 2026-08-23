package com.finalcall.domain.item.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ItemClockConfig {

    @Bean
    Clock itemClock() {
        return Clock.systemUTC();
    }
}
