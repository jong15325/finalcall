import CharacterProfileCandidate from '../candidates/CharacterProfileCandidate'
import {
    characterProfileFixture,
    type CharacterProfileFixture,
} from '../fixtures/characterProfile'
import type { WorkbenchFixture } from '../types'

// eslint-disable-next-line react-refresh/only-export-components
export const fixture = characterProfileFixture

export default function CharacterProfileScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const scenarioFixture = workbenchFixture as CharacterProfileFixture
    return (
        <div className="mx-auto w-full min-w-0 max-w-3xl">
            <CharacterProfileCandidate
                characters={scenarioFixture.characters}
            />
        </div>
    )
}
