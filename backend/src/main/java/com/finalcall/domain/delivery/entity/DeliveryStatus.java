package com.finalcall.domain.delivery.entity;

import java.util.List;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 배송(우편함) 상태(delivery, erd §4.4). DB 는 {@code @Enumerated(EnumType.STRING)}으로 이름을 저장한다(VARCHAR(20)).
 *
 * <p>상태 머신(delivery-domain-spec §5.1·§9.1) — 각 전이는 조건부 CAS(WHERE 현재상태[+claim_token])로 단일 승자다:
 * <pre>
 * (신규)                       ──정산 TX enqueue(웹)──▶ PENDING
 * PENDING / DEFERRED           ──게임 claim(게임 DB-direct)──▶ CLAIMED
 * CLAIMED                      ──게임 apply 성공(게임)──────▶ APPLIED   (종착)
 * CLAIMED                      ──게임 인벤 만실(게임)────────▶ DEFERRED
 * CLAIMED                      ──리스 타임아웃 재청구(웹 sweeper)──▶ PENDING
 * PENDING / DEFERRED / CLAIMED ──하드 실패 격리(웹/관리자)──▶ FAILED    (종착)
 * </pre>
 *
 * <p>{@link #APPLIED}·{@link #FAILED} 는 종착이다. 전달은 at-least-once(재청구), 효과는 exactly-once(item_uuid UK,
 * §5.3·D-E). 상태 문자열은 구매자 배송 상태 조회(§10.1)에 그대로 노출된다(claim_token·claimed_at 은 미노출).
 */
@Getter
@RequiredArgsConstructor
public enum DeliveryStatus {

    PENDING("배송 대기(우편함 적재)"),
    CLAIMED("게임 청구됨(리스 보유)"),
    APPLIED("게임 인벤 적용 완료"),
    DEFERRED("게임 만실 보류(재청구 대기)"),
    FAILED("하드 실패(관리자 개입)");

    private final String description;

    /**
     * 재판매(출품) 차단 상태 집합(§5.4·§6.1·D-F) — <b>FAILED 를 제외한 전 상태</b>(PENDING·CLAIMED·DEFERRED·APPLIED).
     * 이 상태의 배송이 존재하는 동안 해당 {@code item_instance} 의 출품(재판매)을 차단한다(리스팅 경로 가드, FC-188).
     *
     * <p><b>★ APPLIED 를 포함하는 이유(D-F lag 창 봉쇄):</b> 게임 apply 성공(APPLIED) 직후~웹 reconciler 의 IN_GAME
     * 전이(폴 주기) 사이에는 {@code item_instance} 가 아직 INVENTORY/TEMP·배송이 APPLIED 다. APPLIED 를 빼면 이 lag
     * 창에서 가드가 뚫려 {@code markListedIfInInventory} CAS 가 성공 → 게임 재료화 + 웹 리스팅 <b>이중 존재/이중
     * 지급</b>(D-F 위반)이 가능하다. 그래서 "게임에 이미 전달됐거나 전달 중인" 모든 상태(= 비-FAILED)를 차단한다.
     * IN_GAME 이관 완료 후에는 location XOR CAS({@code WHERE location='INVENTORY'})가 이미 배제하므로 APPLIED 추가는
     * 그 창에서 무해·중복이다. FAILED 만 차단에서 빠진다 — 배송이 최종 실패해 게임에 없으므로(관리자 절차 대상).
     *
     * <p>이 집합은 <b>리스팅 가드 전용</b>이다. reconciler({@code findAppliedPendingReconcile}, APPLIED 리터럴)·
     * sweeper({@code reclaimExpiredLeases}, CLAIMED 리터럴)는 이 집합을 소비하지 않으므로 여기 정의가 그들에게
     * 영향을 주지 않는다(의미 격리).
     */
    public static final List<DeliveryStatus> LISTING_BLOCKING_STATUSES = List.of(PENDING, CLAIMED, DEFERRED, APPLIED);

    /** 종착 상태(APPLIED·FAILED)인지 — 더 이상 전이하지 않는다(§9.1). */
    public boolean isTerminal() {
        return this == APPLIED || this == FAILED;
    }
}
