<template>
  <canvas ref="canvasRef" class="magic-particles-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Particle {
  x: number
  y: number
  size: number
  speedX: number
  speedY: number
  opacity: number
  opacitySpeed: number
  hue: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let particles: Particle[] = []
const PARTICLE_COUNT = 60

function createParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 2.5 + 0.8,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: -(Math.random() * 0.4 + 0.1),
    opacity: Math.random() * 0.6 + 0.2,
    opacitySpeed: (Math.random() - 0.5) * 0.008,
    hue: Math.random() > 0.7 ? 280 : 40 + Math.random() * 20 // 70% gold, 30% purple
  }
}

function initParticles(w: number, h: number) {
  particles = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(createParticle(w, h))
  }
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)

  particles.forEach((p) => {
    p.x += p.speedX
    p.y += p.speedY
    p.opacity += p.opacitySpeed

    if (p.opacity <= 0.1 || p.opacity >= 0.8) {
      p.opacitySpeed = -p.opacitySpeed
    }

    if (p.y < -10 || p.x < -10 || p.x > w + 10) {
      Object.assign(p, createParticle(w, h))
      p.y = h + 10
    }

    // glow halo
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4)
    if (p.hue > 100) {
      gradient.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${p.opacity * 0.4})`)
    } else {
      gradient.addColorStop(0, `hsla(${p.hue}, 90%, 65%, ${p.opacity * 0.4})`)
    }
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2)
    ctx.fill()

    // bright core
    ctx.fillStyle = p.hue > 100
      ? `hsla(${p.hue}, 80%, 80%, ${p.opacity})`
      : `hsla(${p.hue}, 95%, 75%, ${p.opacity})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  })

  animationId = requestAnimationFrame(animate)
}

function handleResize() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  initParticles(canvas.width, canvas.height)
}

onMounted(() => {
  handleResize()
  animate()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId !== null) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.magic-particles-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>
