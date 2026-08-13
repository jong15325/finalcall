/**
 * 브랜드 자산 동기화 (FC-067).
 *
 * ★ **왜 복사인가** — `sync-game-art.mjs` 와 같은 이유다. Vite 는 프로젝트 루트(`frontend/`) 밖
 * 파일을 번들·서빙하지 못한다. 브랜드 자산 정본은 `docs/game_ui/common/**`(레포 공용)이므로
 * 원본을 옮기지 않고 **빌드 산출물 쪽으로 복사**한다. 복사본(`public/brand/`)은 `.gitignore`
 * 대상이라 바이너리가 레포에 이중 등재되지 않는다 — 정본은 언제나 `docs/game_ui` 한 곳뿐이다.
 *
 * ★ 아이템 아트와 달리 **크로마키 변환이 없다.** 로고는 이미 알파(PNG-32) 자산이라
 * 단순 복사로 충분하다. (아이템 도트 아트만 네 귀퉁이 `#0000FF` 크로마키를 알파로 바꾼다.)
 *
 * ★ 파일명 매핑 — 목업 자산명(`jangteo-logo` 등)에 맞춰 사본 이름을 고정한다. `BrandLogo`·
 * `BrandLogo` 가 이 경로를 참조한다.
 *
 * 실행: `npm run dev` / `npm run build` 의 pre 스크립트가 `sync-art` 뒤에 자동 호출한다.
 */
import { access, copyFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
/** 자산 정본(레포 공용). 여기를 편집하지 않는다 — 읽기 전용 원본이다. */
const SOURCE = resolve(here, '../../docs/game_ui/common')
/** 복사 대상(미추적). `BrandLogo` 의 참조 경로와 짝을 맞춘다. */
const TARGET = resolve(here, '../public/brand')

/** 원본 파일명 → 사본 파일명. 목업(§5.1) 자산명 규칙을 따른다. */
const ASSETS = [
    ['logo2.png', 'jangteo-logo.png'], // 펼침 워드마크
    ['logo.png', 'jangteo-logo-mark.png'], // 접힘 심볼
]

async function main() {
    try {
        await access(SOURCE)
    } catch {
        // 자산이 없어도 빌드를 세우지 않는다 — 컴포넌트가 alt 텍스트로 흡수한다.
        console.warn(`[brand] 원본을 찾지 못해 건너뜁니다: ${SOURCE}`)
        return
    }

    await mkdir(TARGET, { recursive: true })

    let copied = 0
    for (const [src, dest] of ASSETS) {
        const from = join(SOURCE, src)
        try {
            await access(from)
        } catch {
            console.warn(`[brand] 자산 없음, 건너뜀: ${src}`)
            continue
        }
        await copyFile(from, join(TARGET, dest))
        copied += 1
    }

    console.log(
        `[brand] 브랜드 자산 ${copied}/${ASSETS.length}개 동기화 완료 → ${TARGET}`,
    )
}

main().catch((error) => {
    console.error('[brand] 동기화 실패:', error)
    process.exitCode = 1
})
