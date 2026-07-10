/**
 * common 계층 — 어디에도 의존하지 않는다(미래 core 후보).
 *
 * <p>프레임워크 최소 의존을 원칙으로 하며 가능한 순수 Java 로 유지한다.
 * JPA/Redis 등 인프라 기술 의존은 금지한다(infra/domain 에만 둔다).
 *
 * <p>하위 패키지: response, exception, logging, util (Stage 3 이후 채운다).
 */
package com.finalcall.common;
