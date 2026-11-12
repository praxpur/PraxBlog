<script setup lang="ts">
import { ref } from 'vue'
import { addComment, adminDelete, adminKey, likeComment, timeAgo, visitorName, type Comment } from './store'
const props = defineProps<{ c: Comment; thread: string; depth?: number }>()
const replying = ref(false)
const text = ref('')
const name = ref(visitorName.value)
const sending = ref(false)
const confirmDel = ref(false)
async function del() {
  if (!confirmDel.value) return (confirmDel.value = true)
  await adminDelete(props.thread, props.c.id)
}
async function send() {
  if (!text.value.trim() || !name.value.trim() || sending.value) return
  sending.value = true
  visitorName.value = name.value.trim()
  if (await addComment(props.thread, name.value.trim(), text.value.trim(), props.c)) {
    text.value = ''
    replying.value = false
  }
  sending.value = false
}
</script>

<template>
  <div class="flex gap-3">
    <div class="grid size-10 shrink-0 place-items-center rounded-full bg-tertiary-container font-medium text-on-tertiary-container">{{ c.name.slice(0, 1) }}</div>
    <div class="min-w-0 flex-1">
      <div class="rounded-2xl rounded-tl-sm bg-surface-container px-4 py-3">
        <div class="flex items-baseline gap-2 text-sm">
          <span class="font-medium">{{ c.name }}</span>
          <span v-if="c.name === 'Blog'" class="rounded bg-primary px-1.5 text-[10px] text-on-primary">作者</span>
          <span v-if="c.pending" class="rounded border border-outline px-1.5 text-[10px] text-on-surface-variant">审核中 · 仅你可见</span>
          <span class="text-xs text-on-surface-variant">{{ timeAgo(c.time) }}</span>
        </div>
        <p class="mt-1 text-[15px] leading-6 break-words whitespace-pre-wrap">{{ c.text }}</p>
      </div>
      <div class="mt-1 flex gap-1 text-xs text-on-surface-variant">
        <button class="state flex h-8 items-center gap-1 rounded-full px-3" :class="{ 'text-primary': c.liked }" @click="likeComment(thread, c)">
          <span :key="String(c.liked)" class="icon !text-base" :class="{ fill: c.liked, 'like-pop': c.liked }">thumb_up</span>{{ c.likes || '' }}
        </button>
        <button v-if="(depth ?? 0) < 3" class="state flex h-8 items-center gap-1 rounded-full px-3" @click="replying = !replying">
          <span class="icon !text-base">reply</span>回复
        </button>
        <button v-if="adminKey" class="state flex h-8 items-center gap-1 rounded-full px-3 text-[#b3261e]" @click="del" @blur="confirmDel = false">
          <span class="icon !text-base">delete</span>{{ confirmDel ? '确认删除' : '删除' }}
        </button>
      </div>
      <form v-if="replying" class="mt-2 flex flex-wrap gap-2" @submit.prevent="send">
        <input v-model="name" placeholder="昵称" class="h-10 w-28 rounded-full border border-outline-variant bg-transparent px-4 text-sm outline-none focus:border-primary" />
        <input v-model="text" :placeholder="`回复 ${c.name}`" class="h-10 min-w-0 flex-1 rounded-full border border-outline-variant bg-transparent px-4 text-sm outline-none focus:border-primary" />
        <button class="state h-10 rounded-full bg-primary px-5 text-sm font-medium text-on-primary disabled:opacity-40" :disabled="!text.trim() || !name.trim() || sending">发送</button>
      </form>
      <div v-if="c.replies.length" class="mt-3 space-y-3">
        <CommentNode v-for="r in c.replies" :key="r.id" :c="r" :thread="thread" :depth="(depth ?? 0) + 1" />
      </div>
    </div>
  </div>
</template>
