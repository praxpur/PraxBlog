<script setup lang="ts">
import { ref } from 'vue'
import { mode, presets, seed, seedFromImage, type Mode } from './theme'
import { fx, setFx, type FxLevel } from './fx/settings'
import { profile } from './profile'
import { site } from './site.config'
import { notify } from './store'

defineEmits<{ close: [] }>()
const picking = ref(false)
async function fromAvatar() {
  picking.value = true
  try { seed.value = await seedFromImage(profile.avatar) } catch { notify('无法读取头像颜色') } finally { picking.value = false }
}
const modes: { k: Mode; l: string; i: string }[] = [
  { k: 'light', l: '浅色', i: 'light_mode' }, { k: 'dark', l: '深色', i: 'dark_mode' }, { k: 'system', l: '跟随系统', i: 'brightness_auto' },
]
const levels: { k: FxLevel | 'auto'; l: string }[] = [
  { k: 'auto', l: '自动' }, { k: 'full', l: '完整' }, { k: 'lite', l: '精简' }, { k: 'off', l: '关闭' },
]
const fxLabel: Record<FxLevel, string> = { full: '完整', lite: '精简', off: '关闭' }
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/30" @click="$emit('close')">
    <div
      class="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-[28px] bg-surface-container p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-2xl md:inset-x-auto md:bottom-6 md:left-24 md:w-[360px] md:rounded-[28px]"
      role="dialog" aria-label="外观设置" @click.stop
    >
      <div class="mx-auto -mt-2 mb-4 h-1 w-8 rounded-full bg-outline-variant md:hidden"></div>
      <h2 class="text-[22px]">外观</h2>

      <p class="mt-5 mb-2 text-sm font-medium text-on-surface-variant">显示模式</p>
      <div class="grid grid-cols-3 overflow-hidden rounded-full border border-outline">
        <button
          v-for="m in modes" :key="m.k"
          class="state flex h-10 items-center justify-center gap-1 border-r border-outline text-sm last:border-r-0"
          :class="mode === m.k ? 'bg-secondary-container text-on-secondary-container' : ''"
          @click="mode = m.k"
        ><span class="icon !text-lg">{{ mode === m.k ? 'check' : m.i }}</span>{{ m.l }}</button>
      </div>

      <p class="mt-6 mb-2 text-sm font-medium text-on-surface-variant">主题色 · 动态取色</p>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="c in presets" :key="c"
          class="grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-surface-container transition"
          :class="seed.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-on-surface' : ''"
          :style="{ background: c }" :aria-label="c" @click="seed = c"
        ><span v-if="seed.toLowerCase() === c.toLowerCase()" class="icon !text-lg text-white">check</span></button>
        <label class="state relative grid size-10 cursor-pointer place-items-center overflow-hidden rounded-full border border-outline" aria-label="自定义颜色">
          <span class="icon !text-lg">colorize</span>
          <input v-model="seed" type="color" class="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button class="state flex h-9 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-sm text-on-secondary-container" :disabled="picking" @click="fromAvatar">
          <span class="icon !text-lg" :class="{ 'animate-spin': picking }">{{ picking ? 'progress_activity' : 'face' }}</span>从头像取色
        </button>
        <button v-if="seed.toLowerCase() !== site.seedColor.toLowerCase()" class="state h-9 rounded-full border border-outline px-4 text-sm text-primary" @click="seed = site.seedColor">恢复默认</button>
      </div>

      <p class="mt-6 mb-2 text-sm font-medium text-on-surface-variant">动效 <span v-if="fx.auto" class="font-normal">（自动：当前为{{ fxLabel[fx.level] }}）</span></p>
      <div class="grid grid-cols-4 overflow-hidden rounded-full border border-outline">
        <button
          v-for="l in levels" :key="l.k"
          class="state h-10 border-r border-outline text-sm last:border-r-0"
          :class="(l.k === 'auto' ? fx.auto : !fx.auto && fx.level === l.k) ? 'bg-secondary-container text-on-secondary-container' : ''"
          @click="setFx(l.k)"
        >{{ l.l }}</button>
      </div>
      <p class="mt-2 text-xs leading-5 text-on-surface-variant">精简：降低背景分辨率与帧率、减少粒子，适合低端设备或省电。关闭：停用背景、粒子、鼠标跟随与文字动画。</p>
    </div>
  </div>
</template>
