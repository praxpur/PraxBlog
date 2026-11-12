<script setup lang="ts">
import { computed, ref } from 'vue'
import { allPosts, type Post } from '../content'
import { site } from '../site.config'
import { commentCounts, likeCounts, likedIds } from '../store'
import { hrefOf, navigate } from '../router'
import { toneClass } from '../ui'
import SplitText from '../fx/SplitText.vue'
import Scramble from '../fx/Scramble.vue'
import { vTilt } from '../fx/tilt'

const activeTag = ref('全部')
const query = ref('')
const tags = computed(() => ['全部', ...new Set(allPosts.value.map((p) => p.tag))])
const liked = computed(() => new Set(likedIds.value))
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allPosts.value.filter(
    (p) => (activeTag.value === '全部' || p.tag === activeTag.value) && (!q || (p.title + p.excerpt + p.text).toLowerCase().includes(q)),
  )
})
const featuredFirst = computed(() => activeTag.value === '全部' && !query.value)
const open = (p: Post) => navigate('post', p.id)
</script>

<template>
  <section>
    <div class="relative mb-6 pb-2 text-on-surface md:mb-8 md:pb-6">
      <div class="pointer-events-none absolute -top-16 left-1/3 size-72 -translate-x-1/2 rounded-full bg-lime/15 blur-3xl"></div>
      <p class="relative text-xs font-medium tracking-[0.2em] text-lime uppercase md:text-sm"><Scramble :text="site.slogan" :delay="1800" /></p>
      <h2 class="relative mt-2 max-w-xl text-[24px] leading-8 md:text-[36px] md:leading-[44px]"><SplitText :text="site.tagline" :delay="1900" /></h2>
      <div class="relative mt-5 flex max-w-md items-center gap-3 rounded-full bg-surface-high/80 px-4 text-on-surface backdrop-blur-md md:mt-6">
        <span class="icon text-on-surface-variant">search</span>
        <input v-model="query" type="search" placeholder="搜索文章标题或正文" class="h-12 flex-1 bg-transparent outline-none placeholder:text-on-surface-variant md:h-14" />
        <button v-if="query" class="state grid size-8 place-items-center rounded-full" aria-label="清空" @click="query = ''"><span class="icon !text-xl">close</span></button>
      </div>
    </div>

    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="t in tags" :key="t"
        class="state flex h-8 items-center gap-1 rounded-lg border px-4 text-sm font-medium transition-colors"
        :class="activeTag === t ? 'border-transparent bg-secondary-container pl-2 text-on-secondary-container' : 'border-outline-variant text-on-surface-variant'"
        @click="activeTag = t"
      >
        <span v-if="activeTag === t" class="icon !text-lg">check</span>{{ t }}
      </button>
    </div>

    <TransitionGroup tag="div" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" move-class="transition duration-300" enter-from-class="opacity-0 scale-95" enter-active-class="transition duration-300 ease-emphasized" leave-active-class="hidden">
      <a
        v-for="(p, i) in filtered" :key="p.id" v-tilt
        :href="hrefOf('post', p.id)"
        class="state flex flex-col overflow-hidden rounded-xl bg-surface-low/85 text-left backdrop-blur-md transition-shadow hover:shadow-md"
        :class="{ 'sm:col-span-2 lg:col-span-2': i === 0 && featuredFirst }"
        @click.prevent="open(p)"
      >
        <!-- 有题图才显示图片；否则不占额外高度 -->
        <img v-if="p.cover" :src="p.cover" :alt="p.title" loading="lazy" class="h-40 w-full object-cover" :class="{ 'sm:h-52': i === 0 && featuredFirst }" />
        <div class="flex flex-1 flex-col p-4" :class="{ 'md:p-6': i === 0 && featuredFirst }">
          <span class="flex items-center gap-2 text-xs text-on-surface-variant">
            <span class="inline-flex h-6 items-center gap-1 rounded-full pr-2.5 pl-1.5 font-medium" :class="toneClass[p.tone]">
              <span class="icon fill !text-[15px]">{{ p.icon }}</span>{{ p.tag }}
            </span>
            {{ p.date }}
          </span>
          <h3 class="mt-3 text-[18px] leading-6 font-medium" :class="{ 'md:text-[24px] md:leading-8': i === 0 && featuredFirst }">{{ p.title }}</h3>
          <p class="mt-2 line-clamp-2 text-sm text-on-surface-variant">{{ p.excerpt }}</p>
          <span class="mt-auto flex items-center gap-1 pt-4 text-xs text-on-surface-variant">
            <span class="icon !text-base">schedule</span>{{ p.read }} 分钟
            <span class="ml-auto flex items-center gap-3">
              <span class="flex items-center gap-0.5"><span class="icon !text-base">chat_bubble</span>{{ commentCounts['post-' + p.id] ?? 0 }}</span>
              <span class="flex items-center gap-0.5" :class="{ 'text-primary': liked.has(p.id) }"><span class="icon !text-base" :class="{ fill: liked.has(p.id) }">favorite</span>{{ likeCounts[p.id] ?? 0 }}</span>
            </span>
          </span>
        </div>
      </a>
    </TransitionGroup>
    <p v-if="!filtered.length" class="py-16 text-center text-on-surface-variant">没有找到相关文章</p>
  </section>
</template>
