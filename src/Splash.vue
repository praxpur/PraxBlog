<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Logo from './Logo.vue'

// Splash: X draws in, the wordmark fades up, then the X zooms through the screen to reveal the site.
// Shown once per browser session.
const show = ref(!sessionStorage.getItem('px-splash'))
const leaving = ref(false)
onMounted(() => {
  if (!show.value) return
  sessionStorage.setItem('px-splash', '1')
  const fast = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  setTimeout(() => (leaving.value = true), fast ? 300 : 1700)
  setTimeout(() => (show.value = false), fast ? 600 : 2500)
})
</script>

<template>
  <div v-if="show" class="splash fixed top-0 left-0 z-50 flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-surface text-on-surface" :class="{ leaving }" @click="leaving = true">
    <div class="flex w-full flex-col items-center">
      <div class="zoom size-28 shrink-0"><Logo mark class="size-full" /></div>
      <Logo class="word mt-10 block h-8 w-[159px] shrink-0" />
    </div>
  </div>
</template>

<style scoped>
.splash { transition: opacity 0.5s ease 0.35s; }
.splash.leaving { opacity: 0; pointer-events: none; }
.zoom { transform-origin: 50% 50%; transition: transform 0.85s cubic-bezier(0.7, 0, 0.84, 0); }
.leaving .zoom { transform: rotate(90deg) scale(40); }
.word { opacity: 0; animation: up 0.6s cubic-bezier(0.2, 0, 0, 1) 0.7s forwards; transition: opacity 0.2s; }
.leaving .word { opacity: 0 !important; animation: none; }
@keyframes up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
</style>
