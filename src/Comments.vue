<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import CommentNode from './CommentNode.vue'
import { addComment, apiStatus, countComments, loadThread, loading, threads, visitorName, watchThread } from './store'
const props = defineProps<{ thread: string; title?: string; placeholder?: string }>()
const text = ref('')
const list = computed(() => threads[props.thread] ?? [])
const name = ref(visitorName.value)
const sending = ref(false)
watch(
  () => props.thread,
  (t, _, onCleanup) => {
    loadThread(t)
    onCleanup(watchThread(t))
  },
  { immediate: true },
)
async function send() {
  if (!text.value.trim() || !name.value.trim() || sending.value) return
  sending.value = true
  visitorName.value = name.value.trim()
  if (await addComment(props.thread, name.value.trim(), text.value.trim())) text.value = ''
  sending.value = false
}
</script>

<template>
  <section>
    <h3 class="mb-4 flex items-center gap-2 text-[22px]">{{ title ?? '评论' }}<span class="text-base text-on-surface-variant">{{ countComments(list) }}</span></h3>
    <form class="rounded-[20px] bg-surface-low p-4" @submit.prevent="send">
      <input v-model="name" maxlength="20" placeholder="你的昵称" class="h-12 w-full rounded-t-lg border-b border-outline bg-surface-high px-4 outline-none focus:border-b-2 focus:border-primary" />
      <textarea v-model="text" rows="3" maxlength="500" :placeholder="placeholder ?? '说点什么吧…'" class="mt-3 w-full resize-none rounded-t-lg border-b border-outline bg-surface-high p-4 outline-none focus:border-b-2 focus:border-primary"></textarea>
      <div class="mt-3 flex items-center">
        <span class="text-xs text-on-surface-variant">{{ text.length }}/500</span>
        <button class="state ml-auto flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary disabled:opacity-40" :disabled="!text.trim() || !name.trim() || sending">
          <span class="icon !text-lg" :class="{ 'animate-spin': sending }">{{ sending ? 'progress_activity' : 'send' }}</span>发布
        </button>
      </div>
    </form>
    <div class="mt-6 space-y-5">
      <CommentNode v-for="c in list" :key="c.id" :c="c" :thread="thread" />
      <p v-if="loading[thread] && !list.length" class="py-8 text-center text-on-surface-variant">加载中…</p>
      <p v-else-if="!threads[thread] && (apiStatus === 'down' || apiStatus === 'missing')" class="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
        <span class="icon">cloud_off</span>评论服务暂时连不上，稍后再来看看
        <button class="state rounded-full px-3 py-1 text-sm text-primary" @click="loadThread(thread)">重试</button>
      </p>
      <p v-else-if="!list.length" class="py-8 text-center text-on-surface-variant">还没有内容，来抢沙发吧</p>
    </div>
  </section>
</template>
