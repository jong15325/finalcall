/**
 * `pngChromaKey.mjs` 타입 선언.
 *
 * ★ 스크립트 본체가 `.mjs` 인 이유는 **빌드 전(pre) 단계에서 Node 가 직접 실행**하기 때문이다
 *   (`npm run prebuild`). TS 로 쓰면 실행 전에 컴파일 단계가 하나 더 붙는다.
 *   그런데 **테스트는 이 모듈을 임포트해 검증**하므로(`artChromaKey.test.ts`) 타입이 필요하다.
 *   그래서 구현은 `.mjs` 로 두고 계약만 여기 선언한다.
 */

export declare const CHROMA_KEY: { r: number; g: number; b: number }

export declare function removeChromaKey(buffer: Buffer): {
    /** 크로마키를 투명으로 바꾼 RGBA PNG */
    png: Buffer
    /** 투명 처리한 픽셀 수. **0이면 변환이 아무것도 안 한 것**이라 테스트가 이 값을 본다 */
    keyed: number
    width: number
    height: number
}
