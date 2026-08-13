import type {
    WaterParticleOption,
    WATER_PARTICLE_COLORS,
} from '../fixtures/elementParticles'
import ElementParticleCanvas, {
    type ElementParticleFrame,
} from './ElementParticleCanvas'
import { wrap } from './elementParticleMath'

type WaterColors = typeof WATER_PARTICLE_COLORS
type WaterFrame = ElementParticleFrame<WaterColors>

export default function WaterParticleCanvas({
    option,
    colors,
}: {
    option: WaterParticleOption
    colors: WaterColors
}) {
    return (
        <ElementParticleCanvas
            id={option.id}
            label={`${option.name} 물 파티클 미리보기`}
            particleCount={option.particleCount}
            seed={option.seed}
            colors={colors}
            renderer={option.renderer}
            staticTime={2700}
            renderFrame={renderWater}
            dataAttribute="water"
            region={{ viewBox: '998 421 922 659', heightRatio: 659 / 922 }}
        />
    )
}

function renderWater(
    renderer: WaterParticleOption['renderer'],
    frame: WaterFrame,
) {
    frame.context.save()
    frame.context.beginPath()
    frame.context.rect(0, 0, frame.width, frame.height)
    frame.context.clip()
    switch (renderer) {
        case 'rain-impact':
            drawRainImpact(frame)
            break
        case 'expanding-ripples':
            drawRipples(frame)
            break
        case 'stream-ribbons':
            drawStreamRibbons(frame)
            break
        case 'mist-advection':
            drawMist(frame)
            break
        case 'caustic-shimmer':
            drawCaustics(frame)
            break
        case 'bubble-rise':
            drawBubbles(frame)
            break
        case 'droplet-trails':
            drawDropletTrails(frame)
            break
        case 'wavelets':
            drawWavelets(frame)
            break
        case 'refractive-beads':
            drawRefractiveBeads(frame)
            break
        case 'hybrid-current':
            drawStreamRibbons(frame, 0.55)
            drawMist(frame, 0.45)
            drawRipples(frame, 0.45)
            break
    }
    frame.context.restore()
}

function drawRainImpact(frame: WaterFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.lineCap = 'round'
    for (const particle of particles) {
        const progress = wrap(particle.y + time * particle.speed * 0.8)
        const x = particle.x * width
        const impactY = height * (0.7 + particle.x * 0.18)
        const y = progress * height
        if (y < impactY) {
            context.strokeStyle = colors.bright
            context.globalAlpha = 0.24 + particle.size * 0.15
            context.lineWidth = 0.8 + particle.size * 0.35
            context.beginPath()
            context.moveTo(x - 5, y - 16)
            context.lineTo(x, y)
            context.stroke()
            continue
        }
        const ring = Math.min(1, (y - impactY) / (height - impactY))
        context.strokeStyle = colors.flow
        context.globalAlpha = (1 - ring) * 0.42
        context.beginPath()
        context.ellipse(
            x,
            impactY,
            5 + ring * 25,
            2 + ring * 7,
            0,
            0,
            Math.PI * 2,
        )
        context.stroke()
    }
}

function drawRipples(frame: WaterFrame, opacity = 1) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.bright
    for (let index = 0; index < Math.min(8, particles.length); index += 1) {
        const particle = particles[index]
        const progress = wrap(time * 0.08 + particle.phase / 6.3)
        context.globalAlpha = (1 - progress) * 0.42 * opacity
        context.lineWidth = 0.8 + (1 - progress) * 1.5
        context.beginPath()
        context.ellipse(
            particle.x * width,
            height * (0.32 + particle.y * 0.55),
            8 + progress * width * 0.18,
            3 + progress * height * 0.055,
            -0.04,
            0,
            Math.PI * 2,
        )
        context.stroke()
    }
}

function drawStreamRibbons(frame: WaterFrame, opacity = 1) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'screen'
    context.lineCap = 'round'
    for (let index = 0; index < Math.min(6, particles.length); index += 1) {
        const phase = time * 0.28 + particles[index].phase
        const y = height * (0.2 + index * 0.12)
        context.beginPath()
        context.moveTo(-20, y + Math.sin(phase) * 12)
        context.bezierCurveTo(
            width * 0.28,
            y + Math.cos(phase) * 30,
            width * 0.65,
            y - Math.sin(phase * 0.7) * 38,
            width + 20,
            y + Math.cos(phase * 0.8) * 14,
        )
        context.strokeStyle = index % 2 === 0 ? colors.flow : colors.mid
        context.globalAlpha = (0.08 + index * 0.016) * opacity
        context.lineWidth = 6 + index * 1.6
        context.stroke()
        context.strokeStyle = colors.bright
        context.globalAlpha = (0.3 - index * 0.03) * opacity
        context.lineWidth = 1
        context.stroke()
    }
}

function drawMist(frame: WaterFrame, opacity = 1) {
    const { context, width, height, time, particles, colors, coarse } = frame
    context.globalCompositeOperation = 'screen'
    context.filter = coarse ? 'none' : 'blur(5px)'
    context.fillStyle = colors.mist
    for (const particle of particles) {
        const progress = wrap(particle.x + time * particle.speed * 0.2)
        const x = progress * width
        const y =
            height * (0.25 + particle.y * 0.55) +
            Math.sin(particle.phase + time) * 10
        context.globalAlpha = (0.025 + particle.size * 0.025) * opacity
        context.beginPath()
        context.ellipse(
            x,
            y,
            28 + particle.size * 15,
            9 + particle.size * 4,
            0,
            0,
            Math.PI * 2,
        )
        context.fill()
    }
    context.filter = 'none'
}

function drawCaustics(frame: WaterFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'screen'
    context.strokeStyle = colors.bright
    context.lineWidth = 1.2
    for (let index = 0; index < Math.min(10, particles.length); index += 1) {
        const x = width * (0.05 + index * 0.1)
        const phase = time * 0.45 + particles[index].phase
        context.globalAlpha = 0.12 + (index % 3) * 0.04
        context.beginPath()
        context.moveTo(x - 28, height * 0.18)
        context.quadraticCurveTo(
            x + Math.sin(phase) * 30,
            height * 0.5,
            x - 16,
            height * 0.82,
        )
        context.stroke()
        context.beginPath()
        context.moveTo(x + 32, height * 0.16)
        context.quadraticCurveTo(
            x - Math.cos(phase) * 26,
            height * 0.48,
            x + 22,
            height * 0.86,
        )
        context.stroke()
    }
}

function drawBubbles(frame: WaterFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.bright
    for (const particle of particles) {
        const progress = wrap(particle.y - time * particle.speed * 0.45)
        const x = particle.x * width + Math.sin(time + particle.phase) * 12
        const y = height * (1 - progress)
        const radius = 2 + particle.size * 2.5
        context.globalAlpha = 0.18 + progress * 0.35
        context.lineWidth = 0.8 + particle.size * 0.25
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.stroke()
    }
}

function drawDropletTrails(frame: WaterFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.lineCap = 'round'
    for (const particle of particles) {
        const progress = wrap(particle.y + time * particle.speed)
        const x = particle.x * width + Math.sin(particle.phase) * 7
        const y = progress * height
        context.strokeStyle = colors.flow
        context.globalAlpha = 0.22 + particle.size * 0.14
        context.lineWidth = 0.8 + particle.size * 0.4
        context.beginPath()
        context.moveTo(x - 5, y - 30 - particle.size * 8)
        context.quadraticCurveTo(x - 2, y - 12, x, y)
        context.stroke()
        context.fillStyle = colors.bright
        context.beginPath()
        context.ellipse(
            x,
            y,
            1.4 + particle.size,
            2.2 + particle.size * 1.5,
            0,
            0,
            Math.PI * 2,
        )
        context.fill()
    }
}

function drawWavelets(frame: WaterFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.strokeStyle = colors.flow
    context.lineWidth = 1
    for (let row = 0; row < Math.min(8, particles.length); row += 1) {
        const y = height * (0.18 + row * 0.1)
        const phase = time * 0.55 + particles[row].phase
        context.globalAlpha = 0.16 + (row % 3) * 0.055
        context.beginPath()
        for (let step = 0; step <= 20; step += 1) {
            const x = (step / 20) * width
            const waveY = y + Math.sin(step * 0.85 + phase) * (4 + row * 0.5)
            if (step === 0) context.moveTo(x, waveY)
            else context.lineTo(x, waveY)
        }
        context.stroke()
    }
}

function drawRefractiveBeads(frame: WaterFrame) {
    const { context, width, height, time, particles, colors } = frame
    context.globalCompositeOperation = 'lighter'
    for (const particle of particles) {
        const progress = wrap(particle.y - time * particle.speed * 0.25)
        const x = particle.x * width + Math.sin(time * 0.6 + particle.phase) * 8
        const y = height * (1 - progress)
        const radius = 3 + particle.size * 3.5
        const gradient = context.createRadialGradient(
            x - radius * 0.3,
            y - radius * 0.3,
            0,
            x,
            y,
            radius,
        )
        gradient.addColorStop(0, colors.bright)
        gradient.addColorStop(0.55, colors.mid)
        gradient.addColorStop(1, colors.depth)
        context.fillStyle = gradient
        context.globalAlpha = 0.24 + progress * 0.25
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
    }
}
