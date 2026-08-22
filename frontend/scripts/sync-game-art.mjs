/**
 * 게임 카드 아트 동기화 (FC-049 → FC-058 재작업: 크로마키 제거 추가).
 *
 * ★ **왜 복사인가** — React/Vite 는 프로젝트 루트(`frontend/`) 밖 파일을 번들·서빙하지 못한다.
 * 자산 정본은 `docs/game_ui/**`(레포 공용, 디자인·백엔드도 참조)이므로 그 원본을 옮기지 않고
 * **빌드 산출물 쪽으로 복사**한다. 복사본(`public/art/`)은 `.gitignore` 대상이라 바이너리가
 * 레포에 이중 등재되지 않는다 — 정본은 언제나 `docs/game_ui` 한 곳뿐이다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **단순 복사가 아니다 — 크로마키를 알파로 바꾼다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 원본 아트는 `colorType2`(RGB, 알파 없음)라 투명해야 할 **네 귀퉁이가 실제 `#0000FF`
 * 파란 픽셀**이다. 그대로 서빙하면 카드 모서리에 파란 점이 찍히고, 아웃라인을 아무리
 * 붙여도 사라지지 않는다 — **파란 픽셀은 아트 이미지 안에 있기 때문이다.**
 * 실측 근거와 대안(`border-radius`) 기각 사유는 `pngChromaKey.mjs` 상단 참조.
 *
 * **정본은 읽기만 한다.** 변환 결과는 `public/art/**`(미추적)에만 쓴다.
 *
 * ★ **왜 전량인가** — 도달 가능한 조합이 곧 전량이다.
 *   level 1~9 × {l,s} × element 1~4 × kind 9종 = 648장.
 *   시드(FC-052) 템플릿 40종은 element×kind 조합 전수이고 `item_instance.level` 은
 *   인스턴스마다 1~9로 흩어진다. 즉 "시드가 쓰는 조합"으로 좁혀도 그 결과가 전량이라
 *   부분 복사가 성립하지 않는다. 정적 파일이며 **번들에 들어가지 않는다**.
 *
 * 실행: `npm run dev` / `npm run build` 의 pre 스크립트가 자동 호출한다.
 */
import {
    access,
    copyFile,
    mkdir,
    readdir,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { removeChromaKey } from './pngChromaKey.mjs'

const here = dirname(fileURLToPath(import.meta.url))
/** 자산 정본(레포 공용). 여기를 편집하지 않는다 — 읽기 전용 원본이다. */
const SOURCE = resolve(
    here,
    '../../docs/game_ui/item_info/card_image/gold_black',
)
/** 복사 대상. `features/item/lib/itemArt.ts` 의 `ART_BASE` 와 짝을 맞춘다. */
const TARGET = resolve(here, '../public/art/items')

/*
 * ★ **프레임 오버레이 자산은 크로마키 대상이 아니다**(FC-068). 목업(item-frame.css)이 채택한
 * `gold-Photoroom.png`·`black-frame-transparent.png`·숫자/스킬 스프라이트는 이미 **RGBA(alpha)
 * 투명**이라(총괄 실측 colorType 6) 본체 도트 아트와 달리 `#0000FF` 크로마키 처리가 없다.
 * 그래서 **단순 복사**한다 — 본체 아트(위 SOURCE)의 크로마키 파이프라인과 분리 관리한다(§6.2).
 * 정본은 `docs/game_ui/item_info/frames`(목업에서 복사), 사본은 `public/art/frames`(미추적).
 */
const FRAMES_SOURCE = resolve(here, '../../docs/game_ui/item_info/frames')
const FRAMES_TARGET = resolve(here, '../public/art/frames')
const CHARACTER_SELECT_SOURCE = resolve(here, '../../docs/game_ui/char_select')
const CHARACTER_PROFILE_SOURCE = resolve(here, '../../docs/game_ui/user_info')
const CHARACTER_ILLUST_SOURCE = resolve(here, '../../docs/game_ui/char_illust')
const CHARACTER_TARGET = resolve(here, '../public/art/characters')

async function collectPngs(dir, acc = []) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) await collectPngs(full, acc)
        else if (entry.name.endsWith('.png')) acc.push(full)
    }
    return acc
}

async function main() {
    try {
        await access(SOURCE)
    } catch {
        // 자산이 없어도 빌드를 세우지 않는다 — 아트는 화면의 필수 골격이 아니라 장식이고,
        // ItemArtSlot 이 자산 부재를 플레이스홀더로 흡수한다.
        console.warn(`[game-art] 원본을 찾지 못해 건너뜁니다: ${SOURCE}`)
        return
    }

    const files = await collectPngs(SOURCE)
    let converted = 0
    let keyedTotal = 0
    let failed = 0

    for (const file of files) {
        const destination = join(TARGET, relative(SOURCE, file))
        await mkdir(dirname(destination), { recursive: true })

        const source = await readFile(file)
        try {
            const { png, keyed } = removeChromaKey(source)
            await writeFile(destination, png)
            converted++
            keyedTotal += keyed
        } catch (error) {
            /*
             * 변환 실패는 **원본 그대로 복사**로 흡수한다. 파란 모서리가 남는 것이
             * 이미지가 통째로 없는 것보다 낫고, 빌드를 세울 이유는 더더욱 없다.
             */
            failed++
            await writeFile(destination, source)
            console.warn(
                `[game-art] 크로마키 변환 실패(원본 복사): ${relative(SOURCE, file)} — ${error.message}`,
            )
        }
    }

    console.log(
        `[game-art] 동기화 완료 → ${TARGET}\n` +
            `[game-art] ${converted}장 변환 · 투명 처리 ${keyedTotal}px` +
            (failed > 0 ? ` · 실패 ${failed}장(원본 복사)` : ''),
    )

    await syncFrames()
    await syncCharacterProfiles()
    await syncCharacterIllustrations()
}

async function syncCharacterIllustrations() {
    const available = new Set(await readdir(CHARACTER_ILLUST_SOURCE))
    const allowlist = Array.from(
        { length: 25 },
        (_, index) => index + 1,
    ).flatMap((id) =>
        [
            `illust_${id}.png`,
            `illust_${id}_1.png`,
            `illust_effect_${id}.png`,
            `illust_name_${id}.png`,
        ].filter((name) => available.has(name)),
    )
    const target = join(CHARACTER_TARGET, 'illust')
    await mkdir(target, { recursive: true })
    for (const name of allowlist)
        await copyFile(join(CHARACTER_ILLUST_SOURCE, name), join(target, name))
    console.log(
        `[game-art] 캐릭터 일러스트 allowlist ${allowlist.length}개 동기화 완료`,
    )
}

async function syncCharacterProfiles() {
    const mobileNames = [
        'ch_01_xyrho_nomal.png',
        'ch_01_xyrho_nomal_click.png',
        ...[
            'shamoo',
            'sven',
            'cream',
            'roland',
            'aurelli',
            'hawk',
            'hazel',
            'cara',
        ].flatMap((name, index) => {
            const id = String(index + 2).padStart(2, '0')
            return [`ch_${id}_${name}_normal.png`, `ch_${id}_${name}_click.png`]
        }),
        'ch_10_warrior_c.png',
        'ch_10_warrior_n.png',
        'ch_11_lucy_c.png',
        'ch_11_lucy_n.png',
        'ch_12_darkelf_c.png',
        'ch_12_darkelf_n.png',
        ...Array.from({ length: 4 }, (_, index) => index + 25).flatMap((id) => [
            `ch_${id}_avatar_normal.png`,
            `ch_${id}_avatar_click.png`,
        ]),
    ]
    const profileNames = Array.from({ length: 16 }, (_, index) => {
        const id = String(index + 1).padStart(2, '0')
        return `uc_${id}`
    })
    const availableProfiles = (await readdir(CHARACTER_PROFILE_SOURCE)).filter(
        (name) => profileNames.some((prefix) => name.startsWith(`${prefix}_`)),
    )

    if (availableProfiles.length !== 16) {
        throw new Error(
            `[game-art] 프로필 원본은 정확히 16개여야 합니다: ${availableProfiles.length}`,
        )
    }
    await mkdir(join(CHARACTER_TARGET, 'select'), { recursive: true })
    await mkdir(join(CHARACTER_TARGET, 'profile'), { recursive: true })
    const selectTarget = join(CHARACTER_TARGET, 'select')
    for (const staleName of await readdir(selectTarget)) {
        if (!mobileNames.includes(staleName)) {
            await rm(join(selectTarget, staleName))
        }
    }
    for (const name of mobileNames) {
        await copyFile(
            join(CHARACTER_SELECT_SOURCE, name),
            join(CHARACTER_TARGET, 'select', name),
        )
    }
    for (const name of availableProfiles) {
        await copyFile(
            join(CHARACTER_PROFILE_SOURCE, name),
            join(CHARACTER_TARGET, 'profile', name),
        )
    }
    const copied = await readdir(join(CHARACTER_TARGET, 'select'))
    if (
        copied.some(
            (name) => name.includes('_btn_') || !mobileNames.includes(name),
        )
    ) {
        throw new Error(
            '[game-art] 허용되지 않은 캐릭터 선택 자산이 포함됐습니다.',
        )
    }
    console.log(
        `[game-art] 캐릭터 선택 ${mobileNames.length}개 · 프로필 16개 동기화 완료`,
    )
}

/** 프레임 오버레이(RGBA 투명) 단순 복사 — 크로마키 없음(위 FRAMES_SOURCE 주석). */
async function syncFrames() {
    try {
        await access(FRAMES_SOURCE)
    } catch {
        // 프레임 자산이 없어도 빌드를 세우지 않는다 — ItemFrame 이 CSS 폴백으로 흡수한다.
        console.warn(
            `[game-art] 프레임 원본을 찾지 못해 건너뜁니다: ${FRAMES_SOURCE}`,
        )
        return
    }

    const files = (await readdir(FRAMES_SOURCE)).filter((name) =>
        name.endsWith('.png'),
    )
    await mkdir(FRAMES_TARGET, { recursive: true })
    for (const name of files) {
        await copyFile(join(FRAMES_SOURCE, name), join(FRAMES_TARGET, name))
    }
    console.log(`[game-art] 프레임 ${files.length}장 복사 → ${FRAMES_TARGET}`)
}

await main()
