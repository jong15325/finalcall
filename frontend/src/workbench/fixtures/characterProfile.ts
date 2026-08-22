import type { WorkbenchFixture } from '../types'

export interface CharacterProfileOption {
    id: number
    label: string
    selectDefaultSrc: string
    selectHoverSrc: string
    mobileDefaultSrc?: string
    mobileHoverSrc?: string
    profileSrc: string
}

const profileNames = [
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

const mobileBase = [
    '01_xyrho_nomal',
    '02_shamoo_normal',
    '03_sven_normal',
    '04_cream_normal',
    '05_roland_normal',
    '06_aurelli_normal',
    '07_hawk_normal',
    '08_hazel_normal',
    '09_cara_normal',
    '10_warrior_c',
    '11_lucy_c',
    '12_darkelf_c',
] as const
const mobileActive = [
    '01_xyrho_nomal_click',
    '02_shamoo_click',
    '03_sven_click',
    '04_cream_click',
    '05_roland_click',
    '06_aurelli_click',
    '07_hawk_click',
    '08_hazel_click',
    '09_cara_click',
    '10_warrior_n',
    '11_lucy_n',
    '12_darkelf_n',
] as const

export const CHARACTER_PROFILE_OPTIONS: readonly CharacterProfileOption[] = [
    ...Array.from({ length: 12 }, (_, index) => index + 1),
    25,
    26,
    27,
    28,
].map((id) => {
    const profileId =
        id <= 12 ? ((id - 1) % 12) + 1 : id <= 24 ? id - 12 : id - 12
    const padded = String(profileId).padStart(2, '0')
    return {
        id,
        label: `캐릭터 ${id}`,
        selectDefaultSrc:
            id <= 12
                ? `/art/characters/select/ch_${mobileActive[id - 1]}.png`
                : `/art/characters/select/ch_${id}_avatar_normal.png`,
        selectHoverSrc:
            id <= 12
                ? `/art/characters/select/ch_${mobileBase[id - 1]}.png`
                : `/art/characters/select/ch_${id}_avatar_click.png`,
        mobileDefaultSrc:
            id <= 12
                ? `/art/characters/select/ch_${mobileActive[id - 1]}.png`
                : undefined,
        mobileHoverSrc:
            id <= 12
                ? `/art/characters/select/ch_${mobileBase[id - 1]}.png`
                : undefined,
        profileSrc: `/art/characters/profile/uc_${padded}_${profileNames[profileId - 1]}.png`,
    }
})

export const characterProfileFixture = {
    characters: CHARACTER_PROFILE_OPTIONS,
    shellState: {
        authSession: {
            accessToken: 'workbench-character-access-token',
            refreshToken: 'workbench-character-refresh-token',
            accessExpiresAt: '2099-01-01T00:00:00Z',
            user: {
                userPublicId: 'workbench-character-user',
                nickname: '캐릭터 수집가',
                isAdmin: false,
            },
        },
        balance: {
            gameMoneyBalance: 1_520_000,
            gameMoneyAvailable: 1_240_000,
            gameMoneyHeld: 280_000,
            cashBalance: 50_000,
        },
        unreadMemoCount: 0,
    },
} satisfies WorkbenchFixture & { characters: readonly CharacterProfileOption[] }

export type CharacterProfileFixture = typeof characterProfileFixture
