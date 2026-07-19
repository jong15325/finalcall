/**
 * Wordmark — 브랜드 활자 자산(FC-041 결정 ①, design-system [3.3] 스케일 예외 1건).
 *
 * **로고 이미지 파일을 만들지 않는다.** 브랜드는 활자 덩어리(대문자 + 800 + 자간 −0.02em)로 무게를
 * 만들고, `CALL` 구간에만 **퍼플 2px 마감선**을 깐다. 색분할(FINAL 검정 + CALL 퍼플)은 기각됐다 —
 * 퍼플이 브랜드 채움으로 새면 [1.2] 액센트 규율이 무너지고, 색 하나에 기대는 가장 흔한 처리다.
 *
 * ★ 마감선은 장식이 아니라 **모티프**다. 경매 카드의 잔여시간 게이지와 **같은 형태(2px 밑선)** 라
 * 브랜드와 기능이 한 언어를 쓴다. 퍼플이 2px 헤어라인으로만 등장하므로 액센트 규율을 지킨다.
 *
 * 크기는 `text-wordmark`(22px) 단일 출처다([3.3]) — 헤더·푸터가 같은 수치를 쓴다. 여기서 크기가
 * 흔들리면 셸이 화면마다 다른 제품처럼 읽힌다. 푸터처럼 작게 놓을 자리는 `scale` 로 줄이지 않고
 * 그대로 둔다(브랜드 자산은 활자 단계가 아니다).
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex select-none items-baseline text-wordmark text-text ${className}`}>
      <span>FINAL</span>
      {/* 마감선 — inset box-shadow 로 baseline 에 딱 붙인다(border-b 는 line-box 아래로 떨어진다) */}
      <span className="shadow-[inset_0_-2px_0_0_theme(colors.primary.DEFAULT)]">CALL</span>
    </span>
  );
}
