<script setup lang="ts">
import { links } from '../links'
import { navigate } from '../router'
import { toneClass } from '../ui'
import SplitText from '../fx/SplitText.vue'
import { vTilt } from '../fx/tilt'
</script>

<template>
  <section>
    <div class="mb-8 rounded-[28px] bg-secondary-container p-8 text-on-secondary-container">
      <span class="icon fill !text-5xl">diversity_3</span>
      <h2 class="mt-3 text-[28px]"><SplitText text="友情链接" :stagger="80" /></h2>
      <p class="mt-1 opacity-80">一些我常逛、也推荐给你的地方。想交换友链？去留言板告诉我。</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <a v-for="l in links" :key="l.url" v-tilt="10" :href="l.url" target="_blank" rel="noopener" class="state group flex items-center gap-4 rounded-xl bg-surface-low/85 p-4 backdrop-blur-md transition-shadow hover:shadow-md">
        <span class="grid size-14 shrink-0 place-items-center rounded-2xl" :class="toneClass[l.tone]"><span class="icon fill !text-3xl">{{ l.icon }}</span></span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">{{ l.name }}</span>
          <span class="block truncate text-sm text-on-surface-variant">{{ l.desc }}</span>
        </span>
        <span class="icon text-on-surface-variant transition-transform group-hover:translate-x-0.5">arrow_outward</span>
      </a>
    </div>
    <button class="state mt-6 flex h-10 items-center gap-2 rounded-full border border-outline px-6 text-sm font-medium text-primary" @click="navigate('guestbook')"><span class="icon !text-lg">add_link</span>申请友链</button>
  </section>
</template>
