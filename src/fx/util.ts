import { onBeforeUnmount, onMounted, ref } from 'vue'

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const finePointer = () => window.matchMedia('(pointer: fine)').matches

/** 读取 CSS 变量颜色 → [r,g,b] 0..1（借助 canvas 统一解析任意颜色格式） */
const ctx = document.createElement('canvas').getContext('2d')!
export function cssColor(name: string): [number, number, number] {
  ctx.fillStyle = '#000'
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000'
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return [d[0] / 255, d[1] / 255, d[2] / 255]
}

/** 主题（.dark 类）变化时返回递增的版本号，便于重读颜色 */
export function useThemeVersion() {
  const v = ref(0)
  let mo: MutationObserver
  onMounted(() => {
    mo = new MutationObserver(() => v.value++)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-seed'] })
  })
  onBeforeUnmount(() => mo?.disconnect())
  return v
}

/** 全局鼠标位置（视口像素） */
export const mouse = { x: innerWidth / 2, y: innerHeight / 2, active: false }
addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true }, { passive: true })
document.addEventListener('pointerleave', () => (mouse.active = false))
