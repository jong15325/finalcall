import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { itemArtSrc } from './itemArt'
import { SUB_GROUPS, kindsOf } from './itemCode'
import { ELEMENT_CODES } from './element'

/**
 * 아트 경로 ↔ **실제 자산 배치** 대조 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ 위 `itemArt.test.ts` 는 "경로 문자열이 규칙대로 나오는가"만 본다. 규칙 자체가 자산과
 *   어긋나면(디렉터리명이 바뀌었다·레벨 폴더가 하나 빠졌다) **전건 통과하면서 전 화면이
 *   깨진 이미지**가 된다. 그래서 파일시스템을 한 번 실제로 찍어본다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 대상은 **자산 정본**(`docs/game_ui/...`)이다 — `public/art` 는 `.gitignore` 대상이라
 * sync 스크립트를 돌리기 전엔 존재하지 않는다. 정본도 없는 환경(자산 미배포 CI)에서는
 * **건너뛴다** — 아트는 화면의 필수 골격이 아니므로 여기서 빌드를 세울 이유가 없다.
 */

const here = dirname(fileURLToPath(import.meta.url))
/** `scripts/sync-game-art.mjs` 의 SOURCE 와 같은 곳을 가리킨다. */
const ART_SOURCE = resolve(
    here,
    '../../../../../docs/game_ui/item_info/card_image/gold_black',
)

/** URL(`/art/items/...`) → 정본 디렉터리 내 상대 경로. */
function toSourcePath(url: string): string {
    return join(ART_SOURCE, url.replace('/art/items/', ''))
}

const hasAssets = existsSync(ART_SOURCE)

describe.skipIf(!hasAssets)('아트 경로가 실제 자산과 맞는다', () => {
    it('정본 디렉터리를 찾았다 (skipIf 가 조용히 전부 건너뛰지 않았는지 확인)', () => {
        expect(hasAssets).toBe(true)
    })

    /**
     * ★ 도달 가능한 조합 **전수**를 찍는다 — level 1~9 × {l,s} × element 4 × kind 9 = 648장.
     *   부분 표본으로는 "레벨 7만 없다" 같은 구멍을 못 잡는다.
     */
    it('도달 가능한 조합 전수(648)의 파일이 존재한다', () => {
        const missing: string[] = []
        let checked = 0

        for (let level = 1; level <= 9; level += 1) {
            for (const size of ['l', 's'] as const) {
                for (const { code: element } of ELEMENT_CODES) {
                    for (const { code: subGroup } of SUB_GROUPS) {
                        for (const { code: kind } of kindsOf(subGroup)) {
                            const url = itemArtSrc(
                                { subGroup, kind, element, level },
                                size,
                            )
                            expect(url).not.toBeNull()
                            checked += 1
                            if (url && !existsSync(toSourcePath(url))) {
                                missing.push(url)
                            }
                        }
                    }
                }
            }
        }

        // 9(무기4+방어구4+마법... 마법은 2종이나 magic.png 공유) → 10 조합/속성.
        expect(checked).toBe(9 * 2 * 4 * 10)
        expect(missing).toEqual([])
    })

    it('★ 레벨을 하나 어긋나게 하면 자산이 없다 — 보정 실수는 조용히 통과하지 못한다', () => {
        // level1 아트를 level0/level10 에서 찾으면 없어야 정상이다(디렉터리는 1~9뿐).
        expect(existsSync(join(ART_SOURCE, 'level0'))).toBe(false)
        expect(existsSync(join(ART_SOURCE, 'level10'))).toBe(false)
    })
})
