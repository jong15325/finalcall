/**
 * infra 계층 — common 에만 의존한다.
 *
 * <p>기술 세부(설정, Redis, 영속성 등)를 담는다. domain/api 를 참조하지 않는다.
 *
 * <p>하위 패키지: config, redis, persistence (각 Stage 에서 채운다).
 */
package com.finalcall.infra;
