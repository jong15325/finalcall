import type {
    FireParticleOption,
    FIRE_PARTICLE_COLORS,
} from '../fixtures/elementParticles'
import ElementParticleCanvas, {
    type ElementParticleFrame,
} from './ElementParticleCanvas'
import { wrap } from './elementParticleMath'

type FireColors = typeof FIRE_PARTICLE_COLORS
type FireFrame = ElementParticleFrame<FireColors>

export default function FireParticleCanvas({
    option,
    colors,
}: {
    option: FireParticleOption
    colors: FireColors
}) {
    return (
        <ElementParticleCanvas
            id={option.id}
            label={`${option.name} 불 파티클 미리보기`}
            particleCount={option.particleCount}
            seed={option.seed}
            colors={colors}
            renderer={option.renderer}
            staticTime={3100}
            renderFrame={renderFire}
            dataAttribute="fire"
            region={{ viewBox: '1056 0 864 508', heightRatio: 508 / 864 }}
        />
    )
}

function renderFire(
    renderer: FireParticleOption['renderer'],
    frame: FireFrame,
) {
    frame.context.save()
    frame.context.beginPath()
    frame.context.rect(0, 0, frame.width, frame.height)
    frame.context.clip()
    switch (renderer) {
        case 'ember-plume':
            drawEmberPlume(frame)
            break
        case 'flame-tongues':
            drawFlameTongues(frame)
            break
        case 'heat-shimmer':
            drawHeatShimmer(frame)
            break
        case 'combustion-wave':
            drawCombustionWave(frame)
            break
        case 'spark-fountain':
            drawSparkFountain(frame)
            break
        case 'cinder-vortex':
            drawCinderVortex(frame)
            break
        case 'lava-crack':
            drawLavaCrack(frame)
            break
        case 'smoke-ember':
            drawSmokeEmber(frame)
            break
        case 'flare-pulse':
            drawFlarePulse(frame)
            break
        case 'hybrid-inferno':
            drawFlameTongues(frame, 0.55)
            drawEmberPlume(frame, 0.45)
            drawSmokeEmber(frame, 0.35)
            break
    }
    frame.context.restore()
}

function drawEmberPlume(frame: FireFrame, opacity = 1) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'lighter'
    for (const particle of particles) {
        const progress = wrap(particle.y - time * particle.speed * 0.6)
        const x =
            width * (0.5 + (particle.x - 0.5) * (0.25 + progress * 0.8)) +
            Math.sin(time * 1.2 + particle.phase) * 12
        const y = height * (1.02 - progress * 1.08)
        const radius = 1 + particle.size * (1.1 + progress)
        context.fillStyle = progress > 0.55 ? colors.core : colors.ember
        context.globalAlpha = (0.2 + (1 - progress) * 0.5) * opacity
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
    }
}

function drawFlameTongues(frame: FireFrame, opacity = 1) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'screen'
    for (let index = 0; index < Math.min(7, particles.length); index += 1) {
        const particle = particles[index]
        const baseX = width * (0.18 + index * 0.105)
        const phase = time * (0.8 + particle.speed) + particle.phase
        const tipY = height * (0.14 + (index % 3) * 0.08)
        context.beginPath()
        context.moveTo(baseX - 18, height * 0.95)
        context.bezierCurveTo(
            baseX - 28,
            height * 0.68,
            baseX + Math.sin(phase) * 34,
            height * 0.42,
            baseX + Math.cos(phase) * 18,
            tipY,
        )
        context.bezierCurveTo(
            baseX + 42,
            height * 0.48,
            baseX + 30,
            height * 0.73,
            baseX + 20,
            height * 0.95,
        )
        context.closePath()
        context.fillStyle = index % 2 === 0 ? colors.flame : colors.ember
        context.globalAlpha = (0.08 + index * 0.016) * opacity
        context.fill()
        context.strokeStyle = colors.core
        context.lineWidth = 1.1
        context.globalAlpha = (0.35 - index * 0.03) * opacity
        context.stroke()
    }
}

function drawHeatShimmer(frame: FireFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.core
    context.lineWidth = 1.2
    context.lineCap = 'round'
    for (let index = 0; index < Math.min(9, particles.length); index += 1) {
        const x = width * (0.13 + index * 0.095)
        const phase = time * 0.75 + particles[index].phase
        context.globalAlpha = 0.12 + (index % 3) * 0.05
        context.beginPath()
        context.moveTo(x, height * 0.86)
        context.bezierCurveTo(
            x + Math.sin(phase) * 12,
            height * 0.65,
            x - Math.cos(phase) * 16,
            height * 0.42,
            x + Math.sin(phase * 0.8) * 10,
            height * 0.18,
        )
        context.stroke()
    }
}

function drawCombustionWave(frame: FireFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'lighter'
    for (let index = 0; index < Math.min(6, particles.length); index += 1) {
        const progress = wrap(time * 0.12 + particles[index].phase / 6.3)
        context.strokeStyle = index % 2 === 0 ? colors.flame : colors.ember
        context.globalAlpha = (1 - progress) * 0.42
        context.lineWidth = 1.5 + progress * 5
        context.beginPath()
        context.ellipse(
            width * 0.5,
            height * 0.72,
            width * (0.08 + progress * 0.5),
            height * (0.025 + progress * 0.2),
            -0.12,
            0,
            Math.PI * 2,
        )
        context.stroke()
    }
}

function drawSparkFountain(frame: FireFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'lighter'
    context.lineCap = 'round'
    for (const particle of particles) {
        const progress = wrap(particle.y + time * particle.speed * 0.7)
        const direction = particle.x < 0.5 ? -1 : 1
        const x =
            width * 0.5 +
            direction * progress * width * (0.1 + particle.x * 0.45)
        const y =
            height * 0.9 -
            Math.sin(progress * Math.PI) *
                height *
                (0.45 + particle.size * 0.08)
        context.strokeStyle = particle.size > 1.5 ? colors.core : colors.flame
        context.globalAlpha = 0.28 + (1 - progress) * 0.48
        context.lineWidth = 0.7 + particle.size * 0.45
        context.beginPath()
        context.moveTo(x - direction * 8, y + 12)
        context.lineTo(x, y)
        context.stroke()
    }
}

function drawCinderVortex(frame: FireFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.fillStyle = colors.ember
    for (const particle of particles) {
        const progress = wrap(particle.y - time * particle.speed * 0.35)
        const angle = particle.phase + time * 0.7 + progress * Math.PI * 4
        const radius = width * (0.05 + progress * 0.24)
        const x = width * 0.5 + Math.cos(angle) * radius
        const y = height * (0.92 - progress * 0.85)
        context.globalAlpha = 0.18 + (1 - progress) * 0.45
        context.beginPath()
        context.arc(x, y, 1 + particle.size, 0, Math.PI * 2)
        context.fill()
    }
}

function drawLavaCrack(frame: FireFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.lineJoin = 'round'
    for (let index = 0; index < Math.min(7, particles.length); index += 1) {
        const x = width * (0.12 + index * 0.13)
        const flicker =
            0.55 + Math.sin(time * 1.8 + particles[index].phase) * 0.18
        context.beginPath()
        context.moveTo(x, height * 0.92)
        context.lineTo(x + (index % 2 ? -18 : 22), height * 0.7)
        context.lineTo(x + (index % 3 ? 12 : -14), height * 0.5)
        context.lineTo(x + (index % 2 ? 6 : -8), height * 0.28)
        context.strokeStyle = colors.depth
        context.lineWidth = 8
        context.globalAlpha = 0.24
        context.stroke()
        context.strokeStyle = colors.core
        context.lineWidth = 1.5
        context.globalAlpha = flicker
        context.stroke()
    }
}

function drawSmokeEmber(frame: FireFrame, opacity = 1) {
    const { context, width, height, time, particles, colors, coarse } = frame
    context.globalCompositeOperation = 'screen'
    context.filter = coarse ? 'none' : 'blur(5px)'
    for (const particle of particles) {
        const progress = wrap(particle.y - time * particle.speed * 0.2)
        const x =
            width * (0.2 + particle.x * 0.6) +
            Math.sin(time * 0.5 + particle.phase) * 20
        const y = height * (0.95 - progress * 0.82)
        context.fillStyle = colors.smoke
        context.globalAlpha = (0.03 + particle.size * 0.025) * opacity
        context.beginPath()
        context.ellipse(x, y, 24 + particle.size * 12, 12, -0.2, 0, Math.PI * 2)
        context.fill()
    }
    context.filter = 'none'
    drawEmberPlume(frame, opacity * 0.35)
}

function drawFlarePulse(frame: FireFrame) {
    const { context, width, height, time, particles, colors } = frame
    const pulse = (Math.sin(time * 1.3) + 1) / 2
    context.globalCompositeOperation = 'lighter'
    context.strokeStyle = colors.core
    context.lineCap = 'round'
    for (let index = 0; index < Math.min(8, particles.length); index += 1) {
        const angle = particles[index].phase
        const inner = width * 0.05
        const outer = width * (0.12 + pulse * 0.24)
        context.globalAlpha = pulse * (0.18 + (index % 3) * 0.05)
        context.lineWidth = 1 + pulse * 2
        context.beginPath()
        context.moveTo(
            width * 0.5 + Math.cos(angle) * inner,
            height * 0.58 + Math.sin(angle) * inner,
        )
        context.lineTo(
            width * 0.5 + Math.cos(angle) * outer,
            height * 0.58 + Math.sin(angle) * outer,
        )
        context.stroke()
    }
}
