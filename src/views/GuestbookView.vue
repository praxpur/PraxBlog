<script setup lang="ts">
import Comments from '../Comments.vue'
import SplitText from '../fx/SplitText.vue'
</script>

<template>
  <section class="mx-auto max-w-2xl">
    <div class="mb-8 rounded-[28px] bg-tertiary-container p-8 text-on-tertiary-container">
      <span class="icon fill !text-5xl">forum</span>
      <h2 class="mt-3 text-[28px]"><SplitText text="留言板" :stagger="80" /></h2>
      <p class="mt-1 opacity-80">想说的话、建议、或者只是打个招呼，都欢迎留在这里。</p>
    </div>
    <Comments thread="guestbook" title="全部留言" placeholder="留下你的足迹…" />
  </section>
</template>
