package com.finalcall.domain.search.service;

/** listingType별 재색인 문서 수. */
public record SearchIndexCounts(long auctions, long shops) {

    public long total() {
        return auctions + shops;
    }
}
