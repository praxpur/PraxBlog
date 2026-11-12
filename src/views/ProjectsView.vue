<script setup lang="ts">
import { computed, ref } from 'vue'
import { langColor, profile, repos } from '../profile'
import { vTilt } from '../fx/tilt'
import SplitText from '../fx/SplitText.vue'

const showForks = ref(false)
const lang = ref('全部')
const base = computed(() => repos.filter((r) => showForks.value || !r.fork))
const langs = computed(() => ['全部', ...new Set(base.value.map((r) => r.lang).filter(Boolean) as string[])])
const list = computed(() => base.value.filter((r) => lang.value === '全部' || r.lang === lang.value))
</script>

<template>
  <section>
    <div class="mb-8 flex flex-wrap items-end gap-4 rounded-[28px] bg-primary-container p-8 text-on-primary-container">
      <div class="flex-1">
        <span class="icon fill !text-5xl">deployed_code</span>
        <h2 class="mt-3 text-[28px]"><SplitText text="我的项目" :stagger="80" /></h2>
        <p class="mt-1 opacity-80">同步自 GitHub · {{ profile.publicRepos }} 个公开仓库</p>
      </div>
      <a :href="profile.url + '?tab=repositories'" target="_blank" rel="noopener" class="state flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary">
        <span class="icon !text-lg">open_in_new</span>在 GitHub 查看
      </a>
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-2">
      <button
        v-for="l in langs" :key="l"
        class="state flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
        :class="lang === l ? 'border-transparent bg-secondary-container text-on-secondary-container' : 'border-outline-variant text-on-surface-variant'"
        @click="lang = l"
      >
        <span v-if="l !== '全部'" class="size-2.5 rounded-full" :style="{ background: langColor[l] ?? 'currentColor' }"></span>{{ l }}
      </button>
      <label class="ml-auto flex cursor-pointer items-center gap-3 text-sm text-on-surface-variant">
        显示 Fork
        <button role="switch" :aria-checked="showForks" class="relative h-8 w-13 rounded-full border-2 transition-colors" :class="showForks ? 'border-primary bg-primary' : 'border-outline bg-surface-high'" @click="showForks = !showForks; lang = '全部'">
          <span class="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300" :class="showForks ? 'left-[22px] size-6 bg-on-primary' : 'left-1.5 size-4 bg-outline'"></span>
        </button>
      </label>
    </div>

    <TransitionGroup tag="div" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" move-class="transition duration-300" enter-from-class="opacity-0 scale-95" enter-active-class="transition duration-300" leave-active-class="hidden">
      <a v-for="r in list" :key="r.name" v-tilt :href="r.url" target="_blank" rel="noopener" class="state flex flex-col rounded-xl bg-surface-low p-5 transition-shadow hover:shadow-md">
        <div class="flex items-center gap-2">
          <span class="icon text-primary">{{ r.fork ? 'fork_right' : 'book_2' }}</span>
          <h3 class="truncate font-medium">{{ r.name }}</h3>
          <span v-if="r.fork" class="rounded border border-outline-variant px-1.5 text-[11px] text-on-surface-variant">Fork</span>
        </div>
        <p class="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-on-surface-variant">{{ r.desc }}</p>
        <div v-if="r.topics.length" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="t in r.topics" :key="t" class="rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs text-on-tertiary-container">{{ t }}</span>
        </div>
        <div class="mt-4 flex items-center gap-4 text-xs text-on-surface-variant">
          <span v-if="r.lang" class="flex items-center gap-1.5"><span class="size-2.5 rounded-full" :style="{ background: langColor[r.lang] ?? 'currentColor' }"></span>{{ r.lang }}</span>
          <span class="flex items-center gap-0.5"><span class="icon !text-base">star</span>{{ r.stars }}</span>
          <span class="ml-auto">{{ r.updated }}</span>
        </div>
      </a>
    </TransitionGroup>
  </section>
</template>
