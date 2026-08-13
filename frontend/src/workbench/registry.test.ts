import { describe, expect, it } from 'vitest'
import { paths } from '@/app/paths'
import { WORKBENCH_SCENARIOS } from './registry'
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

    it('keeps fixture overrides inside the semantic allowlist', async () => {
        const allowlist = new Set<string>(SEMANTIC_OVERRIDE_KEYS)
        for (const scenario of WORKBENCH_SCENARIOS) {
            const module = await scenario.load()
            const overrideGroups =
                module.fixture.semanticOverridesByVariant ?? {}
            if ('variants' in scenario && scenario.variants) {
                expect(Object.keys(overrideGroups)).toEqual(
                    expect.arrayContaining([...scenario.variants]),
                )
                expect(Object.keys(overrideGroups)).toHaveLength(
                    scenario.variants.length,
                )
            }
            for (const overrides of Object.values(overrideGroups)) {
                expect(
                    Object.keys(overrides).every((key) => allowlist.has(key)),
                ).toBe(true)
            }
        }
    })
})
