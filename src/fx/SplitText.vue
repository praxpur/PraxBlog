<script setup lang="ts">
// 逐字入场：每个字符模糊 + 上移 + 3D 翻转，依次错峰出现
import { computed } from 'vue'
const props = withDefaults(defineProps<{ text: string; delay?: number; stagger?: number }>(), { delay: 0, stagger: 35 })
const chars = computed(() => [...props.text])
</script>

<template>
  <span :key="text" :aria-label="text" class="split" style="perspective: 600px">
    <span v-for="(ch, i) in chars" :key="i" aria-hidden="true" class="split-ch" :style="{ animationDelay: delay + i * stagger + 'ms' }">{{ ch === ' ' ? '\u00a0' : ch }}</span>
  </span>
</template>

<style>
.split-ch {
  display: inline-block;
  /* backwards：只在等待阶段保持起始帧；结束后不再保留 filter / 3D 变换，避免残留合成层（部分 GPU 上会出现黑块） */
  animation: split-in 0.9s cubic-bezier(0.2, 0, 0, 1) backwards;
  transform-origin: 50% 100%;
}
@keyframes split-in {
  from { opacity: 0; filter: blur(8px); transform: translateY(0.6em) rotateX(-70deg); }
}
@media (prefers-reduced-motion: reduce) { .split-ch { animation: none; } }
[data-fx='off'] .split-ch { animation: none; }
</style>
