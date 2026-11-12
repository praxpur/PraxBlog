<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { allPosts } from '../content'
import { back, navigate, route } from '../router'
import { likeCounts, likedIds, toggleLike } from '../store'
import { toneClass } from '../ui'
import Comments from '../Comments.vue'
import SplitText from '../fx/SplitText.vue'

const post = computed(() => allPosts.value.find((p) => p.id === route.postId) ?? null)
const liked = computed(() => !!post.value && likedIds.value.includes(post.value.id))

/* 阅读进度 + 悬浮按钮 */
const progress = ref(0)
const scrolled = ref(false)
function onScroll() {
  const el = document.documentElement
  progress.value = Math.min(1, el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight))
  scrolled.value = el.scrollTop > 140
}

/* 目录：高亮当前阅读的小节 */
const activeId = ref('')
const tocOpen = ref(false)
let io: IntersectionObserver | null = null
function observeHeadings() {
  io?.disconnect()
  io = new IntersectionObserver(
    (entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) activeId.value = vis[0].target.id
    },
    { rootMargin: '0px 0px -70% 0px' },
  )
  document.querySelectorAll('.prose-px h2[id], .prose-px h3[id]').forEach((h) => io!.observe(h))
}
function jump(id: string) {
  tocOpen.value = false
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
watch(post, () => nextTick(observeHeadings), { immediate: true })
onBeforeUnmount(() => { removeEventListener('scroll', onScroll); io?.disconnect() })

/* 上一篇 / 下一篇 */
const neighbors = computed(() => {
  const list = allPosts.value
  const i = list.findIndex((p) => p.id === route.postId)
  return { newer: i > 0 ? list[i - 1] : null, older: i >= 0 && i < list.length - 1 ? list[i + 1] : null }
})
</script>

<template>
  <div>
    <!-- 阅读进度条 -->
    <div class="fixed inset-x-0 top-0 z-40 h-[3px] origin-left bg-lime transition-transform duration-100 md:left-20" :style="{ transform: `scaleX(${progress})` }"></div>

    <!-- 悬浮返回 / 目录：顶部行滚出视野后出现 -->
    <Transition enter-from-class="opacity-0 -translate-y-3" leave-to-class="opacity-0 -translate-y-3" enter-active-class="transition duration-300 ease-emphasized" leave-active-class="transition duration-200">
      <div v-if="scrolled" class="pointer-events-none fixed inset-x-0 top-[calc(10px+env(safe-area-inset-top))] z-30 flex justify-between px-3 md:left-20 md:px-6">
        <button class="glass-btn pointer-events-auto" aria-label="返回" @click="back"><span class="icon">arrow_back</span></button>
        <button v-if="post?.toc.length" class="glass-btn pointer-events-auto lg:hidden" aria-label="目录" @click="tocOpen = !tocOpen"><span class="icon">toc</span></button>
      </div>
    </Transition>

    <article v-if="post" class="lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-12">
      <div class="mx-auto w-full max-w-2xl">
        <span class="inline-flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-sm font-medium" :class="toneClass[post.tone]">
          <span class="icon fill !text-[18px]">{{ post.icon }}</span>{{ post.tag }}
        </span>
        <h2 class="mt-4 text-[28px] leading-9 font-normal md:text-[36px] md:leading-[44px]"><SplitText :text="post.title" :stagger="25" /></h2>
        <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
          <span class="flex items-center gap-1"><span class="icon !text-lg">calendar_today</span>{{ post.date }}</span>
          <span class="flex items-center gap-1"><span class="icon !text-lg">schedule</span>{{ post.read }} 分钟阅读</span>
          <button v-if="post.toc.length" class="state flex items-center gap-1 rounded-full px-2 lg:hidden" @click="tocOpen = !tocOpen"><span class="icon !text-lg">toc</span>目录</button>
        </p>
        <img v-if="post.cover" :src="post.cover" :alt="post.title" class="mt-6 aspect-[2/1] max-h-72 w-full rounded-2xl object-cover" />
        <div v-else class="mt-6 h-px bg-gradient-to-r from-lime/70 via-outline-variant to-transparent"></div>

        <div class="prose-px mt-6 md:mt-8" v-html="post.html"></div>

        <div class="mt-10 flex flex-wrap gap-3 border-t border-outline-variant pt-6">
          <button
            class="state flex h-10 items-center gap-2 rounded-full px-6 text-sm font-medium transition-colors"
            :class="liked ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container'"
            @click="toggleLike(post.id)"
          >
            <span :key="String(liked)" class="icon !text-lg" :class="{ fill: liked, 'like-pop': liked }">favorite</span>{{ liked ? '已喜欢' : '喜欢' }}<span v-if="likeCounts[post.id]" class="opacity-80">· {{ likeCounts[post.id] }}</span>
          </button>
          <button class="state flex h-10 items-center gap-2 rounded-full border border-outline px-6 text-sm font-medium text-primary" @click="back">
            <span class="icon !text-lg">list</span>返回列表
          </button>
        </div>

        <nav v-if="neighbors.newer || neighbors.older" class="mt-6 grid gap-3 sm:grid-cols-2">
          <button v-if="neighbors.older" class="state rounded-xl bg-surface-low/85 p-4 text-left backdrop-blur-md" @click="navigate('post', neighbors.older.id)">
            <span class="text-xs text-on-surface-variant">上一篇</span>
            <span class="mt-1 line-clamp-1 block font-medium">{{ neighbors.older.title }}</span>
          </button>
          <button v-if="neighbors.newer" class="state rounded-xl bg-surface-low/85 p-4 text-left backdrop-blur-md sm:col-start-2 sm:text-right" @click="navigate('post', neighbors.newer.id)">
            <span class="text-xs text-on-surface-variant">下一篇</span>
            <span class="mt-1 line-clamp-1 block font-medium">{{ neighbors.newer.title }}</span>
          </button>
        </nav>

        <Comments class="mt-12" :thread="'post-' + post.id" />
      </div>

      <!-- 桌面端目录 -->
      <aside v-if="post.toc.length" class="hidden lg:block">
        <nav class="sticky top-10 border-l border-outline-variant pl-4 text-sm">
          <p class="mb-3 font-medium text-on-surface-variant">目录</p>
          <a
            v-for="h in post.toc" :key="h.id" :href="'#' + h.id"
            class="-ml-[17px] block border-l-2 py-1.5 leading-5 transition-colors"
            :class="[activeId === h.id ? 'border-lime text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface', h.level === 3 ? 'pl-7' : 'pl-4']"
            @click.prevent="jump(h.id)"
          >{{ h.text }}</a>
        </nav>
      </aside>
    </article>

    <div v-else class="py-24 text-center text-on-surface-variant">
      <span class="icon !text-5xl">search_off</span>
      <p class="mt-3">文章不存在或仍在加载</p>
      <button class="state mt-6 h-10 rounded-full border border-outline px-6 text-sm font-medium text-primary" @click="navigate('home')">回到首页</button>
    </div>

    <!-- 手机端目录面板 -->
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition duration-200" leave-active-class="transition duration-150">
      <div v-if="tocOpen && post" class="fixed inset-0 z-40 bg-black/30 lg:hidden" @click="tocOpen = false">
        <nav class="absolute inset-x-3 top-[calc(64px+env(safe-area-inset-top))] max-h-[60vh] overflow-auto rounded-[24px] bg-surface-container p-3 shadow-xl" @click.stop>
          <p class="px-3 py-2 text-sm font-medium text-on-surface-variant">目录</p>
          <button
            v-for="h in post.toc" :key="h.id"
            class="state block w-full rounded-full py-2.5 text-left text-[15px]"
            :class="[h.level === 3 ? 'pl-8 text-on-surface-variant' : 'pl-3', activeId === h.id ? 'bg-secondary-container text-on-secondary-container' : '']"
            @click="jump(h.id)"
          >{{ h.text }}</button>
        </nav>
      </div>
    </Transition>
  </div>
</template>
