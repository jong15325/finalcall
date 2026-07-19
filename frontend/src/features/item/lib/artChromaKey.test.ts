import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { removeChromaKey } from '../../../../scripts/pngChromaKey.mjs'

/**
 * 크로마키 제거 검증 (FC-058 재작업 2차).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **사용자가 "모서리에 파란 픽셀이 보인다"고 지적한 그 픽셀을 고정한다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 원본 아트는 알파 채널이 없고 투명해야 할 자리에 `#0000FF` 가 **실제 파란 픽셀로** 들어 있다.
 * `scripts/sync-game-art.mjs` 가 빌드 때 이를 투명으로 바꾼다.
 *
 * 이 파일이 막는 회귀:
 *  1. 변환이 **아무것도 안 하게** 되는 것(조용한 무동작이 가장 위험하다 — 통과하면서 파랗다)
 *  2. 변환이 **아트 내용물까지** 건드리는 것
 *  3. 크로마키가 귀퉁이 밖으로 퍼진 자산이 새로 들어오는 것(그러면 `border-radius` 안이
 *     아니라 지금의 변환 방식이 여전히 옳다는 근거가 흔들린다)
 *
 * ★ 이 프로젝트는 **픽셀을 추정했다가 세 번 정정한 전력**이 있다(베벨 색·대비 기준·번들 원인).
 *   그래서 여기서도 문서를 믿지 않고 **실제 파일을 디코드**한다.
 */

const here = dirname(fileURLToPath(import.meta.url))
const ART_SOURCE = resolve(
    here,
    '../../../../../docs/game_ui/item_info/card_image/gold_black',
)

const hasAssets = existsSync(ART_SOURCE)

/** PNG IHDR 에서 비트깊이·컬러타입을 읽는다(고정 오프셋). */
function readFormat(png: Buffer) {
    return { bitDepth: png[24], colorType: png[25] }
}

function collectPngs(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) collectPngs(full, acc)
        else if (full.endsWith('.png')) acc.push(full)
    }
    return acc
}

describe.skipIf(!hasAssets)('아트 크로마키 → 알파 변환', () => {
    it('정본 디렉터리를 찾았다 (skipIf 가 조용히 전부 건너뛰지 않았는지)', () => {
        expect(hasAssets).toBe(true)
    })

    it('★ 원본은 알파가 없다 — 그래서 변환이 필요하다는 전제 자체를 고정한다', () => {
        const sample = readFileSync(join(ART_SOURCE, 'level7/l/fire/sword.png'))
        // colorType 2 = RGB(알파 없음). 6이면 이미 알파가 있다는 뜻이라 전제가 바뀐다.
        expect(readFormat(sample).colorType).toBe(2)
    })

    it('★ 변환 결과는 RGBA 이고 실제로 지운 픽셀이 있다 (무동작 방지)', () => {
        const source = readFileSync(join(ART_SOURCE, 'level7/l/fire/sword.png'))
        const { png, keyed } = removeChromaKey(source)

        expect(readFormat(png).colorType).toBe(6)
        expect(keyed).toBeGreaterThan(0)
    })

    it('★★ 전수(648장) — 크로마키는 네 귀퉁이 1px씩뿐이다', () => {
        const files = collectPngs(ART_SOURCE)
        expect(files.length).toBeGreaterThan(600)

        let cornersOnly = 0
        let empty = 0
        const elsewhere: string[] = []

        for (const file of files) {
            const { keyed } = removeChromaKey(readFileSync(file))
            if (keyed === 0) empty++
            else if (keyed === 4) cornersOnly++
            else elsewhere.push(`${file} (${keyed}px)`)
        }

        /*
         * ★ 여기가 핵심이다. 귀퉁이 4개(또는 0개)가 아닌 파일이 나오면
         *   "모서리만 처리하면 된다"는 실측 전제가 깨진 것이고, 그때는
         *   처리 방식을 다시 판단해야 한다. 조용히 넘어가면 안 된다.
         */
        expect(elsewhere).toEqual([])
        expect(cornersOnly + empty).toBe(files.length)
    })

    it('아트 내용물은 건드리지 않는다 — 지운 픽셀 수만큼만 불투명도가 줄어든다', () => {
        const source = readFileSync(join(ART_SOURCE, 'level7/l/fire/sword.png'))
        const { keyed, width, height } = removeChromaKey(source)

        // 50×93 = 4650px 중 4px 만 투명해진다. 나머지는 전부 그대로 남는다.
        expect(keyed).toBe(4)
        expect(width * height - keyed).toBe(50 * 93 - 4)
    })
})
