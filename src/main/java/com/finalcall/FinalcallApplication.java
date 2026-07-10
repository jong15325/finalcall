package com.finalcall;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

// @ConfigurationPropertiesScan: com.finalcall 하위의 @ConfigurationProperties 클래스를 스캔·바인딩(Stage 2).
@SpringBootApplication
@ConfigurationPropertiesScan
public class FinalcallApplication {

	public static void main(String[] args) {
		SpringApplication.run(FinalcallApplication.class, args);
	}

}
