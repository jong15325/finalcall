import FireParticleCanvas from '../candidates/FireParticleCanvas'
import {
    fireParticleFixture,
    type FireParticleFixture,
} from '../fixtures/elementParticles'
import type { WorkbenchFixture } from '../types'
import ElementParticleStudyScenario from './ElementParticleStudyScenario'

// Scenario module contract requires fixture and component exports together.
// eslint-disable-next-line react-refresh/only-export-components
export const fixture = fireParticleFixture

export default function FireParticleScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const fireFixture = workbenchFixture as FireParticleFixture
    return (
        <ElementParticleStudyScenario
            fixture={fireFixture}
            element="fire"
            title="불 파티클 렌더링 10안"
            region="우상단 fire 영역"
            summary="불씨, 불꽃 면, 열기, 연소 전선, 분수, 와류, 균열, 연기, 섬광, 혼합처럼 색이 아닌 서로 다른 연소 원리를 절제된 Canvas 비용으로 비교합니다."
            renderPreview={(option) => (
                <FireParticleCanvas
                    option={option}
                    colors={fireFixture.colors}
                />
            )}
        />
    )
}
