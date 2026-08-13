import LoginForm from '@/features/auth/components/LoginForm'
import { AUTH_LAYOUT_FIXTURE } from '../fixtures/authLayout'
import type { WorkbenchFixture } from '../types'

// Scenario module contract requires fixture and component exports together.
// eslint-disable-next-line react-refresh/only-export-components
export const fixture = AUTH_LAYOUT_FIXTURE

export default function AuthLayoutScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const scenarioFixture = workbenchFixture as typeof AUTH_LAYOUT_FIXTURE
    return (
        <LoginForm
            initialLoginId={scenarioFixture.initialLoginId}
            isSubmitting={false}
            submitError={null}
            onSubmit={() => undefined}
        />
    )
}
