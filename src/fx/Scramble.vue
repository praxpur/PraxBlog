<script setup lang="ts">
// 解码文字：随机字符逐位“锁定”为目标文本；悬停时重播
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { reducedMotion } from './util'
import { fx } from './settings'
const props = withDefaults(defineProps<{ text: string; delay?: number }>(), { delay: 0 })
const out = ref(props.text)
const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+=<>/×'
let raf = 0, timer = 0
function play() {
  if (reducedMotion() || fx.level === 'off') return
  cancelAnimationFrame(raf)
  const start = performance.now()
  const step = (now: number) => {
    const k = (now - start) / 28 // 每 28ms 锁定一位
    out.value = [...props.text].map((ch, i) => (ch === ' ' || i < k - 4 ? ch : POOL[(Math.random() * POOL.length) | 0])).join('')
    if (k - 4 < props.text.length) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
onMounted(() => (timer = window.setTimeout(play, props.delay)))
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearTimeout(timer) })
</script>

<template>
  <span :aria-label="text" class="font-mono" @pointerenter="play"><span aria-hidden="true">{{ out }}</span></span>
</template>
