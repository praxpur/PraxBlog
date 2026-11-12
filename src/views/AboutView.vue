<script setup lang="ts">
import { computed } from 'vue'
import { allPosts } from '../content'
import { featured, langColor, profile, repos } from '../profile'
import { navigate } from '../router'
import SplitText from '../fx/SplitText.vue'
import { vTilt } from '../fx/tilt'

const picks = computed(() => repos.filter((r) => featured.includes(r.name)))
const stats = computed(() => [
  { n: profile.publicRepos, l: '公开仓库' },
  { n: profile.followers, l: '关注者' },
  { n: profile.following, l: '正在关注' },
  { n: allPosts.value.length, l: '文章' },
])
const rss = import.meta.env.BASE_URL + 'rss.xml'
</script>

<template>
  <section class="mx-auto max-w-3xl">
    <div v-tilt="5" class="relative flex flex-col items-center overflow-hidden rounded-[28px] bg-surface-container p-8 text-center">
      <div class="pointer-events-none absolute -top-20 left-1/2 size-64 -translate-x-1/2 rounded-full bg-lime/20 blur-3xl"></div>
      <img :src="profile.avatar" :alt="profile.name" class="relative size-28 rounded-full object-cover ring-4 ring-lime/60" style="transform: translateZ(40px)" />
      <h2 class="relative mt-4 text-[28px]"><SplitText :text="profile.name" :stagger="60" /></h2>
      <p class="relative mt-1 text-on-surface-variant">@{{ profile.login }} · {{ profile.bio }}</p>
      <div class="relative mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-on-surface-variant">
        <span v-if="profile.company" class="flex items-center gap-1"><span class="icon !text-lg">school</span>{{ profile.company }}</span>
        <span v-if="profile.location" class="flex items-center gap-1"><span class="icon !text-lg">location_on</span>{{ profile.location }}</span>
        <span class="flex items-center gap-1"><span class="icon !text-lg">event</span>{{ profile.since.slice(0, 4) }} 年加入 GitHub</span>
      </div>
      <div class="relative mt-6 flex flex-wrap justify-center gap-2">
        <a :href="profile.url" target="_blank" rel="noopener" class="state flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary"><span class="icon !text-lg">code</span>GitHub</a>
        <a v-if="profile.twitter" :href="'https://x.com/' + profile.twitter" target="_blank" rel="noopener" class="state flex h-10 items-center gap-2 rounded-full bg-secondary-container px-6 text-sm font-medium text-on-secondary-container"><span class="icon !text-lg">alternate_email</span>{{ profile.twitter }}</a>
        <a v-if="profile.blog" :href="profile.blog" target="_blank" rel="noopener" class="state flex h-10 items-center gap-2 rounded-full border border-outline px-6 text-sm font-medium text-primary"><span class="icon !text-lg">public</span>博客</a>
        <a :href="rss" target="_blank" class="state flex h-10 items-center gap-2 rounded-full border border-outline px-6 text-sm font-medium text-primary"><span class="icon !text-lg">rss_feed</span>RSS 订阅</a>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div v-for="s in stats" :key="s.l" class="rounded-xl bg-surface-low/85 p-4 text-center backdrop-blur-md">
        <div class="text-[28px] text-primary">{{ s.n }}</div>
        <div class="text-sm text-on-surface-variant">{{ s.l }}</div>
      </div>
    </div>

    <div class="mt-8 flex items-center">
      <h3 class="text-[22px]">精选项目</h3>
      <button class="state ml-auto flex h-10 items-center gap-1 rounded-full px-4 text-sm font-medium text-primary" @click="navigate('projects')">全部项目<span class="icon !text-lg">arrow_forward</span></button>
    </div>
    <div class="mt-3 grid gap-4 sm:grid-cols-2">
      <a v-for="r in picks" :key="r.name" v-tilt :href="r.url" target="_blank" rel="noopener" class="state flex flex-col rounded-xl bg-surface-low/85 p-5 backdrop-blur-md">
        <span class="flex items-center gap-2 font-medium"><span class="icon text-primary">book_2</span>{{ r.name }}</span>
        <span class="mt-2 line-clamp-2 text-sm text-on-surface-variant">{{ r.desc }}</span>
        <span v-if="r.lang" class="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant"><span class="size-2.5 rounded-full" :style="{ background: langColor[r.lang] ?? 'currentColor' }"></span>{{ r.lang }}</span>
      </a>
    </div>
  </section>
</template>
