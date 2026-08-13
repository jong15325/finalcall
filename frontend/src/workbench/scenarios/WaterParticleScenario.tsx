import WaterParticleCanvas from '../candidates/WaterParticleCanvas'
import {
    waterParticleFixture,
    type WaterParticleFixture,
} from '../fixtures/elementParticles'
import type { WorkbenchFixture } from '../types'
import ElementParticleStudyScenario from './ElementParticleStudyScenario'

// Scenario module contract requires fixture and component exports together.
// eslint-disable-next-line react-refresh/only-export-components
export const fixture = waterParticleFixture

export default function WaterParticleScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const waterFixture = workbenchFixture as WaterParticleFixture
    return (
        <ElementParticleStudyScenario
            fixture={waterFixture}
            element="water"
            title="물 파티클 렌더링 10안"
            region="우하단 water 영역"
            summary="낙하 충돌, 파문, 수류, 물안개, 광망, 기포, 물방울 꼬리, 잔물결, 굴절 구슬, 혼합처럼 물의 서로 다른 운동과 표면 반응을 동시에 비교합니다."
            renderPreview={(option) => (
                <WaterParticleCanvas
                    option={option}
                    colors={waterFixture.colors}
                />
            )}
        />
    )
}
