<script setup lang="ts">
// 鼠标跟随：实心点即时跟随 + 圆环弹性追随，悬停可点击元素时放大
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { finePointer, mouse, reducedMotion } from './util'

const enabled = finePointer() && !reducedMotion()
const dot = ref<HTMLElement>(), ring = ref<HTMLElement>()
const hover = ref(false), down = ref(false), shown = ref(false)
let raf = 0
const r = { x: mouse.x, y: mouse.y }
const over = (e: Event) => (hover.value = !!(e.target as Element).closest?.('a,button,input,textarea,[data-cursor]'))
const pd = () => (down.value = true), pu = () => (down.value = false)
const mv = () => (shown.value = true), lv = () => (shown.value = false)

onMounted(() => {
  if (!enabled) return
  addEventListener('pointerover', over); addEventListener('pointerdown', pd); addEventListener('pointerup', pu)
  addEventListener('pointermove', mv, { once: false }); document.addEventListener('pointerleave', lv)
  const frame = () => {
    r.x += (mouse.x - r.x) * 0.18; r.y += (mouse.y - r.y) * 0.18
    dot.value!.style.transform = `translate(${mouse.x}px,${mouse.y}px)`
    ring.value!.style.transform = `translate(${r.x}px,${r.y}px)`
    raf = requestAnimationFrame(frame)
  }
  frame()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  removeEventListener('pointerover', over); removeEventListener('pointerdown', pd); removeEventListener('pointerup', pu)
  removeEventListener('pointermove', mv); document.removeEventListener('pointerleave', lv)
})
</script>

<template>
  <div v-if="enabled" aria-hidden="true" class="pointer-events-none fixed top-0 left-0 z-[60] transition-opacity duration-300" :class="shown ? 'opacity-100' : 'opacity-0'">
    <div ref="ring" class="absolute top-0 left-0">
      <div
        class="-translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-lime transition-[width,height,background-color] duration-300 ease-out"
        :class="[hover ? 'size-14 bg-lime/10' : 'size-8', down && 'scale-75']"
      ></div>
    </div>
    <div ref="dot" class="absolute top-0 left-0">
      <div class="size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime transition-transform duration-200" :class="{ 'scale-0': hover }"></div>
    </div>
  </div>
</template>
