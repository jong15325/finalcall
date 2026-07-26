package com.finalcall.common.response;

import java.util.List;
import java.util.function.Function;

/**
 * 커서 기반 목록 응답의 공용 봉투(EPIC-CONVENTION-V2 / FC-126). 도메인별 {@code *CursorResponse}를 대체한다.
 *
 * <p>봉투 필드는 계약 §1.3과 기존 6개 커서 응답 전부와 동일한 {@code content}/{@code nextCursor}/{@code hasNext}로
 * 고정한다(형상 보존의 정본). 커서 타입만 도메인마다 갈리므로({@code String} opaque · notice만 {@code Long})
 * 커서를 제네릭 파라미터 {@code C}로 받아 <b>각 도메인의 기존 {@code nextCursor} JSON 타입을 그대로 보존</b>한다.
 *
 * @param content    이번 페이지 항목(응답 DTO로 매핑된 목록)
 * @param nextCursor 다음 페이지 커서(비었으면 null). 타입은 도메인이 결정({@code String} 또는 {@code Long})
 * @param hasNext    다음 페이지 존재 여부
 * @param <T>        항목 타입(응답 DTO)
 * @param <C>        커서 타입(도메인별 opaque {@code String} 또는 숫자 {@code Long})
 */
public record CursorResponse<T, C>(
    List<T> content,
    C nextCursor,
    boolean hasNext) {

    /**
     * 이미 매핑·판정이 끝난 값으로 봉투를 만든다. hasNext 판정을 호출부가 소유하는 기존 관례를 유지한다.
     */
    public static <T, C> CursorResponse<T, C> of(List<T> content, C nextCursor, boolean hasNext) {
        return new CursorResponse<>(content, nextCursor, hasNext);
    }

    /**
     * over-fetch(size+1) 조회 결과로부터 봉투를 만든다(기존 서비스 슬라이싱 관례를 일반화).
     *
     * <p>{@code fetched}가 {@code size}보다 많으면 hasNext=true로 보고 앞 {@code size}건만 담는다.
     * 커서는 매핑 전 원본({@code E})의 마지막 항목에서 추출한다.
     *
     * @param fetched         size+1로 over-fetch한 원본 목록
     * @param size            요청 페이지 크기
     * @param mapper          원본 → 응답 DTO 변환
     * @param cursorExtractor 원본 → 다음 커서 추출(마지막 항목 기준)
     * @param <E>             원본 타입(엔티티·조회 row)
     */
    public static <E, T, C> CursorResponse<T, C> from(
        List<E> fetched, int size, Function<E, T> mapper, Function<E, C> cursorExtractor) {
        boolean hasNext = fetched.size() > size;
        List<E> page = hasNext ? fetched.subList(0, size) : fetched;
        C nextCursor = page.isEmpty() ? null : cursorExtractor.apply(page.get(page.size() - 1));
        List<T> content = page.stream().map(mapper).toList();
        return new CursorResponse<>(content, nextCursor, hasNext);
    }
}
