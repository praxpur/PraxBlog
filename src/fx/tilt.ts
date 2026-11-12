// v-tilt：3D 透视倾斜 + 跟随光斑。用法 v-tilt 或 v-tilt="12"（最大角度）
import type { Directive } from 'vue'
import { finePointer, reducedMotion } from './util'
import { fx } from './settings'

type El = HTMLElement & { _tilt?: () => void }

export const vTilt: Directive<El, number | undefined> = {
  mounted(el, { value }) {
    if (!finePointer() || reducedMotion()) return
    const max = value ?? 8
    const glare = document.createElement('span')
    glare.className = 'pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300'
    el.classList.add('relative')
    el.style.transformStyle = 'preserve-3d'
    el.style.transition = 'transform .5s cubic-bezier(.2,0,0,1)'
    el.appendChild(glare)
    const move = (e: PointerEvent) => {
      if (fx.level !== 'full') return
      const b = el.getBoundingClientRect()
      const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height
      el.style.transition = 'transform .12s ease-out'
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) scale3d(1.02,1.02,1.02)`
      glare.style.opacity = '1'
      glare.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, color-mix(in srgb, var(--px-lime) 22%, transparent), transparent 55%)`
    }
    const leave = () => {
      el.style.transition = 'transform .6s cubic-bezier(.2,0,0,1)'
      el.style.transform = ''
      glare.style.opacity = '0'
    }
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave)
    el._tilt = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); glare.remove() }
  },
  unmounted(el) { el._tilt?.() },
}
