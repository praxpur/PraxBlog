<script setup lang="ts">
// 粒子星座（全屏背景层）：粒子漂移、近距离连线，鼠标/手指靠近时被推开并点亮；滚动时产生视差
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { cssColor, mouse, reducedMotion, useThemeVersion } from './util'

const props = defineProps<{ lite?: boolean }>()
const el = ref<HTMLCanvasElement>()
const theme = useThemeVersion()
let raf = 0

onMounted(() => {
  if (reducedMotion()) return
  const c = el.value!, g = c.getContext('2d')!
  let w = 0, h = 0
  const dpr = Math.min(devicePixelRatio, 2)
  const ps: { x: number; y: number; vx: number; vy: number; r: number }[] = []
  const resize = () => {
    const b = c.getBoundingClientRect(); w = b.width; h = b.height
    c.width = w * dpr; c.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const want = Math.round(props.lite ? Math.min(50, (w * h) / 18000) : Math.min(110, (w * h) / 9000)) // 作为氛围而非主角；精简模式减半
    while (ps.length < want) ps.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 1.6 + 0.6 })
    ps.length = want
  }
  const ro = new ResizeObserver(resize); ro.observe(c)
  const rgb = (a: [number, number, number]) => a.map((v) => Math.round(v * 255)).join(',')
  let lime = '', prim = ''
  const readColors = () => { lime = rgb(cssColor('--px-lime')); prim = rgb(cssColor('--md-primary')) }
  readColors()
  watch(theme, () => requestAnimationFrame(readColors))

  // 滚动视差：页面向下滚动时粒子以 35% 的速度向上移动，营造景深
  let lastScroll = window.scrollY
  const onScroll = () => {
    const dy = (window.scrollY - lastScroll) * 0.35
    lastScroll = window.scrollY
    for (const p of ps) p.y = (((p.y - dy) % h) + h) % h
  }
  addEventListener('scroll', onScroll, { passive: true })

  const frame = () => {
    const b = c.getBoundingClientRect()
    const mx = mouse.x - b.left, my = mouse.y - b.top
    const near = mouse.active && mx > -50 && my > -50 && mx < w + 50 && my < h + 50
    g.clearRect(0, 0, w, h)
    for (const p of ps) {
      if (near) {
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy
        if (d2 < 14000) { const f = (1 - d2 / 14000) * 0.6; p.vx += (dx / Math.sqrt(d2 + 1)) * f; p.vy += (dy / Math.sqrt(d2 + 1)) * f }
      }
      p.vx *= 0.96; p.vy *= 0.96
      p.vx += (Math.random() - 0.5) * 0.03; p.vy += (Math.random() - 0.5) * 0.03
      p.x = (p.x + p.vx + w) % w; p.y = (p.y + p.vy + h) % h
    }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], q = ps[j], d = Math.hypot(a.x - q.x, a.y - q.y)
      if (d < 110) { g.strokeStyle = `rgba(${prim},${(1 - d / 110) * 0.35})`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(q.x, q.y); g.stroke() }
    }
    for (const p of ps) {
      const lit = near && Math.hypot(p.x - mx, p.y - my) < 140
      g.fillStyle = `rgba(${lit ? lime : prim},${lit ? 1 : 0.7})`
      g.beginPath(); g.arc(p.x, p.y, lit ? p.r * 1.8 : p.r, 0, 7); g.fill()
    }
    raf = requestAnimationFrame(frame)
  }
  frame()
  onBeforeUnmount(() => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('scroll', onScroll) })
})
</script>

<template>
  <canvas ref="el" aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 h-[100lvh] w-full"></canvas>
</template>
