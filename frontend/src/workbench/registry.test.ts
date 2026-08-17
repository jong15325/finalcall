import { describe, expect, it } from 'vitest'
import { paths } from '@/app/paths'
import { WORKBENCH_SCENARIOS } from './registry'
import {
    FIRE_PARTICLE_VARIANT_IDS,
    WATER_PARTICLE_VARIANT_IDS,
    WALLET_BALANCE_VARIANT_IDS,
    WIND_PARTICLE_VARIANT_IDS,
} from './scenarioMetadata'
import { SEMANTIC_OVERRIDE_KEYS } from './types'

describe('workbench registry', () => {
    it('uses unique URL-safe scenario and variant ids', () => {
        const ids = WORKBENCH_SCENARIOS.map(({ id }) => id)
        expect(new Set(ids).size).toBe(ids.length)

        for (const scenario of WORKBENCH_SCENARIOS) {
            expect(scenario.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            for (const variant of 'variants' in scenario
                ? (scenario.variants ?? [])
                : []) {
                expect(variant).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            }
        }
    })

    it('matches route contexts to the selected production shell', () => {
        const authPaths = new Set<string>([
            paths.login,
            paths.signup,
            paths.oauthCallback,
        ])
        for (const scenario of WORKBENCH_SCENARIOS) {
            expect(authPaths.has(scenario.routeContext)).toBe(
                scenario.shell === 'auth',
            )
        }
    })

    it('registers the auction card gate in the real AppShell', async () => {
        const scenario = WORKBENCH_SCENARIOS.find(
            ({ id }) => id === 'auction-card',
        )!

        expect(scenario.shell).toBe('app')
        expect(scenario.routeContext).toBe(paths.auctions)
        const module = await scenario.load()
        expect(
            (module.fixture as { auctions: readonly unknown[] }).auctions,
        ).toHaveLength(6)
    })

    it('registers 12 auction time display candidates in the real AppShell', async () => {
        const scenario = WORKBENCH_SCENARIOS.find(
            ({ id }) => id === 'auction-countdown-tags',
        )!

        expect(scenario.shell).toBe('app')
        expect(scenario.routeContext).toBe(paths.auctions)
        const module = await scenario.load()
        expect(
            (module.fixture as { variants: readonly unknown[] }).variants,
        ).toHaveLength(12)
    })

    it('keeps fixture overrides inside the semantic allowlist', async () => {
        const allowlist = new Set<string>(SEMANTIC_OVERRIDE_KEYS)
        for (const scenario of WORKBENCH_SCENARIOS) {
            const module = await scenario.load()
            const overrideGroups = module.fixture.semanticOverridesByVariant
            if (overrideGroups && 'variants' in scenario && scenario.variants) {
                expect(Object.keys(overrideGroups)).toEqual(
                    expect.arrayContaining([...scenario.variants]),
                )
                expect(Object.keys(overrideGroups)).toHaveLength(
                    scenario.variants.length,
                )
            }
            for (const overrides of Object.values(overrideGroups ?? {})) {
                expect(
                    Object.keys(overrides).every((key) => allowlist.has(key)),
                ).toBe(true)
            }
        }
    })

    it('registers the ten wind rendering principles as a lazy DEV scenario', async () => {
        const scenario = WORKBENCH_SCENARIOS.find(
            ({ id }) => id === 'wind-particle-studies',
        )!

        expect(scenario.routeContext).toBe(paths.home)
        expect(scenario.variants).toEqual(WIND_PARTICLE_VARIANT_IDS)
        expect(scenario.variants).toHaveLength(10)

        const module = await scenario.load()
        const fixture = module.fixture as {
            options: readonly { renderer: string }[]
        }
        expect(fixture.options).toHaveLength(10)
        expect(
            new Set(fixture.options.map(({ renderer }) => renderer)).size,
        ).toBe(10)
    })

    it.each([
        ['fire-particle-studies', FIRE_PARTICLE_VARIANT_IDS],
        ['water-particle-studies', WATER_PARTICLE_VARIANT_IDS],
    ] as const)(
        'registers %s with ten lazy rendering principles',
        async (id, variants) => {
            const scenario = WORKBENCH_SCENARIOS.find(
                ({ id: scenarioId }) => scenarioId === id,
            )!
            expect(scenario.routeContext).toBe(paths.home)
            expect(scenario.variants).toEqual(variants)
            expect(scenario.variants).toHaveLength(10)

            const module = await scenario.load()
            const fixture = module.fixture as {
                options: readonly { renderer: string }[]
            }
            expect(fixture.options).toHaveLength(10)
            expect(
                new Set(fixture.options.map(({ renderer }) => renderer)).size,
            ).toBe(10)
        },
    )

    it('registers five lazy wallet information hierarchies on the real wallet route', async () => {
        const scenario = WORKBENCH_SCENARIOS.find(
            ({ id }) => id === 'wallet-balance-studies',
        )!

        expect(scenario.routeContext).toBe(paths.wallet)
        expect(scenario.variants).toEqual(WALLET_BALANCE_VARIANT_IDS)
        expect(scenario.variants).toHaveLength(5)

        const module = await scenario.load()
        const fixture = module.fixture as {
            options: readonly { id: string; fontSpec: string }[]
        }
        expect(fixture.options).toHaveLength(5)
        expect(new Set(fixture.options.map(({ id }) => id)).size).toBe(5)
        expect(fixture.options[0].fontSpec).toContain('32px')
        expect(fixture.options[4].fontSpec).toContain('28px')
    })
})
