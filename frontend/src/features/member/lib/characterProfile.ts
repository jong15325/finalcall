const PROFILE_NAMES = [
    'xyrho',
    'shamoo',
    'sven',
    'cream',
    'roland',
    'aurelli',
    'hawk',
    'hazel',
    'cara',
    'warrior',
    'lucy',
    'darkelf',
    'avatar',
    'avatar',
    'avatar',
    'avatar',
] as const

const NORMAL_FILES = [
    ['01_xyrho_nomal_click', '01_xyrho_nomal'],
    ['02_shamoo_click', '02_shamoo_normal'],
    ['03_sven_click', '03_sven_normal'],
    ['04_cream_click', '04_cream_normal'],
    ['05_roland_click', '05_roland_normal'],
    ['06_aurelli_click', '06_aurelli_normal'],
    ['07_hawk_click', '07_hawk_normal'],
    ['08_hazel_click', '08_hazel_normal'],
    ['09_cara_click', '09_cara_normal'],
    ['10_warrior_n', '10_warrior_c'],
    ['11_lucy_n', '11_lucy_c'],
    ['12_darkelf_n', '12_darkelf_c'],
] as const

export const CHARACTER_IDS = [
    ...Array.from({ length: 12 }, (_, index) => index + 1),
    25,
    26,
    27,
    28,
] as const

export function normalizeCharacterId(id: number | null | undefined): number {
    return CHARACTER_IDS.includes(id as (typeof CHARACTER_IDS)[number])
        ? (id as number)
        : 1
}

export function profileImageSrc(id: number | null | undefined): string {
    const normalized = normalizeCharacterId(id)
    const profileId = normalized <= 12 ? normalized : normalized - 12
    const padded = String(profileId).padStart(2, '0')
    return `/art/characters/profile/uc_${padded}_${PROFILE_NAMES[profileId - 1]}.png`
}

export function normalCharacterSources(id: number) {
    const [defaultName, hoverName] = NORMAL_FILES[id - 1]
    return {
        defaultSrc: `/art/characters/select/ch_${defaultName}.png`,
        hoverSrc: `/art/characters/select/ch_${hoverName}.png`,
    }
}

export function specialCharacterSources(id: number) {
    return {
        defaultSrc: `/art/characters/select/ch_${id}_avatar_normal.png`,
        hoverSrc: `/art/characters/select/ch_${id}_avatar_click.png`,
    }
}
